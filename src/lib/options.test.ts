import '../test/types/global';
import {JSDOM} from 'jsdom';
import * as settings from './settings';
import * as permissions from './permissions';
import * as vaultApi from './vaultApi';
import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import {MDCTextField} from '@material/textfield';
import UrlCardList from './components/UrlCardList';
import {MDCSnackbar} from '@material/snackbar';

jest.mock('./settings');
jest.mock('@material/ripple');
jest.mock('@material/snackbar');
jest.mock('./components/UrlCardList');
jest.mock('./permissions');
jest.mock('./vaultApi');

const MockTextField = MDCTextField as jest.MockedClass<typeof MDCTextField>;
const MockUrlCardList = UrlCardList as jest.MockedClass<typeof UrlCardList>;
const MockSnackbar = MDCSnackbar as jest.MockedClass<typeof MDCSnackbar>;

const nextTick = promisify(setImmediate);

const html = fs.readFileSync(path.join(__dirname, '../views/options.html'));

const vaultUrl = 'https://my.vault';
const vaultPath = 'web/';
const vaultUser = 'my vault id';
const password = 'passw0rd';
const token = 'vault token';

const secretInfo = (path: string, url: string): vaultApi.SecretInfo => ({path, url, keys: ['user', 'password']});
const urlPaths = {
    'my.bank.com': [secretInfo('/secret/my-bank', 'https://my.bank.com')],
    'my.utility.com': [
        secretInfo('/secret/my-utility/user1', 'https://my.utility.com/path1'),
        secretInfo('/secret/my-utility/user2', 'https://my.utility.com/path2')],
};

const loadPage = async () => {
    global.window = new JSDOM(html).window as any;
    global.document = window.document;
    jest.isolateModules(() => require('./options'));
    await nextTick();
};

const mockSettings = settings as jest.Mocked<typeof settings>;
const mockPermissions = permissions as jest.Mocked<typeof permissions>;
const mockVaultApi = vaultApi as jest.Mocked<typeof vaultApi>;

const getInput = (id: string) => (document.getElementById(id) as HTMLInputElement);

function urlCardList(id: string) {
    const index = MockUrlCardList.mock.calls.findIndex((args) => args[0].id === id);
    return MockUrlCardList.mock.instances[index];
}

type IMockTextField = typeof MockTextField['mock']['instances'][0] & {
    triggerChange: (value: string) => void;
}

function textField(inputId: string): IMockTextField {
    const index = MockTextField.mock.calls.findIndex((args) => args[0].querySelector('input').id === inputId);
    return MockTextField.mock.instances[index] as IMockTextField;
}

