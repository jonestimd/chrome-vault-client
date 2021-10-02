/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {MDCRipple} from '@material/ripple';
import {MDCLinearProgress} from '@material/linear-progress';
document.querySelectorAll('.mdc-button').forEach(node => new MDCRipple(node));

import {MDCTextField} from '@material/textfield';
const passwordInput = new MDCTextField(document.getElementById('password')!.parentElement!);
const filterInput = new MDCTextField(document.getElementById('vault-filter')!.parentElement!);
const statusArea = document.getElementById('status')!;
const pageInputsSwitch = document.getElementById('page-inputs-switch')!;
const pageInputs = document.getElementById('page-inputs')!;
const linearProgress = new MDCLinearProgress(document.querySelector('.mdc-linear-progress')!);
linearProgress.close();

import * as settings from './settings';
import * as permissions from './permissions';
import * as vaultApi from './vaultApi';
import {PageInfoMessage, InputInfo, LoginInput} from './message';
import {getMessage, getStatus} from './errors';
import UrlList from './components/UrlList';
import {createSpan} from './html';

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

pageInputsSwitch.addEventListener('click', () => {
    const icon = pageInputsSwitch.querySelector('i')!;
    if (icon.innerHTML === 'arrow_right') {
        icon.replaceChildren('arrow_drop_down');
        pageInputs.parentElement!.style.height = pageInputs.clientHeight + 'px';
    }
    else {
        icon.replaceChildren('arrow_right');
        pageInputs.parentElement!.style.height = '0';
    }
});

function pageMatcher(pageUrl: URL): (secret: vaultApi.SecretInfo) => boolean {
    return (secret) => {
        try {
            const url = new URL(secret.url);
            return url.hostname === pageUrl.hostname && url.port === pageUrl.port
                && pageUrl.pathname.startsWith(url.pathname)
                && pageUrl.search.includes(url.search);
        } catch (err) { // just the hostname
            return secret.url === pageUrl.hostname;
        }
    };
}

function findVaultPaths(urlPaths: vaultApi.UrlPaths, pageUrlString: string): vaultApi.SecretInfo[] {
    const filter = pageMatcher(new URL(pageUrlString));
    return Object.values(urlPaths).reduce((result: vaultApi.SecretInfo[], secrets) => {
        return result.concat(secrets.filter(filter));
    }, []);
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

    vaultUrl: string
    paths: string[]
    secrets: {[path: string]: vaultApi.Secret}

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
const compareHosts: Comparator<[string, vaultApi.SecretInfo[]]> = ([h1], [h2]) => h1.localeCompare(h2);

const urlList = new UrlList(document.getElementById('saved-urls')!);
function showUrlPaths(urlPaths?: vaultApi.UrlPaths) {
    urlList.removeAll();
    if (urlPaths) {
        Object.entries(urlPaths).sort(compareHosts).forEach(([siteUrl, secrets]) => urlList.addItem(siteUrl, secrets));
    }
}
filterInput.listen('input', () => {
    if (filterInput.value.length > 0) urlList.filterItems(filterInput.value);
    else urlList.showAll();
});

const reloadButton = document.getElementById('reload') as HTMLButtonElement;
settings.load().then(({vaultUrl, vaultUser, token, urlPaths}) => {
    document.querySelector<HTMLElement>('#username')!.replaceChildren(vaultUser ?? '');
    showUrlPaths(urlPaths);
    reloadButton.addEventListener('click', async () => {
        try {
            linearProgress.open();
            if (!token) token = await login(vaultUrl!, vaultUser!);
            showStatus('');
            showUrlPaths(await settings.cacheUrlPaths());
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

chrome.runtime.onMessage.addListener(async function (message: PageInfoMessage, sender: chrome.runtime.MessageSender) {
    const {vaultUrl, vaultUser, token, urlPaths} = await settings.load();
    document.querySelector<HTMLElement>('#username')!.replaceChildren(vaultUser ?? '');
    const secretInfos = findVaultPaths(urlPaths!, message.url);
    let vaultToken = token;

    const accessor = await SecretAccessor.newAccessor(vaultUrl!, secretInfos.map(secretInfo => secretInfo.path), vaultToken!);

    if (message.inputs.length > 0) {
        pageInputs.replaceChildren();
        message.inputs.forEach(input => {
            const div = pageInputs.appendChild(document.createElement('div'));
            div.classList.add('input-info');

            function appendAttribute(prop: keyof InputInfo) {
                if (input[prop]) {
                    const row = div.appendChild(document.createElement('div'));
                    row.classList.add('row');
                    row.replaceChildren(createSpan({text: prop, className: 'label'}), createSpan({text: input[prop] as string}));
                }
            }

            InputInfo.displayProps.forEach(prop => appendAttribute(prop));
        });
    }

    const buttonDiv = document.querySelector('div.buttons')!;
    buttonDiv.replaceChildren();
    const buttons = secretInfos.map(secretInfo => {
        const matchingInputs = message.inputs.filter(input => vaultApi.hasSecretValue(input, secretInfo));
        const name = secretInfo.path.replace(/^.*\//, '');
        const button = document.createElement('button');
        button.className = 'mdc-button mdc-button--raised';
        button.setAttribute(inputCountAttr, String(matchingInputs.length));
        button.replaceChildren(createSpan({text: name, className: 'mdc-button__label'}));
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
            if (accessor.secrets[secretInfo.path]) {
                const secretData = accessor.secrets[secretInfo.path];
                const inputs = message.inputs.reduce((inputs: LoginInput[], input) => {
                    const {inputProp, key, value} = secretData.findValue(input) || {} as vaultApi.InputMatch;
                    if (inputProp && value) {
                        if (key !== 'password' || input.type === 'password') {
                            if (inputProp === 'label') return inputs.concat({label: input[inputProp], value});
                            else return inputs.concat({selector: `input[${inputProp}="${input[inputProp]}"]`, value});
                        }
                    }
                    if (input.type === 'password' && secretData.password) {
                        return inputs.concat({selector: 'input[type="password"]', value: secretData.password});
                    }
                    return inputs;
                }, []);
                chrome.tabs.sendMessage(sender.tab!.id!, inputs);
            }
        });
        return button;
    });

    function updateButtons() {
        const disableButtons = !accessor.haveSecrets && passwordInput.value.length === 0;
        buttons.forEach(button => button.disabled = disableButtons || button.getAttribute(inputCountAttr) === '0');
    }
    updateButtons();
    passwordInput.listen('input', updateButtons);
});

chrome.runtime.getPlatformInfo((info) => {
    const isAndroid = info.os.toLowerCase().includes('android');
    chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
        if (tab?.url && /^https?:/.test(tab.url)) chrome.tabs.executeScript({file: 'contentScript.js', allFrames: true});
        chrome.tabs.onCreated.addListener(() => {
            if (isAndroid) tab?.id && chrome.tabs.remove(tab.id);
            else window.close();
        });
    });
});
