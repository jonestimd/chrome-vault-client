import {MDCRipple} from '@material/ripple/index';
document.querySelectorAll('.mdc-button').forEach(node => new MDCRipple(node));

import {MDCTextField} from '@material/textfield/index';
const passwordInput = new MDCTextField(document.getElementById('password').parentElement);

const statusArea = document.getElementById('status');

import * as settings from './settings';
import * as vaultApi from './vaultApi';
import { PageInfoMessage } from './message';

function isMatch(urlString: string, pageUrl: URL) {
    try {
        const url = new URL(urlString);
        return url.hostname === pageUrl.hostname && url.port === pageUrl.port
            && pageUrl.pathname.startsWith(url.pathname)
            && pageUrl.search.includes(url.search);
    } catch (err) { // just the hostname
        return urlString === pageUrl.hostname;
    }
}

function findVaultPaths(urlPaths: vaultApi.UrlPaths, pageUrlString: string) {
    const pageUrl = new URL(pageUrlString);
    const entries = Object.entries(urlPaths).filter(([entryUrlString]) => isMatch(entryUrlString, pageUrl));
    return entries.reduce((configs, entry) => configs.concat(entry[1].map(config => config.path)), []);
}

class SecretAccessor {
    static async newAccessor(vaultUrl: string, paths: string[], vaultToken: string) {
        const accessor = new SecretAccessor(vaultUrl, paths);
        if (vaultToken) await accessor.getSecrets(vaultToken);
        else statusArea.innerText = 'Need a Vault token';
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
            statusArea.innerText = '';
            for (let path of this.paths) {
                this.secrets[path] = await vaultApi.getSecret(this.vaultUrl, vaultToken, path);
            }
        } catch (err) {
            if (err.status === 403) statusArea.innerText = 'Invalid token';
            else statusArea.innerText = 'Error: ' + vaultApi.getErrorMessage(err);
        }
    }

    get haveSecrets() {
        return this.paths.length === Object.keys(this.secrets).length;
    }
}

chrome.runtime.onMessage.addListener(async function(message: PageInfoMessage, sender: chrome.runtime.MessageSender) {
    const {vaultUrl, vaultUser, token, urlPaths} = await settings.load();
    document.querySelector<HTMLElement>('#username').innerText = vaultUser;
    const vaultPaths = findVaultPaths(urlPaths, message.url);
    let vaultToken = token;

    const accessor = await SecretAccessor.newAccessor(vaultUrl, vaultPaths, vaultToken);

    const buttonDiv = document.querySelector('div.buttons');
    buttonDiv.innerHTML = '';
    const buttons = vaultPaths.map(path => {
        const name = path.replace(/^.*\//, '');
        const button = document.createElement('button');
        button.className = 'mdc-button mdc-button--raised';
        button.innerHTML = `<span class="mdc-button__label">${name}</span>`;
        buttonDiv.appendChild(button);
        button.addEventListener('click', async () => {
            if (!accessor.secrets[path] && passwordInput.value.length > 0) {
                try {
                    vaultToken = (await vaultApi.login(vaultUrl, vaultUser, passwordInput.value)).client_token;
                    await settings.saveToken(vaultToken);
                    await accessor.getSecrets(vaultToken);
                } catch (err) {
                    statusArea.innerText = 'Error: ' + err.message;
                }
            }
            if (accessor.secrets[path]) {
                const {username, password} = accessor.secrets[path];
                chrome.tabs.sendMessage(sender.tab.id, {username, password});
            }
        });
        return button;
    });

    function updateButtons() {
        const noInputs = !message.username && !message.password;
        const disableButtons = noInputs || !accessor.haveSecrets && passwordInput.value.length === 0;
        buttons.forEach(button => button.disabled = disableButtons);
    }
    updateButtons();
    passwordInput.listen('input', updateButtons);
});

chrome.tabs.executeScript({file: 'contentScript.js', allFrames: true});
