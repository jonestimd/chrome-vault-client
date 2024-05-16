import {MDCRipple} from '@material/ripple';
import {MDCLinearProgress} from '@material/linear-progress';
import {MDCTabBar} from '@material/tab-bar';
document.querySelectorAll('.mdc-button').forEach((node) => new MDCRipple(node));

import {MDCTextField} from '@material/textfield';
const passwordInput = new MDCTextField(document.getElementById('password')!.parentElement!);
const filterInput = new MDCTextField(document.getElementById('vault-filter')!.parentElement!);
const statusArea = document.getElementById('status')!;
const pageInputs = document.getElementById('page-inputs')!;
const linearProgress = new MDCLinearProgress(document.querySelector('.mdc-linear-progress')!);
linearProgress.close();

import * as settings from './settings';
import * as permissions from './permissions';
import * as vaultApi from './vaultApi';
import {PageInfoMessage, LoginInput} from './message';
import {getMessage, getStatus} from './errors';
import UrlList from './components/UrlList';
import {html} from './components/html';
import {getDomain, getHostname} from './urls';
import PropSelect from './components/PropSelect';

async function login(vaultUrl: string, username: string) {
    if (await permissions.requestOrigin(vaultUrl)) {
        const auth = await vaultApi.login(vaultUrl, username, passwordInput.value);
        if (!auth.client_token) throw new Error('Did not get a token, please verify the base URL');
        else {
            await settings.saveToken(auth.client_token);
            return auth.client_token;
        }
    }
    else throw new Error('Need permission to access ' + vaultUrl);
}

function findVaultPaths(secrets: vaultApi.SecretInfo[], pageUrlString: string): vaultApi.SecretInfo[] {
    const pageHostname = new URL(pageUrlString).hostname;
    const hostSecrets = secrets.filter(({url}) => getHostname(url) === pageHostname);
    if (hostSecrets.length) return hostSecrets;
    return secrets.filter(({url}) => {
        const domain = getDomain(url);
        return pageHostname === domain || pageHostname.endsWith(`.${domain}`);
    });
}

function showStatus(text: string) {
    statusArea.replaceChildren(text);
}

class SecretAccessor {
    static async newAccessor(vaultUrl: string, paths: string[], vaultToken: string) {
        const accessor = new SecretAccessor(vaultUrl, paths);
        if (vaultToken) await accessor.getSecrets(vaultToken);
        else showStatus('Need a Vault token');
        return accessor;
    }

    vaultUrl: string;
    paths: string[];
    secrets: {[path: string]: vaultApi.Secret};

    constructor(vaultUrl: string, paths: string[]) {
        this.vaultUrl = vaultUrl;
        this.paths = paths;
        this.secrets = {};
    }

    async getSecrets(vaultToken: string) {
        try {
            showStatus('');
            for (const path of this.paths) {
                const secret = await vaultApi.getSecret(this.vaultUrl, vaultToken, path);
                if (secret) this.secrets[path] = secret;
            }
        } catch (err) {
            if (getStatus(err) === 403) showStatus('Invalid token');
            else showStatus('Error: ' + vaultApi.getErrorMessage(err));
        }
    }

    get haveSecrets() {
        return this.paths.length === Object.keys(this.secrets).length;
    }
}

const inputCountAttr = 'data-inputs';

type Comparator<T> = (v1: T, v2: T) => number;
const compareKeys: Comparator<[string, unknown]> = ([key1], [key2]) => key1.localeCompare(key2);

interface TabActivatedEvent extends Event {
    detail: {index: number}
}

const tabBar = new MDCTabBar(document.querySelector('.mdc-tab-bar')!);
tabBar.activateTab(1);
tabBar.listen<TabActivatedEvent>('MDCTabBar:activated', ({detail}) => {
    const tabs = document.querySelectorAll<HTMLDivElement>('.tab-content');
    tabs.forEach((tab, i) => i === detail.index ? tab.classList.remove('hidden') : tab.classList.add('hidden'));
});

const urlList = new UrlList(document.getElementById('saved-urls')!);
function showDomainPaths(secrets?: vaultApi.SecretInfo[]) {
    urlList.removeAll();
    if (secrets) {
        const byHost = secrets.reduce<Record<string, vaultApi.SecretInfo[]>>((byHost, secret) => {
            const hostname = getHostname(secret.url);
            const urlSecrets = byHost[hostname] ?? [];
            return {...byHost, [hostname]: [...urlSecrets, secret]};
        }, {});
        Object.entries(byHost).sort(compareKeys).forEach(([url, secrets]) => urlList.addItem(url, secrets.map((s) => s.path)));
    }
}
filterInput.listen('input', () => {
    if (filterInput.value.length > 0) urlList.filterItems(filterInput.value);
    else urlList.showAll();
});

