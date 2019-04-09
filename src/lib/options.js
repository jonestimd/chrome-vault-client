import agent from 'superagent';
import {MDCRipple} from '@material/ripple/index';
import {MDCTextField} from '@material/textfield/index';
document.querySelectorAll('.mdc-button').forEach(node => new MDCRipple(node));

import {MDCSnackbar} from '@material/snackbar';
const snackbar = new MDCSnackbar(document.querySelector('.mdc-snackbar'));

import {getConfig} from './storage';

const urlInput = new MDCTextField(document.getElementById('vault-url').parentElement);
const usernameInput = new MDCTextField(document.getElementById('username').parentElement);
const passwordInput = new MDCTextField(document.getElementById('password').parentElement);

const saveButton = document.getElementById('save');

function updateSaveButton() {
    saveButton.disabled = !urlInput.valid || !usernameInput.valid;
}

getConfig().then(config => {
    if (config.vaultUrl) urlInput.value = config.vaultUrl;
    else urlInput.getDefaultFoundation().adapter_.addClass('mdc-text-field--invalid');
    if (config.vaultUser) usernameInput.value = config.vaultUser;
    else usernameInput.getDefaultFoundation().adapter_.addClass('mdc-text-field--invalid');
    updateSaveButton();
});

urlInput.listen('input', updateSaveButton);
usernameInput.listen('input', updateSaveButton);

saveButton.addEventListener('click', async () => {
    try {
        const {body} = await agent.post(`${urlInput.value}/v1/auth/userpass/login/${usernameInput.value}`,
            {password: passwordInput.value});
        snackbar.labelText = 'Got a token'
        // todo where to store token?
        // chrome.storage.session.set({'vault-token': body.auth.client_token});
        chrome.storage.local.set({'vault-url': urlInput.value});
        chrome.storage.local.set({'vault-user': usernameInput.value});
    } catch (err) {
        snackbar.labelText = 'Token error: ' + err.message;
    }
    snackbar.open();
});