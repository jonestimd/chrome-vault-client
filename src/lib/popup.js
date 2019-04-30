import {MDCRipple} from '@material/ripple/index';
document.querySelectorAll('.mdc-button').forEach(node => new MDCRipple(node));

import {MDCTextField} from '@material/textfield/index';
const passwordInput = new MDCTextField(document.getElementById('password').parentElement);

const fillBothButton = document.getElementById('fill-both');
const fillUserButton = document.getElementById('fill-user');
const fillPasswordButton = document.getElementById('fill-password');

fillBothButton.disabled = fillUserButton.disabled = fillPasswordButton.disabled = true;

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
    const match = Object.entries(urlPaths).find(([entryUrlString]) => isMatch(entryUrlString, pageUrl));
    return match && match[1];
}

chrome.runtime.onMessage.addListener(async function(message, sender) {
    const {vaultUrl, vaultUser, token, urlPaths} = await settings.load();
    document.querySelector('#username').innerText = vaultUser;
    const config = findPath(urlPaths, message.url);
    let vaultToken = token;

    function updateButtons(haveSecret) {
        if (haveSecret || vaultToken || passwordInput.value.length > 0) {
            fillUserButton.disabled = !(message.username && config.username);
            fillPasswordButton.disabled = !(message.password && config.password);
            fillBothButton.disabled = fillUserButton.disabled || fillPasswordButton.disabled;
        }
        else {
            statusArea.innerText = 'Need a Vault token';
            fillBothButton.disabled = fillUserButton.disabled = fillPasswordButton.disabled = true;
        }
    }

    async function getSecret() {
        try {
            statusArea.innerText = '';
            return await vaultApi.getSecret(vaultUrl, vaultToken, config.path);
        } catch (err) {
            if (err.status === 403) {
                if (passwordInput.value.length > 0) {
                    try {
                        vaultToken = (await vaultApi.login(vaultUrl, vaultUser, passwordInput.value)).client_token;
                        await settings.saveToken(vaultToken);
                        statusArea.innerText = '';
                        return await vaultApi.getSecret(vaultUrl, vaultToken, config.path);
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

    if (config) {
        let secret = vaultToken && await getSecret(vaultUrl, config.path);
        updateButtons(Boolean(secret));

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
    }
});

chrome.tabs.executeScript({file: 'contentScript.js', allFrames: true});