const reloadButton = document.getElementById('reload') as HTMLButtonElement;
settings.load().then(({vaultUrl, vaultUser, token, secretPaths}) => {
    document.querySelector<HTMLElement>('#username')!.replaceChildren(vaultUser ?? '');
    showDomainPaths(secretPaths);
    reloadButton.addEventListener('click', async () => {
        try {
            linearProgress.open();
            if (!token) token = await login(vaultUrl!, vaultUser!);
            showStatus('');
            showDomainPaths(await settings.cacheSecretPaths());
        } catch (err) {
            if (getStatus(err) === 403) {
                token = undefined;
                showStatus('Need a token');
            }
            else showStatus(getMessage(err) ?? 'Error with no message??');
        } finally {
            linearProgress.close();
        }
    });
    function updateReload() {
        reloadButton.disabled = !vaultUrl || !vaultUser || !token && !passwordInput.value.length;
    }
    updateReload();
    passwordInput.listen('input', updateReload);
});

const selectInputs: PropSelect[] = [];
let tabId: number;

async function showInputs(message: PageInfoMessage) {
    const {vaultUrl, vaultUser, token, secretPaths} = await settings.load();
    const secretInfos = findVaultPaths(secretPaths!, message.url);
    const secretProps = Array.from(new Set(secretInfos.flatMap((s) => s.keys)));
    const hostname = getHostname(message.url);
    if (secretProps.length && !selectInputs.length) {
        const listener = settings.saveInputSelection.bind(undefined, hostname);
        pageInputs.querySelector('h4[name="no-secret"]')?.remove();
        for (const prop of secretProps) {
            selectInputs.push(new PropSelect(pageInputs, prop, listener));
        }
        tabBar.activateTab(0);
    }
    let vaultToken = token;

    const accessor = await SecretAccessor.newAccessor(vaultUrl!, secretInfos.map((secretInfo) => secretInfo.path), vaultToken!);

    if (message.inputs.length) {
        const inputSelections = await settings.getInputSelections(hostname);
        for (const input of selectInputs) {
            input.addOptions(message.inputs, inputSelections[input.propName]);
        }
    }

    const buttonDiv = document.querySelector('div.buttons')!;
    buttonDiv.replaceChildren();
    const buttons = secretInfos.map((secretInfo) => {
        const matchingInputs = message.inputs.filter((input) => vaultApi.hasSecretValue(input, secretInfo.keys));
        const name = secretInfo.path.replace(/^.*\//, '');
        const button = html`
            <button class="mdc-button mdc-button--raised" ${inputCountAttr}="${matchingInputs.length}">
                <span class="mdc-button__label">${name}</span>
            </button>` as HTMLButtonElement;
        buttonDiv.appendChild(button);
        button.addEventListener('click', async () => {
            if (!accessor.secrets[secretInfo.path] && passwordInput.value.length > 0) {
                try {
                    vaultToken = (await vaultApi.login(vaultUrl!, vaultUser!, passwordInput.value)).client_token;
                    await settings.saveToken(vaultToken);
                    await accessor.getSecrets(vaultToken);
                } catch (err) {
                    showStatus('Error: ' + getMessage(err));
                }
            }
            const secretData = accessor.secrets[secretInfo.path];
            if (secretData) {
                const inputs = selectInputs.reduce<LoginInput[]>((inputs, {propName, selectedInputInfo}) => {
                    const value = secretData.get(propName);
                    return value && selectedInputInfo ? [...inputs, {...selectedInputInfo, value}] : inputs;
                }, []);
                chrome.tabs.sendMessage(tabId, inputs);
            }
        });
        return button;
    });

    function updateButtons() {
        const disableButtons = !accessor.haveSecrets && passwordInput.value.length === 0;
        buttons.forEach((button) => button.disabled = disableButtons || button.getAttribute(inputCountAttr) === '0');
    }
    updateButtons();
    passwordInput.listen('input', updateButtons);
}

chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
    if (tab?.url === 'about:newtab') urlList.useCurrentTab();
    if (tab?.id && tab.url && /^https?:/.test(tab.url)) {
        tabId = tab.id;
        const port = chrome.tabs.connect(tab.id, {name: 'popup'});
        port.onMessage.addListener(showInputs);
        port.postMessage('get-inputs');
    }
});
