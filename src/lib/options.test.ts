import '../test/types/global';
import {JSDOM} from 'jsdom';
import * as settings from './settings';
import * as permissions from './permissions';
import * as vaultApi from './vaultApi';
import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import type * as textfield from '../__mocks__/@material/textfield';
import {MDCSnackbar} from '@material/snackbar';

jest.mock('./settings');
jest.mock('@material/ripple');
jest.mock('@material/snackbar');
jest.mock('./components/UrlList');
jest.mock('./permissions');
jest.mock('./vaultApi');

let MockTextField: typeof textfield.MDCTextField;
const MockSnackbar = MDCSnackbar as jest.MockedClass<typeof MDCSnackbar>;

const nextTick = promisify(setImmediate);

const html = fs.readFileSync(path.join(__dirname, '../views/options.html'));

const vaultUrl = 'https://my.vault';
const vaultPath = 'web/';
const vaultUser = 'my vault id';
const password = 'passw0rd';
const token = 'vault token';

const loadPage = async () => {
    global.window = new JSDOM(html).window as any;
    global.document = window.document;
    jest.isolateModules(() => {
        MockTextField = require('../__mocks__/@material/textfield').MDCTextField;
        require('./options');
    });
    await nextTick();
};

const mockSettings = settings as jest.Mocked<typeof settings>;
const mockPermissions = permissions as jest.Mocked<typeof permissions>;
const mockVaultApi = vaultApi as jest.Mocked<typeof vaultApi>;

const getInput = (id: string) => (document.getElementById(id) as HTMLInputElement);

function textField(inputId: string) {
    return MockTextField.instances.find((m) => m.element.querySelector('input')!.id === inputId)!;
}

