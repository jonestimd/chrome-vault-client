import {MDCRipple} from '@material/ripple';
import {MDCTextField} from '@material/textfield';
document.querySelectorAll('.mdc-button').forEach(node => new MDCRipple(node));

import {MDCSnackbar} from '@material/snackbar';
const snackbar = new MDCSnackbar(document.querySelector('.mdc-snackbar'));

import * as settings from './settings';
import * as permissions from './permissions';
import * as vaultApi from './vaultApi';

import UrlCardList from './components/UrlCardList';

const urlInput = new MDCTextField(document.getElementById('vault-url').parentElement);
const pathInput = new MDCTextField(document.getElementById('vault-path').parentElement);
const usernameInput = new MDCTextField(document.getElementById('username').parentElement);
const passwordInput = new MDCTextField(document.getElementById('password').parentElement);
const filterInput = new MDCTextField(document.getElementById('vault-filter').parentElement);
const statusArea = document.getElementById('status');
const logoutButton = document.getElementById('logout') as HTMLButtonElement;
const reloadButton = document.getElementById('reload') as HTMLButtonElement;
const urlList = new UrlCardList(document.getElementById('saved-urls'));
const progressOverlay = document.querySelector('.progress-overlay');

let savedUrl: string, savedToken: string, unsaved = false;

function onInputChange() {
    reloadButton.disabled = !(urlInput.valid && usernameInput.valid && (savedToken || passwordInput.value.length > 0));
    unsaved = true;
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

settings.load().then(({vaultUrl, vaultPath, vaultUser, token, urlPaths}: settings.Settings) => {
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
    if (urlPaths) showUrlPaths(urlPaths);
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
        if (savedToken) await vaultApi.logout(savedUrl, savedToken);
        savedToken = undefined;
        onInputChange();
    } catch (err) {
        if (err.status === 403) savedToken = undefined;
        else showAlert('Error revoking token: ' + err.message);
    }
    await settings.clearToken();
    setStatus(savedToken);
});

function removeClass(element: Element, toRemove: string) {
    element.className = element.className.split(/ +/).filter(name => name !== toRemove).join(' ');
}

function addClass(element: Element, toAdd: string) {
    const classList = element.className.split(/ +/);
    element.className = classList.includes(toAdd) ? element.className : `${element.className} ${toAdd}`;
}

reloadButton.addEventListener('click', async () => {
    try {
        removeClass(progressOverlay, 'hidden');
        if (unsaved || !savedToken) await login();
        showUrlPaths(await settings.cacheUrlPaths());
    } catch (err) {
        if (err.status === 403) {
            savedToken = undefined;
            setStatus();
            showAlert('Need a token');
        }
        else showAlert(err.message);
    } finally {
        addClass(progressOverlay, 'hidden');
    }
});

filterInput.listen('input', () => {
    if (filterInput.value.length > 0) urlList.filterCards(filterInput.value);
    else urlList.showAll();
});