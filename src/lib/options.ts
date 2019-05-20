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
const filterInput = new MDCTextField(document.getElementById('vault-filter').parentElement);
const statusArea = document.getElementById('status');
const loginButton = document.getElementById('login') as HTMLButtonElement;
const logoutButton = document.getElementById('logout') as HTMLButtonElement;
const reloadButton = document.getElementById('reload') as HTMLButtonElement;
const urlList = new UrlCardList(document.getElementById('saved-urls'));

function updateLoginButton() {
    loginButton.disabled = !urlInput.valid || !usernameInput.valid || passwordInput.value.length === 0;
}

function setStatus(token?: string) {
    statusArea.innerText = token ? 'Logged in' : 'Not logged in';
    logoutButton.disabled = !token;
}

type Comparator<T> = (t1: T, t2: T) => number;

const compareHosts: Comparator<[string, vaultApi.SecretInfo[]]> = ([h1], [h2]) => h1.localeCompare(h2);

function pluck<T, K extends keyof T>(items: T[], key: K): T[K][] {
    return items.map(item => item[key]);
}

function showUrlPaths(urlPaths: vaultApi.UrlPaths) {
    urlList.removeAll();
    Object.entries(urlPaths).sort(compareHosts).forEach(([host, secrets]) => {
        urlList.addCard(host, pluck(secrets, 'url'), pluck(secrets, 'path'));
    });
}

let savedUrl: string, savedToken: string;

settings.load().then(({ vaultUrl, vaultUser, token, urlPaths }: settings.Settings) => {
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
    updateLoginButton();
    setStatus(token);
    if (urlPaths) showUrlPaths(urlPaths);
});

urlInput.listen('input', updateLoginButton);
usernameInput.listen('input', updateLoginButton);
passwordInput.listen('input', updateLoginButton);

function showAlert(message: string) {
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
                await settings.save(urlInput.value, usernameInput.value, auth.client_token);
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

filterInput.listen('input', () => {
    if (filterInput.value.length > 0) urlList.filterCards(filterInput.value);
    else urlList.showAll();
});