describe('options', () => {
    it('displays saved URL, path and username', async () => {
        mockSettings.load.mockResolvedValue({vaultUrl, vaultPath, vaultUser, token});

        await loadPage();

        expect(getInput('vault-url').value).toEqual(vaultUrl);
        expect(getInput('vault-path').value).toEqual(vaultPath);
        expect(getInput('username').value).toEqual(vaultUser);
        expect(document.getElementById('status')!.innerText).toEqual('Logged in');
        expect(textField('password').required).not.toEqual(true);
    });
    it('moves focus to password when URL and username are in settings', async () => {
        mockSettings.load.mockResolvedValue({vaultUrl, vaultUser});

        await loadPage();

        expect(textField('username').focus).toHaveBeenCalledTimes(1);
        expect(textField('password').focus).toHaveBeenCalledTimes(1);
    });
    it('marks URL, username and password invalid when settings are empty', async () => {
        mockSettings.load.mockResolvedValue({});

        await loadPage();

        expect(textField('vault-url').getDefaultFoundation().setValid).toHaveBeenCalledTimes(1);
        expect(textField('vault-url').getDefaultFoundation().setValid).toHaveBeenCalledWith(false);
        expect(textField('username').getDefaultFoundation().setValid).toHaveBeenCalledTimes(1);
        expect(textField('username').getDefaultFoundation().setValid).toHaveBeenCalledWith(false);
        expect(textField('password').getDefaultFoundation().setValid).toHaveBeenCalledTimes(1);
        expect(textField('password').getDefaultFoundation().setValid).toHaveBeenCalledWith(false);
        expect(textField('password').required).toEqual(true);
    });
    describe('logout button', () => {
        it('revokes vault token', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser, token});
            mockVaultApi.logout.mockResolvedValue();
            mockSettings.clearToken.mockResolvedValue();
            await loadPage();

            document.getElementById('logout')!.click();

            await nextTick();
            expect(vaultApi.logout).toHaveBeenCalledTimes(1);
            expect(vaultApi.logout).toHaveBeenCalledWith(vaultUrl, token);
            expect(settings.clearToken).toHaveBeenCalledTimes(1);
            expect(document.getElementById('status')!.innerText).toEqual('Not logged in');
        });
        it('clears token when vault returns 403', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser, token});
            mockVaultApi.logout.mockRejectedValue({status: 403});
            mockSettings.clearToken.mockResolvedValue();
            await loadPage();

            document.getElementById('logout')!.click();

            await nextTick();
            expect(vaultApi.logout).toHaveBeenCalledTimes(1);
            expect(vaultApi.logout).toHaveBeenCalledWith(vaultUrl, token);
            expect(settings.clearToken).toHaveBeenCalledTimes(1);
            expect(MockSnackbar.mock.instances[0]?.open).not.toHaveBeenCalled();
            expect(document.getElementById('status')!.innerText).toEqual('Not logged in');
        });
        it('displays error from Vault', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser, token});
            mockVaultApi.logout.mockRejectedValue({message: 'bad request'});
            mockSettings.clearToken.mockResolvedValue();
            await loadPage();

            document.getElementById('logout')!.click();

            await nextTick();
            expect(vaultApi.logout).toHaveBeenCalledTimes(1);
            expect(vaultApi.logout).toHaveBeenCalledWith(vaultUrl, token);
            expect(settings.clearToken).toHaveBeenCalledTimes(1);
            expect(MockSnackbar.mock.instances[0]?.labelText).toEqual('Error revoking token: bad request');
            expect(MockSnackbar.mock.instances[0]?.open).toHaveBeenCalledTimes(1);
            expect(document.getElementById('status')!.innerText).toEqual('Logged in');
        });
    });
    describe('save button', () => {
        it('is enabled when URL, username and password have values', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser});
            await loadPage();

            textField('password').triggerChange('passw0rd');

            expect(getInput('save').disabled).toEqual(false);
        });
        it('displays message when permission for Vault URL is denied', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser});
            mockPermissions.requestOrigin.mockResolvedValue(false);
            await loadPage();
            textField('password').triggerChange(password);

            document.getElementById('save')!.click();

            await nextTick();
            expect(MockSnackbar.mock.instances[0]?.labelText).toEqual(`Need permission to access ${vaultUrl}`);
            expect(MockSnackbar.mock.instances[0]?.open).toHaveBeenCalledTimes(1);
            expect(document.querySelector('.mdc-linear-progress--closed')).not.toBeNull();
        });
        it('gets token from Vault when clicked', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultPath, vaultUser});
            mockSettings.save.mockResolvedValue();
            mockPermissions.requestOrigin.mockResolvedValue(true);
            mockVaultApi.login.mockResolvedValue({client_token: token, lease_duration: 1800});
            await loadPage();
            mockSettings.cacheUrlPaths.mockResolvedValue({});
            textField('password').triggerChange(password);

            document.getElementById('save')!.click();

            await nextTick();
            expect(vaultApi.login).toHaveBeenCalledTimes(1);
            expect(vaultApi.login).toHaveBeenCalledWith(vaultUrl, vaultUser, password);
            expect(settings.save).toHaveBeenCalledTimes(1);
            expect(settings.save).toHaveBeenCalledWith(vaultUrl, vaultPath, vaultUser, token);
            expect(document.getElementById('status')!.innerText).toEqual('Logged in');
            expect(MockSnackbar.mock.instances[0]?.open).not.toHaveBeenCalled();
            expect(document.querySelector('.mdc-linear-progress--closed')).not.toBeNull();
        });
        it('displays error from vault', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser});
            mockPermissions.requestOrigin.mockResolvedValue(true);
            mockVaultApi.login.mockRejectedValue({message: 'invalid user or password'});
            await loadPage();
            textField('password').triggerChange(password);

            document.getElementById('save')!.click();

            await nextTick();
            expect(vaultApi.login).toHaveBeenCalledTimes(1);
            expect(vaultApi.login).toHaveBeenCalledWith(vaultUrl, vaultUser, password);
            expect(settings.save).not.toHaveBeenCalled();
            expect(document.getElementById('status')!.innerText).toEqual('Not logged in');
            expect(MockSnackbar.mock.instances[0]?.labelText).toEqual('invalid user or password');
            expect(MockSnackbar.mock.instances[0]?.open).toHaveBeenCalledTimes(1);
            expect(document.querySelector('.mdc-linear-progress--closed')).not.toBeNull();
        });
        it('displays message for response which does not contain a token', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser});
            mockPermissions.requestOrigin.mockResolvedValue(true);
            mockVaultApi.login.mockResolvedValue({client_token: '', lease_duration: 0});
            await loadPage();
            textField('password').triggerChange(password);

            document.getElementById('save')!.click();

            await nextTick();
            expect(vaultApi.login).toHaveBeenCalledTimes(1);
            expect(vaultApi.login).toHaveBeenCalledWith(vaultUrl, vaultUser, password);
            expect(settings.save).not.toHaveBeenCalled();
            expect(document.getElementById('status')!.innerText).toEqual('Not logged in');
            expect(MockSnackbar.mock.instances[0]?.labelText).toEqual('Did not get a token, please verify the base URL');
            expect(MockSnackbar.mock.instances[0]?.open).toHaveBeenCalledTimes(1);
            expect(document.querySelector('.mdc-linear-progress--closed')).not.toBeNull();
        });
        it('displays message for expired token', async () => {
            mockPermissions.requestOrigin.mockResolvedValue(true);
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser, token});
            mockSettings.cacheUrlPaths.mockRejectedValue({status: 403});
            await loadPage();

            document.getElementById('save')!.click();

            await nextTick();
            expect(document.getElementById('status')!.innerText).toEqual('Not logged in');
            expect(MockSnackbar.mock.instances[0]?.labelText).toEqual('Need a token');
            expect(MockSnackbar.mock.instances[0]?.open).toHaveBeenCalledTimes(1);
            expect(document.querySelector('.mdc-linear-progress--closed')).not.toBeNull();
        });
        it('displays error from Vault', async () => {
            mockSettings.load.mockResolvedValue({vaultUrl, vaultUser, token});
            mockSettings.cacheUrlPaths.mockRejectedValue({message: 'bad request'});
            await loadPage();

            document.getElementById('save')!.click();

            await nextTick();
            expect(document.getElementById('status')!.innerText).toEqual('Logged in');
            expect(MockSnackbar.mock.instances[0]?.labelText).toEqual('bad request');
            expect(MockSnackbar.mock.instances[0]?.open).toHaveBeenCalledTimes(1);
            expect(document.querySelector('.mdc-linear-progress--closed')).not.toBeNull();
        });
    });
});

