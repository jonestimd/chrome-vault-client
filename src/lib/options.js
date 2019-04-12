import agent from 'superagent';
import {MDCRipple} from '@material/ripple/index';
import {MDCTextField} from '@material/textfield/index';
document.querySelectorAll('.mdc-button').forEach(node => new MDCRipple(node));

import {MDCSnackbar} from '@material/snackbar';
const snackbar = new MDCSnackbar(document.querySelector('.mdc-snackbar'));

import * as config from './config';
import * as permissions from './permissions';

const urlInput = new MDCTextField(document.getElementById('vault-url').parentElement);
const usernameInput = new MDCTextField(document.getElementById('username').parentElement);
const passwordInput = new MDCTextField(document.getElementById('password').parentElement);

const saveButton = document.getElementById('save');

function updateSaveButton() {
    saveButton.disabled = !urlInput.valid || !usernameInput.valid;
}

config.load().then(config => {
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
        // TODO show progress or spinner?
        if (await permissions.requestOrigin(urlInput.value)) {
            const {body} = await agent.post(`${urlInput.value}/v1/auth/userpass/login/${usernameInput.value}`,
                {password: passwordInput.value});
            if (body && body.auth.client_token) snackbar.labelText = 'Got a token';
            else snackbar.labelText = 'Did not get a token, please verify the base URL';
            // todo where to store token?
            // chrome.storage.session.set({'vault-token': body.auth.client_token});
            await config.save(urlInput.value, usernameInput.value);
        }
        else {
            snackbar.labelText = 'Need permission to access ' + urlInput.value;
        }
    } catch (err) {
        snackbar.labelText = 'Error getting token: ' + err.message;
    }
    snackbar.open();
});