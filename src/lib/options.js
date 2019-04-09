import agent from 'superagent';
import {MDCRipple} from '@material/ripple/index';
import {MDCTextField} from '@material/textfield/index';
document.querySelectorAll('.mdc-button').forEach(node => new MDCRipple(node));

const urlInput = new MDCTextField(document.getElementById('vault-url').parentElement);
const usernameInput = new MDCTextField(document.getElementById('username').parentElement);
const passwordInput = new MDCTextField(document.getElementById('password').parentElement);

const saveButton = document.getElementById('save');

function updateSaveButton() {
    saveButton.disabled = !urlInput.valid || !usernameInput.valid;
}

chrome.storage.local.get(['vault-url', 'vault-user'], (result) => {
    if (result['vault-url']) urlInput.value = result['vault-url'];
    else urlInput.getDefaultFoundation().adapter_.addClass('mdc-text-field--invalid');
    if (result['vault-user']) usernameInput.value = result['vault-user'];
    else usernameInput.getDefaultFoundation().adapter_.addClass('mdc-text-field--invalid');
    updateSaveButton();
});

urlInput.listen('input', updateSaveButton);
usernameInput.listen('input', updateSaveButton);

saveButton.addEventListener('click', async () => {
    try {
        const {body} = await agent.post(`${urlInput.value}/v1/auth/userpass/login/${usernameInput.value}`,
            {password: passwordInput.value});
        chrome.storage.session.set({'vault-token': body.auth.client_token});
        chrome.storage.local.set({'vault-url': urlInput.value});
        chrome.storage.local.set({'vault-user': usernameInput.value});
    } catch (err) {

    }
});