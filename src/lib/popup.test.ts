import {JSDOM} from 'jsdom';
import * as permissions from './permissions';
import * as settings from './settings';
import * as vaultApi from './vaultApi';
import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import {InputInfoProps} from './message';
import UrlList from './components/UrlList';
import type * as textfield from '../__mocks__/@material/textfield';
const {Secret} = jest.requireActual('./vaultApi') as typeof vaultApi;

jest.mock('./permissions');
jest.mock('./settings');
jest.mock('./vaultApi');
jest.mock('./components/UrlList');

const mockRuntime = chrome.runtime as IMockChromeRuntime;
let MockTextField: typeof textfield.MDCTextField;

const nextTick = promisify(setImmediate);

const html = fs.readFileSync(path.join(__dirname, '../views/popup.html'));

const loadPage = async () => {
    global.window = new JSDOM(html).window as any;
    global.document = window.document;
    jest.isolateModules(() => {
        MockTextField = require('../__mocks__/@material/textfield').MDCTextField;
        require('./popup');
    });
    await nextTick();
};

const vaultUrl = 'https://my.vault';
const vaultUser = 'my vault id';
const password = 'passw0rd';
const token = 'vault token';
const pageUrl = 'https://current.page';
const vaultPath = '/secret path/secret name';
const sender = {tab: {id: 'active tab id'}} as unknown as chrome.runtime.MessageSender;
const sendResponse = jest.fn();

const messageCallback = () => mockRuntime.onMessage.addListener.mock.calls[0][0];

const permissionsStub = permissions as jest.Mocked<typeof permissions>;
const settingsStub = settings as jest.Mocked<typeof settings>;
const vaultApiStub = vaultApi as jest.Mocked<typeof vaultApi>;

const secretInfo = (path: string, url: string, ...keys: string[]) => ({path, url, keys});
const urlPaths = {
    'my.bank.com': [secretInfo('/secret/my-bank', 'https://my.bank.com')],
    'my.utility.com': [
        secretInfo('/secret/my-utility/user1', 'https://my.utility.com/path1'),
        secretInfo('/secret/my-utility/user2', 'https://my.utility.com/path2')],
};

const MockUrlList = UrlList as jest.MockedClass<typeof UrlList>;
function urlList(id: string) {
    const index = MockUrlList.mock.calls.findIndex((args) => args[0].id === id);
    return MockUrlList.mock.instances[index] as unknown as jest.Mocked<typeof UrlList.prototype>;
}

const getInput = (selector: string) => document.querySelector(selector) as HTMLInputElement;
const getButton = (selector: string) => document.querySelector(selector) as HTMLButtonElement;

function textField(inputId: string) {
    return MockTextField.instances.find((m) => m.element.querySelector('input')!.id === inputId)!;
}

async function testFillButtonEnabled(field: string) {
    settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, field)]}});
    vaultApiStub.getSecret.mockResolvedValue(new Secret({url: '', password}));
    vaultApiStub.hasSecretValue.mockReturnValue(true);
    await loadPage();

    await messageCallback()({url: pageUrl, inputs: [{name: field}]}, sender, sendResponse);

    const button = document.querySelector('div.buttons button') as HTMLButtonElement;
    expect(button.querySelector('span')?.innerHTML).toEqual('secret name');
    expect(button.disabled).toEqual(false);
    expect(vaultApi.getSecret).toBeCalledTimes(1);
    expect(vaultApi.getSecret).toBeCalledWith(vaultUrl, token, vaultPath);
    expect(document.getElementById('status')?.innerHTML).toEqual('');
}

