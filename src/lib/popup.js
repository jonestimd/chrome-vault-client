import { MDCRipple } from '@material/ripple/index';
document.querySelectorAll('.mdc-button').forEach(node => new MDCRipple(node));

import { MDCTextField } from '@material/textfield/index';
const passwordInput = new MDCTextField(document.getElementById('password').parentElement);

const fillBothButton = document.getElementById('fill-both');
const fillUserButton = document.getElementById('fill-user');
const fillPasswordButton = document.getElementById('fill-password');
const statusArea = document.getElementById('status');

import * as settings from './settings';
import * as vaultApi from './vaultApi';

function isMatch(urlString, pageUrl) {
    try {
        const url = new URL(urlString);
        return url.hostname === pageUrl.hostname && url.port === pageUrl.port
            && pageUrl.pathname.startsWith(url.pathname)
            && pageUrl.search.includes(url.search);
    } catch (err) { // just the hostname
        return urlString === pageUrl.hostname;
    }
}

function findPath(urlPaths, pageUrlString) {
    const pageUrl = new URL(pageUrlString);
    return Object.entries(urlPaths).find(([entryUrlString]) => isMatch(entryUrlString, pageUrl))[1];
}

chrome.runtime.onMessage.addListener(async function (message, sender) {
    const { vaultUrl, vaultUser, token, urlPaths } = await settings.load();
    const config = findPath(urlPaths, message.url);
    let vaultToken = token;

    function updateButtons() {
        if (vaultToken || passwordInput.value.length > 0) {
            fillUserButton.disabled = !(message.user && config.username);
            fillPasswordButton.disabled = !(message.password && config.password);
            fillBothButton.disabled = fillUserButton.disabled || fillPasswordButton.disabled;
        }
        else fillBothButton.disabled = fillUserButton.disabled = fillPasswordButton.disabled = true;
    }
    updateButtons();

    async function getSecret() {
        try {
            return await vaultApi.getSecret(vaultUrl, vaultToken, config.path);
        } catch (err) {
            if (err.status === 403) {
                if (passwordInput.value.length > 0) {
                    try {
                        vaultToken = (await vaultApi.login(vaultUrl, vaultUser, passwordInput.value)).client_token;
                        await settings.saveToken(vaultToken);
                        statusArea.innerText = '';
                    } catch (err) {
                        statusArea.innerText = 'Error: ' + err.message;
                        updateButtons();
                    }
                }
                else {
                    statusArea.innerText = 'Invalid token';
                    vaultToken = undefined;
                    updateButtons();
                }
            }
            else statusArea.innerText = 'Error: ' + vaultApi.getErrorMessage(err);
        }
    }

    let secret = await getSecret(vaultUrl, config.path);

    async function fillForm(fillUser, fillPassword) {
        if (!secret) secret = await getSecret(vaultUrl, config.path);
        if (secret) {
            const message = {};
            if (fillUser) message.username = secret.username;
            if (fillPassword) message.password = secret.password;
            chrome.tabs.sendMessage(sender.tab.id, message);
        }
    }

    fillUserButton.addEventListener('click', () => fillForm(true, false));
    fillPasswordButton.addEventListener('click', () => fillForm(false, true));
    fillBothButton.addEventListener('click', () => fillForm(true, true));
    passwordInput.listen('input', updateButtons);
});

chrome.tabs.executeScript({ file: 'contentScript.js' });
