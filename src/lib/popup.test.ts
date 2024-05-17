import {JSDOM} from 'jsdom';
import * as permissions from './permissions';
import * as settings from './settings';
import * as vaultApi from './vaultApi';
import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import {InputInfoProps} from './message';
import PropSelect from './components/PropSelect';
import UrlList from './components/UrlList';
import type * as textfield from '../__mocks__/@material/textfield';
const {Secret} = jest.requireActual('./vaultApi') as typeof vaultApi;

jest.mock('./permissions');
jest.mock('./settings');
jest.mock('./vaultApi');
jest.mock('./components/UrlList');
jest.mock('./components/PropSelect');
jest.mock('@material/tab-bar');

const mockTabs = chrome.tabs as IMockTabs;
let MockTextField: typeof textfield.MDCTextField;

const nextTick = promisify(setImmediate);

const html = fs.readFileSync(path.join(__dirname, '../views/popup.html'));

type MockTab = Partial<chrome.tabs.Tab>;

const loadPage = (...tabs: MockTab[]) => {
    global.window = new JSDOM(html).window as any;
    global.document = window.document;
    global.DOMParser = window.DOMParser;
    const addListener = jest.fn();
    const port = {
        name: 'popup',
        postMessage: jest.fn(),
        onMessage: {addListener},
        mockSend: (message: unknown) => addListener.mock.calls[0][0](message),
    };
    mockTabs.connect.mockReturnValue(port);
    mockTabs.query.mockImplementation((query: unknown, callback: (tabs: MockTab[]) => void) => callback(tabs));
    return new Promise<typeof port>((resolve) => {
        jest.isolateModules(() => {
            MockTextField = require('../__mocks__/@material/textfield').MDCTextField;
            require('./popup');
            resolve(port);
        });
    });
};

const vaultUrl = 'https://my.vault';
const vaultUser = 'my vault id';
const password = 'passw0rd';
const token = 'vault token';
const pageUrl = 'https://current.page';
const vaultPath = '/secret path/secret name';

const permissionsStub = permissions as jest.Mocked<typeof permissions>;
const settingsStub = settings as jest.Mocked<typeof settings>;
const vaultApiStub = vaultApi as jest.Mocked<typeof vaultApi>;

const secretInfo = (path: string, url: string, ...keys: string[]) => ({path, url, keys});
const secretPaths = [
    secretInfo('/secret/my-bank', 'https://my.bank.com'),
    secretInfo('/secret/my-utility/user1', 'https://my.utility.com/path1'),
    secretInfo('/secret/my-utility/user2', 'https://my.utility.com/path2'),
];

const MockPropSelect = PropSelect as jest.MockedClass<typeof PropSelect>;
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

async function testFillButtonEnabled(field: string, currentUrl = pageUrl) {
    settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, secretPaths: [secretInfo(vaultPath, pageUrl, field)]});
    vaultApiStub.getSecret.mockResolvedValue(new Secret({url: '', password}));
    vaultApiStub.hasSecretValue.mockReturnValue(true);
    const port = await loadPage({id: tabId, url: pageUrl});

    await port.mockSend({url: pageUrl, inputs: [{name: field}]});

    const button = document.querySelector('div.buttons button') as HTMLButtonElement;
    expect(button.querySelector('span')?.innerHTML).toEqual('secret name');
    expect(button.disabled).toEqual(false);
    expect(vaultApi.getSecret).toHaveBeenCalledTimes(1);
    expect(vaultApi.getSecret).toHaveBeenCalledWith(vaultUrl, token, vaultPath);
    expect(document.getElementById('status')?.innerHTML).toEqual('');
}

const frameId = 'top';
const tabId = Math.floor(Math.random()*10);

