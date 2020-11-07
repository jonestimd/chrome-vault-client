import {MDCRipple} from '@material/ripple';
document.querySelectorAll('.mdc-button').forEach(node => new MDCRipple(node));

import {MDCTextField} from '@material/textfield';
const passwordInput = new MDCTextField(document.getElementById('password').parentElement);
const statusArea = document.getElementById('status');
const pageInputsSwitch = document.getElementById('page-inputs-switch');
const pageInputs = document.getElementById('page-inputs');

import * as settings from './settings';
import * as vaultApi from './vaultApi';
import {PageInfoMessage, InputInfo, LoginInput} from './message';

pageInputsSwitch.addEventListener('click', () => {
    const icon = pageInputsSwitch.querySelector('i');
    if (icon.innerHTML === 'arrow_right') {
        icon.innerHTML = 'arrow_drop_down';
        pageInputs.parentElement.style.height = pageInputs.clientHeight + 'px';
    }
    else {
        icon.innerHTML = 'arrow_right';
        pageInputs.parentElement.style.height = '0';
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
            for (const path of this.paths) {
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

const inputCountAttr = 'data-inputs';

chrome.runtime.onMessage.addListener(async function (message: PageInfoMessage, sender: chrome.runtime.MessageSender) {
    const {vaultUrl, vaultUser, token, urlPaths} = await settings.load();
    document.querySelector<HTMLElement>('#username').innerText = vaultUser;
    const secretInfos = findVaultPaths(urlPaths, message.url);
    let vaultToken = token;

    const accessor = await SecretAccessor.newAccessor(vaultUrl, secretInfos.map(secretInfo => secretInfo.path), vaultToken);

    if (message.inputs.length > 0) {
        pageInputs.innerHTML = '';
        message.inputs.forEach(input => {
            const div = pageInputs.appendChild(document.createElement('div'));
            div.classList.add('input-info');

            function appendAttribute(prop: keyof InputInfo) {
                if (input[prop]) {
                    const row = div.appendChild(document.createElement('div'));
                    row.classList.add('row');
                    row.innerHTML = `<span class="label">${prop}</span><span>${input[prop]}</span>`;
                }
            }

            InputInfo.displayProps.forEach(prop => appendAttribute(prop));
        });
    }

    const buttonDiv = document.querySelector('div.buttons');
    buttonDiv.innerHTML = '';
    const buttons = secretInfos.map(secretInfo => {
        const matchingInputs = message.inputs.filter(input => vaultApi.hasSecretValue(input, secretInfo));
        const name = secretInfo.path.replace(/^.*\//, '');
        const button = document.createElement('button');
        button.className = 'mdc-button mdc-button--raised';
        button.setAttribute(inputCountAttr, String(matchingInputs.length));
        button.innerHTML = `<span class="mdc-button__label">${name}</span>`;
        buttonDiv.appendChild(button);
        button.addEventListener('click', async () => {
            if (!accessor.secrets[secretInfo.path] && passwordInput.value.length > 0) {
                try {
                    vaultToken = (await vaultApi.login(vaultUrl, vaultUser, passwordInput.value)).client_token;
                    await settings.saveToken(vaultToken);
                    await accessor.getSecrets(vaultToken);
                } catch (err) {
                    statusArea.innerText = 'Error: ' + err.message;
                }
            }
            if (accessor.secrets[secretInfo.path]) {
                const secretData = accessor.secrets[secretInfo.path];
                const inputs: LoginInput[] = message.inputs.reduce((inputs, input) => {
                    const {inputProp, key, value} = secretData.findValue(input) || {} as vaultApi.InputMatch;
                    if (inputProp) {
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
                chrome.tabs.sendMessage(sender.tab.id, inputs);
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

chrome.tabs.executeScript({file: 'contentScript.js', allFrames: true});
