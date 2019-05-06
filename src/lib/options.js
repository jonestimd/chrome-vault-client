import { MDCRipple } from '@material/ripple/index';
import { MDCTextField } from '@material/textfield/index';
document.querySelectorAll('.mdc-button').forEach(node => new MDCRipple(node));

import { MDCSnackbar } from '@material/snackbar';
const snackbar = new MDCSnackbar(document.querySelector('.mdc-snackbar'));

import * as settings from './settings';
import * as permissions from './permissions';
import * as vaultApi from './vaultApi';

import UrlCardList from './components/UrlCardList';

const urlInput = new MDCTextField(document.getElementById('vault-url').parentElement);
const usernameInput = new MDCTextField(document.getElementById('username').parentElement);
const passwordInput = new MDCTextField(document.getElementById('password').parentElement);
const statusArea = document.getElementById('status');
const loginButton = document.getElementById('login');
const logoutButton = document.getElementById('logout');
const reloadButton = document.getElementById('reload');
const urlList = new UrlCardList(document.getElementById('saved-urls'));

function updateLoginButton() {
    loginButton.disabled = !urlInput.valid || !usernameInput.valid || passwordInput.value.length === 0;
}

function setStatus(token) {
    statusArea.innerText = token ? 'Logged in' : 'Not logged in';
    logoutButton.disabled = !token;
}

const getHost = (url) => {
    try {
        return new URL(url).hostname;
    } catch (err) {
        return url;
    }
};

const compareUrls = ([u1], [u2]) => getHost(u1).localeCompare(getHost(u2));

function showUrlPaths(urlPaths) {
    urlList.removeAll();
    Object.entries(urlPaths).sort(compareUrls).forEach(([url, configs]) => {
        urlList.addCard(url, configs.map(config => config.path).sort());
    });
}

let savedUrl, savedToken;

settings.load().then(({ vaultUrl, vaultUser, token, urlPaths }) => {
    savedUrl = vaultUrl;
    savedToken = token;
    if (vaultUrl) {
        urlInput.value = vaultUrl;
        usernameInput.focus();
    }
    else {
        urlInput.getDefaultFoundation().adapter_.addClass('mdc-text-field--invalid');
        passwordInput.required = true;
        passwordInput.getDefaultFoundation().adapter_.addClass('mdc-text-field--invalid');
    }
    if (vaultUser) {
        usernameInput.value = vaultUser;
        if (urlInput.valid) passwordInput.focus();
    }
    else usernameInput.getDefaultFoundation().adapter_.addClass('mdc-text-field--invalid');
    updateLoginButton();
    setStatus(token);
    if (urlPaths) showUrlPaths(urlPaths);
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
            if (!auth || !auth.client_token) showAlert('Did not get a token, please verify the base URL');
            else {
                setStatus(auth.client_token);
                savedUrl = urlInput.value;
                savedToken = auth.client_token;
                await settings.save(urlInput.value, usernameInput.value, auth.client_token, auth.lease_duration); // seconds
            }
        }
        else showAlert('Need permission to access ' + urlInput.value);
    } catch (err) {
        showAlert('Error getting token: ' + err.message);
    }
});

logoutButton.addEventListener('click', async () => {
    try {
        if (savedToken) await vaultApi.logout(savedUrl, savedToken);
        savedToken = undefined;
    } catch (err) {
        if (err.status === 403) savedToken = undefined;
        else showAlert('Error revoking token: ' + err.message);
    }
    await settings.clearToken();
    setStatus(savedToken);
});

reloadButton.addEventListener('click', async () => {
    try {
        showUrlPaths(await settings.cacheUrlPaths());
    } catch (err) {
        if (err.status === 403) {
            savedToken = undefined;
            setStatus();
            showAlert('Need a token');
        }
        else showAlert(err.message);
    }
});