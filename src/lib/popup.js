import { MDCRipple } from '@material/ripple/index';
document.querySelectorAll('.mdc-button').forEach(node => new MDCRipple(node));

const fillBothButton = document.getElementById('fill-both');
const fillUserButton = document.getElementById('fill-user');
const fillPasswordButton = document.getElementById('fill-password');

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
    return Object.entries(urlPaths).find(([entryUrlString]) => isMatch(entryUrlString, pageUrl));
}

chrome.runtime.onMessage.addListener(async function (message, sender) {
    const { vaultUrl, token, urlPaths } = await settings.load();
    const [entryUrlString, config] = findPath(urlPaths, message.url);
    console.log('config', config);
    if (config) {
        fillUserButton.disabled = !(message.user && config.username);
        fillPasswordButton.disabled = !(message.password && config.password);
        fillBothButton.disabled = fillUserButton.disabled || fillPasswordButton.disabled;
    }
    else fillBothButton.disabled = fillUserButton.disabled = fillPasswordButton.disabled = true;

    async function fillForm(fillUser, fillPassword) {
        const secret = await vaultApi.getSecret(vaultUrl, token, config.path);
        const message = {};
        if (fillUser) message.username = secret.username;
        if (fillPassword) message.password = secret.password;
        console.log('sening message');
        chrome.tabs.sendMessage(sender.tab.id, message);
    }

    fillUserButton.addEventListener('click', () => fillForm(true, false));
    fillPasswordButton.addEventListener('click', () => fillForm(false, true));
    fillBothButton.addEventListener('click', () => fillForm(true, true));
});

chrome.tabs.executeScript({ file: 'contentScript.js' });
