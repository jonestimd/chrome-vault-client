import {MDCRipple} from '@material/ripple';
import {MDCLinearProgress} from '@material/linear-progress';
import {MDCTabBar} from '@material/tab-bar';
document.querySelectorAll('.mdc-icon-button').forEach((node) => new MDCRipple(node).unbounded = true);

import {MDCTextField} from '@material/textfield';
const passwordInput = new MDCTextField(document.getElementById('password')!.parentElement!);
const statusArea = document.getElementById('status')!;
const pageInputs = document.getElementById('page-inputs')!;
const loadProgress = new MDCLinearProgress(document.getElementById('load-progress')!);
loadProgress.close();

import * as settings from './settings';
import * as permissions from './permissions';
import * as vaultApi from './vaultApi';
import {PageInfoMessage, LoginInput} from './message';
import {getMessage, getStatus} from './errors';
import UrlList from './components/UrlList';
import {html} from './components/html';
import {getDomain, getHostname} from './urls';
import PropSelect from './components/PropSelect';
import {propOrder} from './constants';
import TotpList from './components/TotpList';

async function login(vaultUrl: string, username: string) {
    if (await permissions.requestOrigin(vaultUrl)) {
        const auth = await vaultApi.login(vaultUrl, username, passwordInput.value);
        if (!auth.token) throw new Error('Did not get a token, please verify the base URL');
        await settings.saveToken(auth);
        return auth;
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
    static async newAccessor(vaultUrl: string, paths: string[], vaultToken?: string) {
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

interface TabActivatedEvent extends Event {
    detail: {index: number}
}

const tabBar = new MDCTabBar(document.querySelector('.mdc-tab-bar')!);
tabBar.activateTab(1);
tabBar.listen<TabActivatedEvent>('MDCTabBar:activated', ({detail}) => {
    const tabs = document.querySelectorAll<HTMLDivElement>('.tab-content');
    tabs.forEach((tab, i) => i === detail.index ? tab.classList.remove('hidden') : tab.classList.add('hidden'));
});

const countdownBar = new MDCLinearProgress(document.getElementById('countdown')!);
const passcodeList = new TotpList(document.getElementById('totp-codes')!, countdownBar, showStatus);

const urlList = new UrlList(document.getElementById('saved-urls')!);
const filterInput = new MDCTextField(document.getElementById('vault-filter')!.parentElement!);
filterInput.listen('input', () => {
    if (filterInput.value.length > 0) urlList.filterItems(filterInput.value);
    else urlList.showAll();
});

const reloadButton = document.getElementById('reload') as HTMLButtonElement;
settings.load().then(({vaultUrl, vaultUser, auth, secretPaths, totpSettings}) => {
    document.querySelector<HTMLElement>('#username')!.replaceChildren(vaultUser ?? '');
    urlList.setItems(secretPaths);
    passcodeList.setItems({vaultUrl, auth, totpSettings});
    reloadButton.addEventListener('click', async () => {
        try {
            loadProgress.open();
            if (!auth || auth.expiresAt <= Date.now()) auth = await login(vaultUrl!, vaultUser!);
            showStatus('');
            const secretInfo = await settings.cacheSecretInfo();
            urlList.setItems(secretInfo?.secretPaths);
            passcodeList.setItems({...secretInfo, vaultUrl, auth});
        } catch (err) {
            if (getStatus(err) === 403) {
                auth = undefined;
                showStatus('Need a token');
            }
            else showStatus(getMessage(err) ?? 'Unknown error');
        } finally {
            loadProgress.close();
        }
    });
    function updateReload() {
        reloadButton.disabled = !vaultUrl || !vaultUser || !auth?.token && !passwordInput.value.length;
    }
    updateReload();
    passwordInput.listen('input', updateReload);
});

const selectInputs: PropSelect[] = [];
let tabId: number;

const sortProps = (p1: string, p2: string) => {
    const p1Index = propOrder.indexOf(p1);
    const p2Index = propOrder.indexOf(p2);
    if (p1Index >= 0) return p2Index >= 0 ? p1Index - p2Index : -1;
    if (p2Index >= 0) return 1;
    return p1.localeCompare(p2);
};

async function showInputs(message: PageInfoMessage) {
    const {vaultUrl, vaultUser, auth, secretPaths} = await settings.load();
    const secretInfos = findVaultPaths(secretPaths!, message.url);
    const secretProps = Array.from(new Set(secretInfos.flatMap((s) => s.keys))).sort(sortProps);
    const hostname = getHostname(message.url);
    if (secretProps.length && !selectInputs.length) {
        const listener = settings.saveInputSelection.bind(undefined, hostname);
        pageInputs.querySelector('h4[name="no-secret"]')?.remove();
        for (const prop of secretProps) {
            selectInputs.push(new PropSelect(pageInputs, prop, listener));
        }
        tabBar.activateTab(0);
    }
    const savedAuth = auth;

    const accessor = await SecretAccessor.newAccessor(vaultUrl!, secretInfos.map((secretInfo) => secretInfo.path), savedAuth?.token);

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
        const button = html<HTMLButtonElement>`
            <button class="mdc-button mdc-button--raised" ${inputCountAttr}="${matchingInputs.length}">
                <span class="mdc-button__ripple"></span>
                <span class="mdc-button__focus-ring"></span>
                <span class="mdc-button__label">${name}</span>
            </button>`;
        new MDCRipple(buttonDiv.appendChild(button));
        button.addEventListener('click', async () => {
            if (!accessor.secrets[secretInfo.path] && passwordInput.value.length > 0) {
                try {
                    const savedAuth = await vaultApi.login(vaultUrl!, vaultUser!, passwordInput.value);
                    await settings.saveToken(savedAuth);
                    await accessor.getSecrets(savedAuth.token);
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
