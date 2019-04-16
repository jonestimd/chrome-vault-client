import { MDCRipple } from '@material/ripple/index';
import { MDCTextField } from '@material/textfield/index';
document.querySelectorAll('.mdc-button').forEach(node => new MDCRipple(node));

import { MDCSnackbar } from '@material/snackbar';
const snackbar = new MDCSnackbar(document.querySelector('.mdc-snackbar'));

import * as settings from './settings';
import * as permissions from './permissions';
import * as vaultApi from './vaultApi';

import List from './components/List';

const urlInput = new MDCTextField(document.getElementById('vault-url').parentElement);
const usernameInput = new MDCTextField(document.getElementById('username').parentElement);
const passwordInput = new MDCTextField(document.getElementById('password').parentElement);
const statusArea = document.getElementById('status');
const loginButton = document.getElementById('login');
const logoutButton = document.getElementById('logout');
const reloadButton = document.getElementById('reload');
const urlList = new List(document.getElementById('saved-urls'));

function updateLoginButton() {
    loginButton.disabled = !urlInput.valid || !usernameInput.valid || !passwordInput.valid;
}

function setStatus(token) {
    if (token) statusArea.innerText = 'Logged in';
    else statusArea.innerText = 'Not logged in';
}

function showUrlPaths(urlPaths) {
    urlList.removeAll();
    Object.keys(urlPaths).sort().forEach(path => urlList.addItem(path));
}

settings.load().then(({vaultUrl, vaultUser, token, urlPaths}) => {
    if (vaultUrl) {
        urlInput.value = vaultUrl;
        usernameInput.focus();
    }
    else urlInput.getDefaultFoundation().adapter_.addClass('mdc-text-field--invalid');
    if (vaultUser) {
        usernameInput.value = vaultUser;
        if (urlInput.valid) passwordInput.focus();
    }
    else usernameInput.getDefaultFoundation().adapter_.addClass('mdc-text-field--invalid');
    passwordInput.getDefaultFoundation().adapter_.addClass('mdc-text-field--invalid');
    updateLoginButton();
    setStatus(token);
    showUrlPaths(urlPaths);
});

urlInput.listen('input', updateLoginButton);
usernameInput.listen('input', updateLoginButton);
passwordInput.listen('input', updateLoginButton);

function showAlert(message) {
    snackbar.labelText = message;
    snackbar.open();
}

loginButton.addEventListener('click', async () => {
    try {
        if (await permissions.requestOrigin(urlInput.value)) {
            const auth = await vaultApi.login(urlInput.value, usernameInput.value, passwordInput.value);
            setStatus(auth.client_token);
            if (!auth) showAlert('Did not get a token, please verify the base URL');
            await settings.save(urlInput.value, usernameInput.value, auth.client_token);
        }
        else showAlert('Need permission to access ' + urlInput.value);
    } catch (err) {
        showAlert('Error getting token: ' + err.message);
    }
});

logoutButton.addEventListener('click', async () => {
    await settings.clearToken();
    setStatus();
});

reloadButton.addEventListener('click', async () => {
    showUrlPaths(await settings.cacheUrlPaths());
});