describe('options', () => {
    it('displays saved URL, path and username', async () => {
        mockSettings.load.mockResolvedValue({vaultUrl, vaultPath, vaultUser, token});

        await loadPage();

        expect(getInput('vault-url').value).toEqual(vaultUrl);
        expect(getInput('vault-path').value).toEqual(vaultPath);
        expect(getInput('username').value).toEqual(vaultUser);
        expect(document.getElementById('status').innerText).toEqual('Logged in');
        expect(urlCardList('saved-urls').removeAll).not.toBeCalled();
        expect(urlCardList('saved-urls').addCard).not.toBeCalled();
        expect(textField('password').required).not.toEqual(true);
        expect(getInput('reload').disabled).toEqual(false);
    });
    it('moves focus to password when URL and username are in settings', async () => {
        mockSettings.load.mockResolvedValue({vaultUrl, vaultUser});

        await loadPage();

        expect(textField('username').focus).toBeCalledTimes(1);
        expect(textField('password').focus).toBeCalledTimes(1);
    });
    it('marks URL, username and password invalid when settings are empty', async () => {
        mockSettings.load.mockResolvedValue({});

        await loadPage();

        expect(textField('vault-url').getDefaultFoundation().setValid).toBeCalledTimes(1);
        expect(textField('vault-url').getDefaultFoundation().setValid).toBeCalledWith(false);
        expect(textField('username').getDefaultFoundation().setValid).toBeCalledTimes(1);
        expect(textField('username').getDefaultFoundation().setValid).toBeCalledWith(false);
        expect(textField('password').getDefaultFoundation().setValid).toBeCalledTimes(1);
        expect(textField('password').getDefaultFoundation().setValid).toBeCalledWith(false);
        expect(textField('password').required).toEqual(true);
    });
    it('displays saved URLs', async () => {
        mockSettings.load.mockResolvedValue({urlPaths});

        await loadPage();

        expect(urlCardList('saved-urls').removeAll).toBeCalledTimes(1);
        expect(urlCardList('saved-urls').addCard).toBeCalledTimes(2);
        expect(urlCardList('saved-urls').addCard).toBeCalledWith('my.bank.com', ['https://my.bank.com'], ['/secret/my-bank']);
        expect(urlCardList('saved-urls').addCard).toBeCalledWith('my.utility.com',
            ['https://my.utility.com/path1', 'https://my.utility.com/path2'],
            ["/secret/my-utility/user1", "/secret/my-utility/user2"]);
    });
    describe('logout button', () => {
        it('revokes vault token', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser, token});
            mockVaultApi.logout.mockResolvedValue();
            mockSettings.clearToken.mockResolvedValue();
            await loadPage();

            document.getElementById('logout').click();

            await nextTick();
            expect(vaultApi.logout).toBeCalledTimes(1);
            expect(vaultApi.logout).toBeCalledWith(vaultUrl, token);
            expect(settings.clearToken).toBeCalledTimes(1);
            expect(document.getElementById('status').innerText).toEqual('Not logged in');
        });
        it('clears token when vault returns 403', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser, token});
            mockVaultApi.logout.mockRejectedValue({status: 403});
            mockSettings.clearToken.mockResolvedValue();
            await loadPage();

            document.getElementById('logout').click();

            await nextTick();
            expect(vaultApi.logout).toBeCalledTimes(1);
            expect(vaultApi.logout).toBeCalledWith(vaultUrl, token);
            expect(settings.clearToken).toBeCalledTimes(1);
            expect(MockSnackbar.mock.instances[0].open).not.toBeCalled();
            expect(document.getElementById('status').innerText).toEqual('Not logged in');
        });
        it('displays error from Vault', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser, token});
            mockVaultApi.logout.mockRejectedValue({message: 'bad request'});
            mockSettings.clearToken.mockResolvedValue();
            await loadPage();

            document.getElementById('logout').click();

            await nextTick();
            expect(vaultApi.logout).toBeCalledTimes(1);
            expect(vaultApi.logout).toBeCalledWith(vaultUrl, token);
            expect(settings.clearToken).toBeCalledTimes(1);
            expect(MockSnackbar.mock.instances[0].labelText).toEqual('Error revoking token: bad request');
            expect(MockSnackbar.mock.instances[0].open).toBeCalledTimes(1);
            expect(document.getElementById('status').innerText).toEqual('Logged in');
        });
    });
    describe('reload button', () => {
        it('is enabled when URL, username and password have values', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser});
            await loadPage();

            textField('password').triggerChange('passw0rd');

            expect(getInput('reload').disabled).toEqual(false);
        });
        it('displays message when permission for Vault URL is denied', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser});
            mockPermissions.requestOrigin.mockResolvedValue(false);
            await loadPage();
            textField('password').triggerChange(password);

            document.getElementById('reload').click();

            await nextTick();
            expect(MockSnackbar.mock.instances[0].labelText).toEqual(`Need permission to access ${vaultUrl}`);
            expect(MockSnackbar.mock.instances[0].open).toBeCalledTimes(1);
            expect(document.querySelector('.progress-overlay.hidden')).toBeDefined();
        });
        it('gets token from Vault when clicked', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultPath, vaultUser});
            mockSettings.save.mockResolvedValue();
            mockPermissions.requestOrigin.mockResolvedValue(true);
            mockVaultApi.login.mockResolvedValue({client_token: token, lease_duration: 1800});
            await loadPage();
            mockSettings.cacheUrlPaths.mockResolvedValue({});
            textField('password').triggerChange(password);

            document.getElementById('reload').click();

            await nextTick();
            expect(vaultApi.login).toBeCalledTimes(1);
            expect(vaultApi.login).toBeCalledWith(vaultUrl, vaultUser, password);
            expect(settings.save).toBeCalledTimes(1);
            expect(settings.save).toBeCalledWith(vaultUrl, vaultPath, vaultUser, token);
            expect(document.getElementById('status').innerText).toEqual('Logged in');
            expect(MockSnackbar.mock.instances[0].open).not.toBeCalled();
            expect(document.querySelector('.progress-overlay.hidden')).toBeDefined();
        });
        it('displays error from vault', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser});
            mockPermissions.requestOrigin.mockResolvedValue(true);
            mockVaultApi.login.mockRejectedValue({message: 'invalid user or password'});
            await loadPage();
            textField('password').triggerChange(password);

            document.getElementById('reload').click();

            await nextTick();
            expect(vaultApi.login).toBeCalledTimes(1);
            expect(vaultApi.login).toBeCalledWith(vaultUrl, vaultUser, password);
            expect(settings.save).not.toBeCalled();
            expect(document.getElementById('status').innerText).toEqual('Not logged in');
            expect(MockSnackbar.mock.instances[0].labelText).toEqual('invalid user or password');
            expect(MockSnackbar.mock.instances[0].open).toBeCalledTimes(1);
            expect(document.querySelector('.progress-overlay.hidden')).toBeDefined();
        });
        it('displays message for empty response', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser});
            mockPermissions.requestOrigin.mockResolvedValue(true);
            mockVaultApi.login.mockResolvedValue({});
            await loadPage();
            textField('password').triggerChange(password);

            document.getElementById('reload').click();

            await nextTick();
            expect(vaultApi.login).toBeCalledTimes(1);
            expect(vaultApi.login).toBeCalledWith(vaultUrl, vaultUser, password);
            expect(settings.save).not.toBeCalled();
            expect(document.getElementById('status').innerText).toEqual('Not logged in');
            expect(MockSnackbar.mock.instances[0].labelText).toEqual('Did not get a token, please verify the base URL');
            expect(MockSnackbar.mock.instances[0].open).toBeCalledTimes(1);
            expect(document.querySelector('.progress-overlay.hidden')).toBeDefined();
        });
        it('displays message for response which does not contain a token', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser});
            mockPermissions.requestOrigin.mockResolvedValue(true);
            mockVaultApi.login.mockResolvedValue({});
            await loadPage();
            textField('password').triggerChange(password);

            document.getElementById('reload').click();

            await nextTick();
            expect(vaultApi.login).toBeCalledTimes(1);
            expect(vaultApi.login).toBeCalledWith(vaultUrl, vaultUser, password);
            expect(settings.save).not.toBeCalled();
            expect(document.getElementById('status').innerText).toEqual('Not logged in');
            expect(MockSnackbar.mock.instances[0].labelText).toEqual('Did not get a token, please verify the base URL');
            expect(MockSnackbar.mock.instances[0].open).toBeCalledTimes(1);
            expect(document.querySelector('.progress-overlay.hidden')).toBeDefined();
        });
        it('updates saved URL list', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser, token});
            mockSettings.cacheUrlPaths.mockResolvedValue(urlPaths);
            await loadPage();

            document.getElementById('reload').click();

            await nextTick();
            expect(document.getElementById('status').innerText).toEqual('Logged in');
            expect(urlCardList('saved-urls').removeAll).toBeCalledTimes(1);
            expect(urlCardList('saved-urls').addCard).toBeCalledTimes(2);
            expect(urlCardList('saved-urls').addCard).toBeCalledWith('my.bank.com', ['https://my.bank.com'], ["/secret/my-bank"]);
            expect(urlCardList('saved-urls').addCard).toBeCalledWith('my.utility.com',
                ['https://my.utility.com/path1', 'https://my.utility.com/path2'],
                ["/secret/my-utility/user1", "/secret/my-utility/user2"]);
            expect(document.querySelector('.progress-overlay.hidden')).toBeDefined();
        });
        it('displays message for expired token', async () => {
            mockPermissions.requestOrigin.mockResolvedValue(true);
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser, token});
            mockSettings.cacheUrlPaths.mockRejectedValue({status: 403});
            await loadPage();

            document.getElementById('reload').click();

            await nextTick();
            expect(document.getElementById('status').innerText).toEqual('Not logged in');
            expect(urlCardList('saved-urls').removeAll).not.toBeCalled();
            expect(urlCardList('saved-urls').addCard).not.toBeCalled();
            expect(MockSnackbar.mock.instances[0].labelText).toEqual('Need a token');
            expect(MockSnackbar.mock.instances[0].open).toBeCalledTimes(1);
            expect(document.querySelector('.progress-overlay.hidden')).toBeDefined();
        });
        it('displays error from Vault', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser, token});
            mockSettings.cacheUrlPaths.mockRejectedValue({message: 'bad request'});
            await loadPage();

            document.getElementById('reload').click();

            await nextTick();
            expect(document.getElementById('status').innerText).toEqual('Logged in');
            expect(urlCardList('saved-urls').removeAll).not.toBeCalled();
            expect(urlCardList('saved-urls').addCard).not.toBeCalled();
            expect(MockSnackbar.mock.instances[0].labelText).toEqual('bad request');
            expect(MockSnackbar.mock.instances[0].open).toBeCalledTimes(1);
            expect(document.querySelector('.progress-overlay.hidden')).toBeDefined();
        });
    });
    describe('filter input', () => {
        it('filters cards when input is not empty', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths});
            await loadPage();

            textField('vault-filter').triggerChange('search');

            expect(urlCardList('saved-urls').filterCards).toBeCalledTimes(1);
            expect(urlCardList('saved-urls').filterCards).toBeCalledWith('search');
        });
        it('resets cards when input is empty', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser, token, urlPaths});
            await loadPage();

            textField('vault-filter').triggerChange('');

            expect(urlCardList('saved-urls').showAll).toBeCalledTimes(1);
            expect(urlCardList('saved-urls').showAll).toBeCalledWith();
        });
    });
});