describe('popup', () => {
    it('executes content script', async () => {
        settingsStub.load.mockResolvedValue({});

        await loadPage();

        expect(chrome.tabs.executeScript).toBeCalledTimes(1);
        expect(chrome.tabs.executeScript).toBeCalledWith({file: 'contentScript.js', allFrames: true});
    });
    it('displays Vault username', async () => {
        settingsStub.load.mockResolvedValue({vaultUser, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl)]}});
        await loadPage();

        await messageCallback()({url: pageUrl, inputs: []}, sender, sendResponse);

        expect(document.getElementById('username')?.innerHTML).toEqual(vaultUser);
    });
    it('displays message for no inputs', async () => {
        settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
        vaultApiStub.getSecret.mockResolvedValue(new Secret({url: '', password}));
        await loadPage();

        await messageCallback()({url: pageUrl, inputs: []}, sender, sendResponse);

        expect(document.getElementById('page-inputs')?.innerHTML).toEqual('<h3>No inputs found</h3>');
    });
    it('displays saved URLs', async () => {
        settingsStub.load.mockResolvedValue({urlPaths});

        await loadPage();

        expect(urlList('saved-urls').removeAll).toBeCalledTimes(1);
        expect(urlList('saved-urls').addItem).toBeCalledTimes(2);
        expect(urlList('saved-urls').addItem).toBeCalledWith('my.bank.com', urlPaths['my.bank.com']);
        expect(urlList('saved-urls').addItem).toBeCalledWith('my.utility.com', urlPaths['my.utility.com']);
    });
    describe('page-inputs-switch', () => {
        it('expands page-inputs', async () => {
            const inputs: InputInfoProps[] = [{id: 'customId', label: 'Custom Label', type: 'text'}];
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
            vaultApiStub.getSecret.mockResolvedValue(new Secret({url: '', password}));
            await loadPage();
            await messageCallback()({url: pageUrl, inputs}, sender, sendResponse);
            const pageInputs = document.getElementById('page-inputs');
            jest.spyOn(pageInputs!, 'clientHeight', 'get').mockReturnValue(123);

            document.getElementById('page-inputs-switch')?.click();
            expect(document.querySelector('#page-inputs-switch i')?.innerHTML).toEqual('arrow_drop_down');
            expect(pageInputs?.parentElement?.style.height).toEqual('123px');
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
            vaultApiStub.getSecret.mockResolvedValue(new Secret({url: '', password}));
            await loadPage();

            await messageCallback()({url: pageUrl, inputs}, sender, sendResponse);

            const pageInputs = document.getElementById('page-inputs');
            expect(pageInputs?.childNodes).toHaveLength(1);
            expect(pageInputs?.children[0].innerHTML).toEqual(
                `<div class="row"><span class="label">type</span><span>${inputs[0].type}</span></div>` +
                `<div class="row"><span class="label">id</span><span>${inputs[0].id}</span></div>` +
                `<div class="row"><span class="label">name</span><span>${inputs[0].name}</span></div>` +
                `<div class="row"><span class="label">label</span><span>${inputs[0].label}</span></div>` +
                `<div class="row"><span class="label">placeholder</span><span>${inputs[0].placeholder}</span></div>`);
            expect(document.querySelector('#page-inputs-switch i')?.innerHTML).toEqual('arrow_right');
            expect(pageInputs?.parentElement?.style.height).toEqual('0px');
        });
        it('disables button when page contains no fields', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
            vaultApiStub.getSecret.mockResolvedValue(new Secret({url: '', password}));
            await loadPage();

            await messageCallback()({url: pageUrl, inputs: []}, sender, sendResponse);

            const button = document.querySelector('div.buttons button') as HTMLButtonElement;
            expect(button.disabled).toEqual(true);
        });
        it('disables button when not logged in and password is empty', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
            vaultApiStub.getSecret.mockRejectedValue({status: 403});
            await loadPage();

            await messageCallback()({url: pageUrl, inputs: [{id: 'username'}]}, sender, sendResponse);

            const button = document.querySelector('div.buttons button') as HTMLButtonElement;
            expect(button.disabled).toEqual(true);
            expect(button.querySelector('span')?.innerHTML).toEqual('secret name');
            expect(vaultApi.getSecret).toBeCalledTimes(1);
            expect(vaultApi.getSecret).toBeCalledWith(vaultUrl, token, vaultPath);
            expect(document.getElementById('status')?.innerHTML).toEqual('Invalid token');
        });
        it('enables fill buttons when not logged in and password is not empty', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
            vaultApiStub.getSecret.mockRejectedValue({status: 403});
            await loadPage();
            getInput('#password').value = password;

            await messageCallback()({url: pageUrl, inputs: [{id: 'username'}, {type: 'password'}]}, sender, sendResponse);

            expect(getButton('div.buttons button').disabled).toEqual(false);
        });
        it('displays Vault error', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username', 'password')]}});
            vaultApiStub.getSecret.mockRejectedValue({message: 'bad request'});
            vaultApiStub.getErrorMessage.mockReturnValue('formatted errors');
            await loadPage();

            await messageCallback()({url: pageUrl, inputs: [{id: 'username'}, {type: 'password'}]}, sender, sendResponse);

            expect(vaultApi.getSecret).toBeCalledTimes(1);
            expect(vaultApi.getSecret).toBeCalledWith(vaultUrl, token, vaultPath);
            expect(document.getElementById('status')?.innerHTML).toEqual('Error: formatted errors');
            expect(getButton('div.buttons button').disabled).toEqual(true);
        });
        it('displays message for invalid Vault token', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username', 'password')]}});
            await loadPage();

            await messageCallback()({url: pageUrl, inputs: [{id: 'username'}]}, sender, sendResponse);

            expect(vaultApi.getSecret).not.toBeCalled();
            expect(document.getElementById('status')?.innerHTML).toEqual('Need a Vault token');
            expect(getButton('div.buttons button').disabled).toEqual(true);
        });
    });
    describe('fill password button', () => {
        it('sends message to fill fields matching name or label', async () => {
            const secretData = {url: '', username: 'site user', password: 'site password', email: 'user@mail.host'};
            const secret = new Secret(secretData);
            settingsStub.load.mockResolvedValue({vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
            vaultApiStub.getSecret.mockResolvedValue(secret);
            vaultApiStub.hasSecretValue.mockReturnValue(true);
            await loadPage();
            await messageCallback()({url: pageUrl, inputs: [{name: 'username'}, {label: 'password', type: 'password'}]}, sender, sendResponse);

            getButton('div.buttons button').click();

            expect(chrome.tabs.sendMessage).toBeCalledTimes(1);
            expect(chrome.tabs.sendMessage).toBeCalledWith(sender.tab?.id, [
                {selector: 'input[name="username"]', value: secretData.username},
                {label: 'password', value: secretData.password},
            ]);
        });
        it('gets new Vault token when password is not empty', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username', 'password')]}});
            vaultApiStub.getSecret.mockRejectedValueOnce({status: 403});
            vaultApiStub.getSecret.mockResolvedValueOnce(new Secret({url: '', username: 'site user', password: 'site password'}));
            vaultApiStub.hasSecretValue.mockReturnValue(true);
            vaultApiStub.login.mockResolvedValue({client_token: 'new token', lease_duration: 30});
            await loadPage();
            getInput('#password').value = password;
            await messageCallback()({url: pageUrl, inputs: [{id: 'username'}, {type: 'password'}]}, sender, sendResponse);

            getButton('div.buttons button').click();

            await nextTick();
            expect(vaultApi.getSecret).toBeCalledTimes(2);
            expect(vaultApi.getSecret).toBeCalledWith(vaultUrl, token, vaultPath);
            expect(vaultApi.getSecret).toBeCalledWith(vaultUrl, 'new token', vaultPath);
            expect(vaultApi.login).toBeCalledTimes(1);
            expect(vaultApi.login).toBeCalledWith(vaultUrl, vaultUser, password);
            expect(chrome.tabs.sendMessage).toBeCalledTimes(1);
            expect(chrome.tabs.sendMessage).toBeCalledWith(sender.tab?.id, [
                {selector: 'input[id="username"]', value: 'site user'},
                {selector: 'input[type="password"]', value: 'site password'}]);
            expect(document.getElementById('status')?.innerHTML).toEqual('');
        });
    });
    describe('reload button', () => {
        it('is enabled when URL, username and password have values', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser});
            await loadPage();

            textField('password').triggerChange('passw0rd');

            expect(getInput('#reload').disabled).toEqual(false);
        });
        it('displays message when permission for Vault URL is denied', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser});
            permissionsStub.requestOrigin.mockResolvedValue(false);
            await loadPage();
            textField('password').triggerChange(password);

            document.getElementById('reload')!.click();

            await nextTick();
            expect(document.getElementById('status')!.innerHTML).toEqual('Need permission to access https://my.vault');
            expect(document.querySelector('.progress-overlay.hidden')).toBeDefined();
        });
        it('gets token from Vault when clicked', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultPath, vaultUser});
            settingsStub.save.mockResolvedValue();
            permissionsStub.requestOrigin.mockResolvedValue(true);
            vaultApiStub.login.mockResolvedValue({client_token: token, lease_duration: 1800});
            await loadPage();
            settingsStub.cacheUrlPaths.mockResolvedValue({});
            textField('password').triggerChange(password);

            document.getElementById('reload')!.click();

            await nextTick();
            expect(vaultApi.login).toBeCalledTimes(1);
            expect(vaultApi.login).toBeCalledWith(vaultUrl, vaultUser, password);
            expect(settings.saveToken).toBeCalledTimes(1);
            expect(settings.saveToken).toBeCalledWith(token);
            expect(document.getElementById('status')!.innerHTML).toEqual('');
            expect(document.querySelector('.mdc-linear-progress--closed')).not.toBeNull();
        });
        it('displays error from vault', async () => {
            const message = 'invalid user or password';
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser});
            permissionsStub.requestOrigin.mockResolvedValue(true);
            vaultApiStub.login.mockRejectedValue({message});
            await loadPage();
            const list = urlList('saved-urls');
            list.removeAll.mockReset();
            textField('password').triggerChange(password);

            document.getElementById('reload')!.click();

            await nextTick();
            expect(vaultApi.login).toBeCalledTimes(1);
            expect(vaultApi.login).toBeCalledWith(vaultUrl, vaultUser, password);
            expect(settings.save).not.toBeCalled();
            expect(document.getElementById('status')!.innerHTML).toEqual(message);
            expect(list.removeAll).not.toBeCalled();
            expect(list.addItem).not.toBeCalled();
            expect(document.querySelector('.mdc-linear-progress--closed')).not.toBeNull();
        });
        it('displays message for empty response', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser});
            permissionsStub.requestOrigin.mockResolvedValue(true);
            vaultApiStub.login.mockResolvedValue({client_token: '', lease_duration: 0});
            await loadPage();
            textField('password').triggerChange(password);

            document.getElementById('reload')!.click();

            await nextTick();
            expect(vaultApi.login).toBeCalledTimes(1);
            expect(vaultApi.login).toBeCalledWith(vaultUrl, vaultUser, password);
            expect(settings.save).not.toBeCalled();
            expect(document.getElementById('status')!.innerHTML).toEqual('Did not get a token, please verify the base URL');
            expect(document.querySelector('.mdc-linear-progress--closed')).not.toBeNull();
        });
        it('updates saved URL list', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token});
            settingsStub.cacheUrlPaths.mockResolvedValue(urlPaths);
            await loadPage();
            const list = urlList('saved-urls');
            list.removeAll.mockReset();

            document.getElementById('reload')!.click();

            await nextTick();
            expect(document.getElementById('status')!.innerHTML).toEqual('');
            expect(list.removeAll).toBeCalledTimes(1);
            expect(list.addItem).toBeCalledTimes(2);
            expect(list.addItem).toBeCalledWith('my.bank.com', urlPaths['my.bank.com']);
            expect(list.addItem).toBeCalledWith('my.utility.com', urlPaths['my.utility.com']);
            expect(document.querySelector('.mdc-linear-progress--closed')).not.toBeNull();
        });
        it('displays message for expired token', async () => {
            permissionsStub.requestOrigin.mockResolvedValue(true);
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token});
            settingsStub.cacheUrlPaths.mockRejectedValue({status: 403});
            await loadPage();
            const list = urlList('saved-urls');
            list.removeAll.mockReset();

            document.getElementById('reload')!.click();

            await nextTick();
            expect(document.getElementById('status')!.innerHTML).toEqual('Need a token');
            expect(list.removeAll).not.toBeCalled();
            expect(list.addItem).not.toBeCalled();
            expect(document.querySelector('.mdc-linear-progress--closed')).not.toBeNull();
        });
    });
    describe('filter input', () => {
        it('filters cards when input is not empty', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths});
            await loadPage();

            textField('vault-filter').triggerChange('search');

            expect(urlList('saved-urls').filterItems).toBeCalledTimes(1);
            expect(urlList('saved-urls').filterItems).toBeCalledWith('search');
        });
        it('resets cards when input is empty', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths});
            await loadPage();

            textField('vault-filter').triggerChange('');

            expect(urlList('saved-urls').showAll).toBeCalledTimes(1);
            expect(urlList('saved-urls').showAll).toBeCalledWith();
        });
    });
});