describe('popup', () => {
    beforeEach(() => {
        settingsStub.getInputSelections.mockResolvedValue({});
    });
    it('displays Vault username', async () => {
        settingsStub.load.mockResolvedValue({vaultUser, secretPaths: [secretInfo(vaultPath, pageUrl)]});

        await loadPage({id: 1, url: 'https://example.com'});

        expect(document.getElementById('username')?.innerHTML).toEqual(vaultUser);
    });
    it('displays message for no secrets', async () => {
        settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, secretPaths: [secretInfo(vaultPath, 'https://other.com', 'username')]});

        await loadPage();

        expect(document.getElementById('page-inputs')?.innerHTML).toEqual('<h4 name="no-secret">No secret found.</h4>');
    });
    it('displays saved URLs', async () => {
        settingsStub.load.mockResolvedValue({secretPaths: secretPaths});

        await loadPage();

        expect(urlList('saved-urls').removeAll).toHaveBeenCalledTimes(1);
        expect(urlList('saved-urls').addItem).toHaveBeenCalledTimes(2);
        const paths = secretPaths.map((s) => s.path);
        expect(urlList('saved-urls').addItem).toHaveBeenCalledWith('my.bank.com', paths.slice(0, 1));
        expect(urlList('saved-urls').addItem).toHaveBeenCalledWith('my.utility.com', paths.slice(1));
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
        it('adds button for Vault secret when page url matches secret domain', async () => {
            await testFillButtonEnabled('email', 'https://subdomain.current.page');
        });
        it('adds page inputs', async () => {
            const inputRefId = 1;
            const inputs: InputInfoProps[] = [{
                frameId, refId: inputRefId,
                id: 'customId', label: 'Custom Label', type: 'text', name: 'Custom name', placeholder: 'Custom placeholder',
            }];
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, secretPaths: [secretInfo(vaultPath, pageUrl, 'custom')]});
            vaultApiStub.getSecret.mockResolvedValue(new Secret({url: '', password}));
            const port = await loadPage({id: tabId, url: pageUrl});

            await port.mockSend({url: pageUrl, inputs});

            expect(MockPropSelect).toHaveBeenCalledTimes(1);
            expect(MockPropSelect).toHaveBeenCalledWith(expect.any(window.HTMLDivElement), 'custom', expect.any(Function));
            expect(MockPropSelect.prototype.addOptions).toHaveBeenCalledWith(inputs, undefined);
        });
        it('does not show fill buttons when page contains no fields', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, secretPaths: [secretInfo(vaultPath, pageUrl, 'username')]});
            vaultApiStub.getSecret.mockResolvedValue(new Secret({url: '', password}));

            await loadPage();

            const button = document.querySelector('body > div.buttons button');
            expect(button).toBeNull();
        });
        it('disables fill button when not logged in and password is empty', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, secretPaths: [secretInfo(vaultPath, pageUrl, 'username')]});
            vaultApiStub.getSecret.mockRejectedValue({status: 403});
            const port = await loadPage({id: tabId, url: pageUrl});

            await port.mockSend({url: pageUrl, inputs: [{id: 'username'}]});

            const button = document.querySelector('body > div.buttons button') as HTMLButtonElement;
            expect(button.disabled).toEqual(true);
            expect(button.querySelector('span')?.innerHTML).toEqual('secret name');
            expect(vaultApi.getSecret).toHaveBeenCalledTimes(1);
            expect(vaultApi.getSecret).toHaveBeenCalledWith(vaultUrl, token, vaultPath);
            expect(document.getElementById('status')?.innerHTML).toEqual('Invalid token');
        });
        it('enables fill buttons when not logged in and password is not empty', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, secretPaths: [secretInfo(vaultPath, pageUrl, 'username')]});
            vaultApiStub.getSecret.mockRejectedValue({status: 403});
            vaultApiStub.hasSecretValue.mockReturnValue(true);
            const port = await loadPage({id: tabId, url: pageUrl});
            getInput('#password').value = password;

            await port.mockSend({url: pageUrl, inputs: [{id: 'username'}, {type: 'password'}]});

            expect(getButton('body > div.buttons button').disabled).toEqual(false);
        });
        it('displays Vault error', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, secretPaths: [secretInfo(vaultPath, pageUrl, 'username', 'password')]});
            vaultApiStub.getSecret.mockRejectedValue({message: 'bad request'});
            vaultApiStub.getErrorMessage.mockReturnValue('formatted errors');
            const port = await loadPage({id: tabId, url: pageUrl});

            await port.mockSend({url: pageUrl, inputs: [{id: 'username'}, {type: 'password'}]});

            expect(vaultApi.getSecret).toHaveBeenCalledTimes(1);
            expect(vaultApi.getSecret).toHaveBeenCalledWith(vaultUrl, token, vaultPath);
            expect(document.getElementById('status')?.innerHTML).toEqual('Error: formatted errors');
            expect(getButton('body > div.buttons button').disabled).toEqual(true);
        });
        it('displays message for invalid Vault token', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, secretPaths: [secretInfo(vaultPath, pageUrl, 'username', 'password')]});
            const port = await loadPage({id: tabId, url: pageUrl});

            await port.mockSend({url: pageUrl, inputs: [{id: 'username'}]});

            expect(vaultApi.getSecret).not.toHaveBeenCalled();
            expect(document.getElementById('status')?.innerHTML).toEqual('Need a Vault token');
            expect(getButton('body > div.buttons button').disabled).toEqual(true);
        });
    });
    describe('fill password button', () => {
        const usernameRefId = 1;
        const passwordRefId = 2;
        it('sends message to fill selected fields', async () => {
            const secretData = {url: '', username: 'site user', password: 'site password', email: 'user@mail.host'};
            const secret = new Secret(secretData);
            settingsStub.load.mockResolvedValue({vaultUser, token, secretPaths: [secretInfo(vaultPath, pageUrl, 'username', 'password')]});
            vaultApiStub.getSecret.mockResolvedValue(secret);
            vaultApiStub.hasSecretValue.mockReturnValue(true);
            const port = await loadPage({id: tabId, url: pageUrl});
            await port.mockSend({url: pageUrl, inputs: [
                {name: 'username', frameId, refId: usernameRefId},
                {label: 'password', type: 'password', frameId, refId: passwordRefId},
            ]});
            Object.assign(MockPropSelect.mock.instances[0]!, {propName: 'username', selectedInputInfo: {frameId, refId: usernameRefId, type: 'text'}});
            Object.assign(MockPropSelect.mock.instances[1]!, {propName: 'password', selectedInputInfo: {frameId, refId: passwordRefId, type: 'password'}});

            getButton('body > div.buttons button').click();

            expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
            expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(tabId, [
                expect.objectContaining({frameId, refId: usernameRefId, value: secretData.username}),
                expect.objectContaining({frameId, refId: passwordRefId, value: secretData.password}),
            ]);
        });
        it('gets new Vault token when password is not empty', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, secretPaths: [secretInfo(vaultPath, pageUrl, 'username', 'password')]});
            vaultApiStub.getSecret.mockRejectedValueOnce({status: 403});
            vaultApiStub.getSecret.mockResolvedValueOnce(new Secret({url: '', username: 'site user', password: 'site password'}));
            vaultApiStub.hasSecretValue.mockReturnValue(true);
            vaultApiStub.login.mockResolvedValue({client_token: 'new token', lease_duration: 30});
            const port = await loadPage({id: tabId, url: pageUrl});
            getInput('#password').value = password;
            await port.mockSend({url: pageUrl, inputs: [{id: 'username', frameId, refId: usernameRefId}, {type: 'password', frameId, refId: passwordRefId}]});
            Object.assign(MockPropSelect.mock.instances[0]!, {propName: 'username', selectedInputInfo: {frameId, refId: usernameRefId, type: 'text'}});
            Object.assign(MockPropSelect.mock.instances[1]!, {propName: 'password', selectedInputInfo: {frameId, refId: passwordRefId, type: 'password'}});

            getButton('body > div.buttons button').click();

            await nextTick();
            expect(vaultApi.getSecret).toHaveBeenCalledTimes(2);
            expect(vaultApi.getSecret).toHaveBeenCalledWith(vaultUrl, token, vaultPath);
            expect(vaultApi.getSecret).toHaveBeenCalledWith(vaultUrl, 'new token', vaultPath);
            expect(vaultApi.login).toHaveBeenCalledTimes(1);
            expect(vaultApi.login).toHaveBeenCalledWith(vaultUrl, vaultUser, password);
            expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
            expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(tabId, [
                expect.objectContaining({frameId, refId: usernameRefId, value: 'site user'}),
                expect.objectContaining({frameId, refId: passwordRefId, value: 'site password'}),
            ]);
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
            settingsStub.cacheSecretPaths.mockResolvedValue([]);
            textField('password').triggerChange(password);

            document.getElementById('reload')!.click();

            await nextTick();
            expect(vaultApi.login).toHaveBeenCalledTimes(1);
            expect(vaultApi.login).toHaveBeenCalledWith(vaultUrl, vaultUser, password);
            expect(settings.saveToken).toHaveBeenCalledTimes(1);
            expect(settings.saveToken).toHaveBeenCalledWith(token);
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
            expect(vaultApi.login).toHaveBeenCalledTimes(1);
            expect(vaultApi.login).toHaveBeenCalledWith(vaultUrl, vaultUser, password);
            expect(settings.save).not.toHaveBeenCalled();
            expect(document.getElementById('status')!.innerHTML).toEqual(message);
            expect(list.removeAll).not.toHaveBeenCalled();
            expect(list.addItem).not.toHaveBeenCalled();
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
            expect(vaultApi.login).toHaveBeenCalledTimes(1);
            expect(vaultApi.login).toHaveBeenCalledWith(vaultUrl, vaultUser, password);
            expect(settings.save).not.toHaveBeenCalled();
            expect(document.getElementById('status')!.innerHTML).toEqual('Did not get a token, please verify the base URL');
            expect(document.querySelector('.mdc-linear-progress--closed')).not.toBeNull();
        });
        it('updates saved URL list', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token});
            settingsStub.cacheSecretPaths.mockResolvedValue(secretPaths);
            await loadPage();
            const list = urlList('saved-urls');
            list.removeAll.mockReset();

            document.getElementById('reload')!.click();

            await nextTick();
            expect(document.getElementById('status')!.innerHTML).toEqual('');
            expect(list.removeAll).toHaveBeenCalledTimes(1);
            expect(list.addItem).toHaveBeenCalledTimes(2);
            const paths = secretPaths.map((s) => s.path);
            expect(list.addItem).toHaveBeenCalledWith('my.bank.com', paths.slice(0, 1));
            expect(list.addItem).toHaveBeenCalledWith('my.utility.com', paths.slice(1));
            expect(document.querySelector('.mdc-linear-progress--closed')).not.toBeNull();
        });
        it('displays message for expired token', async () => {
            permissionsStub.requestOrigin.mockResolvedValue(true);
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token});
            settingsStub.cacheSecretPaths.mockRejectedValue({status: 403});
            await loadPage();
            const list = urlList('saved-urls');
            list.removeAll.mockReset();

            document.getElementById('reload')!.click();

            await nextTick();
            expect(document.getElementById('status')!.innerHTML).toEqual('Need a token');
            expect(list.removeAll).not.toHaveBeenCalled();
            expect(list.addItem).not.toHaveBeenCalled();
            expect(document.querySelector('.mdc-linear-progress--closed')).not.toBeNull();
        });
    });
    describe('filter input', () => {
        it('filters cards when input is not empty', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, secretPaths});
            await loadPage();

            textField('vault-filter').triggerChange('search');

            expect(urlList('saved-urls').filterItems).toHaveBeenCalledTimes(1);
            expect(urlList('saved-urls').filterItems).toHaveBeenCalledWith('search');
        });
        it('resets cards when input is empty', async () => {
            settingsStub.load.mockResolvedValue({vaultUrl, vaultUser, token, secretPaths});
            await loadPage();

            textField('vault-filter').triggerChange('');

            expect(urlList('saved-urls').showAll).toHaveBeenCalledTimes(1);
            expect(urlList('saved-urls').showAll).toHaveBeenCalledWith();
        });
    });
});
