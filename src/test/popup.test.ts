import {JSDOM} from 'jsdom';
import * as settings from '../lib/settings';
import * as vaultApi from '../lib/vaultApi';
import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import {InputInfoProps} from '../lib/message';
const {Secret} = jest.requireActual('../lib/vaultApi') as typeof vaultApi;

jest.mock('../lib/settings');
jest.mock('../lib/vaultApi');

const html = fs.readFileSync(path.join(__dirname, '../views/popup.html'));

const loadPage = () => {
    global.window = new JSDOM(html).window as any;
    global.document = window.document;
    jest.isolateModules(() => require('../lib/popup'));
};

const vaultUrl = 'https://my.vault';
const vaultUser = 'my vault id';
const password = 'passw0rd';
const token = 'vault token';
const pageUrl = 'https://current.page';
const vaultPath = '/secret path/secret name';
const sender = {tab: {id: 'active tab id'}};

const messageCallback = () => chrome.runtime.onMessage.addListener.mock.calls[0][0];

const nextTick = promisify(setImmediate);

const settingsStub = settings as jest.Mocked<typeof settings>;
const vaultApiStub = vaultApi as jest.Mocked<typeof vaultApi>;

const secretInfo = (path: string, url: string, ...keys: string[]) => ({path, url, keys});

const getInput = (selector: string) => document.querySelector(selector) as HTMLInputElement;
const getButton = (selector: string) => document.querySelector(selector) as HTMLButtonElement;

async function testFillButtonEnabled(field: string) {
    settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, field)]}});
    vaultApiStub.getSecret.mockResolvedValue(new Secret({password}));
    vaultApiStub.hasSecretValue.mockReturnValue(true);
    loadPage();

    await messageCallback()({url: pageUrl, inputs: [{name: field}]});

    const button = document.querySelector('div.buttons button') as HTMLButtonElement;
    expect(button.querySelector('span').innerHTML).toEqual('secret name');
    expect(button.disabled).toEqual(false);
    expect(vaultApi.getSecret).toBeCalledTimes(1);
    expect(vaultApi.getSecret).toBeCalledWith(vaultUrl, token, vaultPath);
    expect(document.getElementById('status').innerText).toEqual('');
}

