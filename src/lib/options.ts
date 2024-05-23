/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {MDCRipple} from '@material/ripple';
import {MDCTextField} from '@material/textfield';
import {MDCLinearProgress} from '@material/linear-progress';
document.querySelectorAll('.mdc-button').forEach((node) => new MDCRipple(node));

import {MDCSnackbar} from '@material/snackbar';
const snackbar = new MDCSnackbar(document.querySelector('.mdc-snackbar')!);

import * as settings from './settings';
import * as permissions from './permissions';
import * as vaultApi from './vaultApi';

import {getMessage, getStatus} from './errors';

const urlInput = new MDCTextField(document.getElementById('vault-url')!.parentElement!);
const pathInput = new MDCTextField(document.getElementById('vault-path')!.parentElement!);
const usernameInput = new MDCTextField(document.getElementById('username')!.parentElement!);
const passwordInput = new MDCTextField(document.getElementById('password')!.parentElement!);
const statusArea = document.getElementById('status');
const logoutButton = document.getElementById('logout') as HTMLButtonElement;
const saveButton = document.getElementById('save') as HTMLButtonElement;
const linearProgress = new MDCLinearProgress(document.querySelector('.mdc-linear-progress')!);
linearProgress.close();

let savedUrl: string | undefined, savedAuth: vaultApi.AuthToken | undefined, unsaved = false;

function onInputChange() {
    saveButton.disabled = !(urlInput.valid && usernameInput.valid && (savedAuth || passwordInput.value.length > 0));
    unsaved = true;
}

function setStatus(token?: string) {
    statusArea!.innerText = token ? 'Logged in' : 'Not logged in';
    logoutButton.disabled = !token;
}

settings.load().then(({vaultUrl, vaultPath, vaultUser, auth}: settings.Settings) => {
    savedUrl = vaultUrl;
    savedAuth = auth;
    if (vaultUrl) {
        urlInput.value = vaultUrl;
        usernameInput.focus();
    }
    else {
        urlInput.getDefaultFoundation().setValid(false);
        passwordInput.required = true;
        passwordInput.getDefaultFoundation().setValid(false);
    }
    if (vaultUser) {
        usernameInput.value = vaultUser;
        if (urlInput.valid) passwordInput.focus();
    }
    else usernameInput.getDefaultFoundation().setValid(false);
    pathInput.value = vaultPath || '';
    onInputChange();
    setStatus(auth?.token);
    unsaved = false;
});

urlInput.listen('input', onInputChange);
pathInput.listen('input', () => unsaved = true);
usernameInput.listen('input', onInputChange);
passwordInput.listen('input', onInputChange);

function showAlert(message: string) {
    snackbar.labelText = message;
    snackbar.open();
}

async function login() {
    if (await permissions.requestOrigin(urlInput.value)) {
        savedAuth = await vaultApi.login(urlInput.value, usernameInput.value, passwordInput.value);
        setStatus(savedAuth.token);
        if (savedAuth.token) {
            savedUrl = urlInput.value;
            await settings.save(urlInput.value, pathInput.value, usernameInput.value, savedAuth);
            unsaved = false;
        }
        else showAlert('Did not get a token, please verify the base URL');
    }
    else throw new Error('Need permission to access ' + urlInput.value);
}

logoutButton.addEventListener('click', async () => {
    try {
        if (savedAuth) await vaultApi.logout(savedUrl!, savedAuth.token);
        savedAuth = undefined;
        onInputChange();
    } catch (err) {
        if (getStatus(err) === 403) savedAuth = undefined;
        else showAlert('Error revoking token: ' + getMessage(err));
    }
    await settings.clearToken();
    setStatus(savedAuth?.token);
});

saveButton.addEventListener('click', async () => {
    try {
        linearProgress.open();
        if (unsaved || !savedAuth) await login();
        await settings.cacheSecretInfo();
    } catch (err) {
        if (getStatus(err) === 403) {
            savedAuth = undefined;
            setStatus();
            showAlert('Need a token');
        }
        else showAlert(getMessage(err) ?? 'Error with no message??');
    } finally {
        linearProgress.close();
    }
});

chrome.storage.local.onChanged.addListener(({auth}) => {
    if (auth) {
        savedAuth = auth.newValue;
        setStatus(savedAuth?.token);
    }
});
