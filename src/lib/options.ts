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

let savedUrl: string | undefined, savedToken: string | undefined, unsaved = false;

function onInputChange() {
    saveButton.disabled = !(urlInput.valid && usernameInput.valid && (savedToken || passwordInput.value.length > 0));
    unsaved = true;
}

function setStatus(token?: string) {
    statusArea!.innerText = token ? 'Logged in' : 'Not logged in';
    logoutButton.disabled = !token;
}

settings.load().then(({vaultUrl, vaultPath, vaultUser, token}: settings.Settings) => {
    savedUrl = vaultUrl;
    savedToken = token;
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
    setStatus(token);
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
        const auth = await vaultApi.login(urlInput.value, usernameInput.value, passwordInput.value);
        if (!auth || !auth.client_token) throw new Error('Did not get a token, please verify the base URL');
        else {
            setStatus(auth.client_token);
            savedUrl = urlInput.value;
            savedToken = auth.client_token;
            await settings.save(urlInput.value, pathInput.value, usernameInput.value, auth.client_token);
            unsaved = false;
        }
    }
    else throw new Error('Need permission to access ' + urlInput.value);
}

logoutButton.addEventListener('click', async () => {
    try {
        if (savedToken) await vaultApi.logout(savedUrl!, savedToken);
        savedToken = undefined;
        onInputChange();
    } catch (err) {
        if (getStatus(err) === 403) savedToken = undefined;
        else showAlert('Error revoking token: ' + getMessage(err));
    }
    await settings.clearToken();
    setStatus(savedToken);
});

saveButton.addEventListener('click', async () => {
    try {
        linearProgress.open();
        if (unsaved || !savedToken) await login();
        await settings.cacheSecretPaths();
    } catch (err) {
        if (getStatus(err) === 403) {
            savedToken = undefined;
            setStatus();
            showAlert('Need a token');
        }
        else showAlert(getMessage(err) ?? 'Error with no message??');
    } finally {
        linearProgress.close();
    }
});