describe('popup', () => {
    it('executes content script', () => {
        loadPage();

        expect(chrome.tabs.executeScript).toBeCalledTimes(1);
        expect(chrome.tabs.executeScript).toBeCalledWith({file: 'contentScript.js', allFrames: true});
    });
    it('displays Vault username', async () => {
        settingsStub.load.mockResolvedValue({vaultUser, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl)]}});
        loadPage();

        await messageCallback()({url: pageUrl, inputs: []});

        expect(document.getElementById('username').innerText).toEqual(vaultUser);
    });
    it('displays message for no inputs', async () => {
        settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
        vaultApiStub.getSecret.mockResolvedValue(new Secret({password}));
        loadPage();

        await messageCallback()({url: pageUrl, inputs: []});

        expect(document.getElementById('page-inputs').innerHTML).toEqual('<h3>No inputs found</h3>');
    });
    describe('page-inputs-switch', () => {
        it('expands page-inputs', async () => {
            const inputs: InputInfoProps[] = [{id: 'customId', label: 'Custom Label', type: 'text'}];
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
            vaultApiStub.getSecret.mockResolvedValue(new Secret({password}));
            loadPage();
            await messageCallback()({url: pageUrl, inputs});
            const pageInputs = document.getElementById('page-inputs');
            jest.spyOn(pageInputs, 'clientHeight', 'get').mockReturnValue(123);

            document.getElementById('page-inputs-switch').click();
            expect(document.querySelector('#page-inputs-switch i').innerHTML).toEqual('arrow_drop_down');
            expect(pageInputs.parentElement.style.height).toEqual('123px');
        });
    });
    describe('messageCallback', () => {
        it('adds button for Vault secret when page has username field', async () => {
            await testFillButtonEnabled('username');
        });
        it('adds button for Vault secret when page has password field', async () => {
            await testFillButtonEnabled('password');
        });
        it('adds button for Vault secret when page has email field', async () => {
            await testFillButtonEnabled('email');
        });
        it('adds page inputs', async () => {
            const inputs: InputInfoProps[] = [{id: 'customId', label: 'Custom Label', type: 'text', name: 'Custom name', placeholder: 'Custom placeholder'}];
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'custom')]}});
            vaultApiStub.getSecret.mockResolvedValue(new Secret({password}));
            loadPage();

            await messageCallback()({url: pageUrl, inputs});

            const pageInputs = document.getElementById('page-inputs');
            expect(pageInputs.childNodes).toHaveLength(1);
            expect(pageInputs.children[0].innerHTML).toEqual(
                `<div class="row"><span class="label">type</span><span>${inputs[0].type}</span></div>` +
                `<div class="row"><span class="label">id</span><span>${inputs[0].id}</span></div>` +
                `<div class="row"><span class="label">name</span><span>${inputs[0].name}</span></div>` +
                `<div class="row"><span class="label">label</span><span>${inputs[0].label}</span></div>` +
                `<div class="row"><span class="label">placeholder</span><span>${inputs[0].placeholder}</span></div>`);
            expect(document.querySelector('#page-inputs-switch i').innerHTML).toEqual('arrow_right');
            expect(pageInputs.parentElement.style.height).toEqual('0px');
        });
        it('disables button when page contains no fields', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
            vaultApiStub.getSecret.mockResolvedValue(new Secret({password}));
            loadPage();

            await messageCallback()({url: pageUrl, inputs: []});

            const button = document.querySelector('div.buttons button') as HTMLButtonElement;
            expect(button.disabled).toEqual(true);
        });
        it('disables button when not logged in and password is empty', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
            vaultApiStub.getSecret.mockRejectedValue({status: 403});
            loadPage();

            await messageCallback()({url: pageUrl, inputs: [{id: 'username'}]});

            const button = document.querySelector('div.buttons button') as HTMLButtonElement;
            expect(button.disabled).toEqual(true);
            expect(button.querySelector('span').innerHTML).toEqual('secret name');
            expect(vaultApi.getSecret).toBeCalledTimes(1);
            expect(vaultApi.getSecret).toBeCalledWith(vaultUrl, token, vaultPath);
            expect(document.getElementById('status').innerText).toEqual('Invalid token');
        });
        it('enables fill buttons when not logged in and password is not empty', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
            vaultApiStub.getSecret.mockRejectedValue({status: 403});
            loadPage();
            getInput('#password').value = password;

            await messageCallback()({url: pageUrl, inputs: [{id: 'username'}, {type: 'password'}]});

            expect(getButton('div.buttons button').disabled).toEqual(false);
        });
        it('displays Vault error', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username', 'password')]}});
            vaultApiStub.getSecret.mockRejectedValue({message: 'bad request'});
            vaultApiStub.getErrorMessage.mockReturnValue('formatted errors');
            loadPage();

            await messageCallback()({url: pageUrl, inputs: [{id: 'username'}, {type: 'password'}]});

            expect(vaultApi.getSecret).toBeCalledTimes(1);
            expect(vaultApi.getSecret).toBeCalledWith(vaultUrl, token, vaultPath);
            expect(document.getElementById('status').innerText).toEqual('Error: formatted errors');
            expect(getButton('div.buttons button').disabled).toEqual(true);
        });
        it('displays message for invalid Vault token', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username', 'password')]}});
            loadPage();

            await messageCallback()({url: pageUrl, inputs: [{id: 'username'}]}, sender);

            expect(vaultApi.getSecret).not.toBeCalled();
            expect(document.getElementById('status').innerText).toEqual('Need a Vault token');
            expect(getButton('div.buttons button').disabled).toEqual(true);
        });
    });
    describe('fill button', () => {
        it('sends message to fill fields matching name or label', async () => {
            const secretData = {username: 'site user', password: 'site password', email: 'user@mail.host'};
            const secret = new Secret(secretData);
            settingsStub.load.mockResolvedValue({vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
            vaultApiStub.getSecret.mockResolvedValue(secret);
            vaultApiStub.hasSecretValue.mockReturnValue(true);
            loadPage();
            await messageCallback()({url: pageUrl, inputs: [{name: 'username'}, {label: 'password', type: 'password'}]}, sender);

            getButton('div.buttons button').click();

            expect(chrome.tabs.sendMessage).toBeCalledTimes(1);
            expect(chrome.tabs.sendMessage).toBeCalledWith(sender.tab.id, [
                {selector: 'input[name="username"]', value: secretData.username},
                {label: 'password', value: secretData.password},
            ]);
        });
        it('gets new Vault token when password is not empty', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username', 'password')]}});
            vaultApiStub.getSecret.mockRejectedValueOnce({status: 403});
            vaultApiStub.getSecret.mockResolvedValueOnce(new Secret({username: 'site user', password: 'site password'}));
            vaultApiStub.hasSecretValue.mockReturnValue(true);
            vaultApiStub.login.mockResolvedValue({client_token: 'new token'});
            loadPage();
            getInput('#password').value = password;
            await messageCallback()({url: pageUrl, inputs: [{id: 'username'}, {type: 'password'}]}, sender);

            getButton('div.buttons button').click();

            await nextTick();
            expect(vaultApi.getSecret).toBeCalledTimes(2);
            expect(vaultApi.getSecret).toBeCalledWith(vaultUrl, token, vaultPath);
            expect(vaultApi.getSecret).toBeCalledWith(vaultUrl, 'new token', vaultPath);
            expect(vaultApi.login).toBeCalledTimes(1);
            expect(vaultApi.login).toBeCalledWith(vaultUrl, vaultUser, password);
            expect(chrome.tabs.sendMessage).toBeCalledTimes(1);
            expect(chrome.tabs.sendMessage).toBeCalledWith(sender.tab.id, [
                {selector: 'input[id="username"]', value: 'site user'},
                {selector: 'input[type="password"]', value: 'site password'}]);
            expect(document.getElementById('status').innerText).toEqual('');
        });
    });
});

