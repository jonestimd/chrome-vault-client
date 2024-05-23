import * as settings from './settings';
import * as vaultApi from './vaultApi';

const vaultUrl = 'https://my.vault.host';
const vaultPath = 'web/';
const vaultUser = 'username';
const token = 'vault token';
const auth = {token, expiresAt: Infinity};

let vaultApiStub: {
    getSecretPaths: jest.SpyInstance<ReturnType<typeof vaultApi['getSecretPaths']>>;
    listTotpKeys: jest.SpyInstance<ReturnType<typeof vaultApi['listTotpKeys']>>;
    refreshToken: jest.SpyInstance<ReturnType<typeof vaultApi['refreshToken']>>;
};

let chromeStorage: {
    local: {
        get: jest.MockedFunction<typeof chrome.storage.local['get']>,
        set: jest.MockedFunction<typeof chrome.storage.local['set']>,
        remove: jest.MockedFunction<typeof chrome.storage.local['remove']>,
    }
};

const urlPath = (path: string, url: string, keys: string[] = []) => ({path, url, keys});

describe('settings', () => {
    beforeEach(() => {
        vaultApiStub = {
            getSecretPaths: jest.spyOn(vaultApi, 'getSecretPaths').mockRejectedValue(new Error()),
            listTotpKeys: jest.spyOn(vaultApi, 'listTotpKeys').mockRejectedValue(new Error()),
            refreshToken: jest.spyOn(vaultApi, 'refreshToken').mockRejectedValue(new Error()),
        };
        chromeStorage = {
            local: {
                get: jest.fn(),
                set: jest.fn().mockImplementation((data, cb) => cb()),
                remove: jest.fn().mockImplementation((keys, cb) => cb()),
            },
        };
        global.chrome.storage = chromeStorage as unknown as typeof chrome.storage;
    });
    describe('load', () => {
        it('returns stored settings', async () => {
            const storedSettings = {vaultUrl, vaultPath, vaultUser};
            chromeStorage.local.get.mockImplementation((keys, cb) => cb(storedSettings));

            const result = await settings.load();

            expect(result).toEqual(storedSettings);
            expect(chromeStorage.local.get).toHaveBeenCalledTimes(1);
            expect(chromeStorage.local.get.mock.calls[0]![0])
                .toEqual(['vaultUrl', 'vaultPath', 'vaultUser', 'auth', 'secretPaths', 'totpSettings']);
        });
    });
    describe('save', () => {
        it('saves vault Url, username and token to local storage', async () => {
            await settings.save(vaultUrl, vaultPath, vaultUser, auth);

            expect(chromeStorage.local.set).toHaveBeenCalledTimes(1);
            expect(chromeStorage.local.set.mock.calls[0]![0]).toEqual({vaultUrl, vaultPath, vaultUser, auth});
        });
    });
    describe('saveToken', () => {
        it('saves token', async () => {
            await settings.saveToken(auth);

            expect(chromeStorage.local.set).toHaveBeenCalledTimes(1);
            expect(chromeStorage.local.set.mock.calls[0]![0]).toEqual({auth});
        });
    });
    describe('refreshToken', () => {
        it('saves new token', async () => {
            const newAuth = {token: 'new token', expiresAt: Infinity};
            vaultApiStub.refreshToken.mockResolvedValue(newAuth);
            chromeStorage.local.get.mockImplementation((keys, callback) => callback({vaultUrl, auth}));

            await settings.refreshToken();

            expect(vaultApiStub.refreshToken).toHaveBeenCalledWith(vaultUrl, auth.token);
            expect(chromeStorage.local.set).toHaveBeenCalledWith({auth: newAuth}, expect.any(Function));
        });
        it('clears token if refresh fails', async () => {
            vaultApiStub.refreshToken.mockResolvedValue(undefined);
            chromeStorage.local.get.mockImplementation((keys, callback) => callback({vaultUrl, auth}));

            await settings.refreshToken();

            expect(vaultApiStub.refreshToken).toHaveBeenCalledWith(vaultUrl, auth.token);
            expect(chromeStorage.local.remove).toHaveBeenCalledWith(['auth'], expect.any(Function));
        });
    });
    describe('clearToken', () => {
        it('removes token from stored settings', async () => {
            await settings.clearToken();

            expect(chromeStorage.local.remove).toHaveBeenCalledTimes(1);
            expect(chromeStorage.local.remove.mock.calls[0]![0]).toEqual(['auth']);
        });
    });
    describe('cacheSecretInfo', () => {
        it('does nothing if URL is not saved', async () => {
            chromeStorage.local.get.mockImplementationOnce((keys, cb) => cb({}));

            await settings.cacheSecretInfo();

            expect(chromeStorage.local.get).toHaveBeenCalledTimes(1);
            expect(chromeStorage.local.set).not.toHaveBeenCalled();
            expect(vaultApiStub.getSecretPaths).not.toHaveBeenCalled();
        });
        it('saves result from vaultApi.getUrlPaths', async () => {
            const secretPaths = [urlPath('/vault/secret/path', '')];
            const totpSettings = [{key: 'key1', account_name: 'name1'}];
            chromeStorage.local.get.mockImplementationOnce((keys, cb) => cb({vaultUrl, vaultPath, auth}));
            vaultApiStub.getSecretPaths.mockResolvedValue(secretPaths);
            vaultApiStub.listTotpKeys.mockResolvedValue(totpSettings);

            const result = await settings.cacheSecretInfo();

            expect(result).toEqual({secretPaths, totpSettings});
            expect(chromeStorage.local.set).toHaveBeenCalledTimes(1);
            expect(chromeStorage.local.set.mock.calls[0]![0]).toEqual({secretPaths, totpSettings});
            expect(vaultApiStub.getSecretPaths).toHaveBeenCalledWith(vaultUrl, vaultPath, auth.token);
            expect(vaultApiStub.listTotpKeys).toHaveBeenCalledWith(vaultUrl, auth.token);
        });
    });
    describe('uniqueUrls', () => {
        beforeEach(() => {
            chromeStorage.local.get.mockImplementation((keys, cb) => cb({vaultUrl, vaultPath, auth}));
        });
        it('returns empty array if no vaultUrl', async () => {
            chromeStorage.local.get.mockImplementation((keys, cb) => cb({}));

            const result = await settings.getDomains();

            expect(result).toEqual([]);
            expect(vaultApiStub.getSecretPaths).not.toHaveBeenCalled();
        });
        it('caches URLs and converts secret URL', async () => {
            const secretPaths = [urlPath('', 'https://my-bank.com/login')];
            vaultApiStub.getSecretPaths.mockResolvedValue(secretPaths);
            vaultApiStub.listTotpKeys.mockResolvedValue([]);

            const result = await settings.getDomains();

            expect(chromeStorage.local.set).toHaveBeenCalledTimes(1);
            expect(chromeStorage.local.set).toHaveBeenCalledWith({secretPaths, totpSettings: []}, expect.any(Function));
            expect(result).toEqual(['my-bank.com']);
        });
        it('returns unique secret url domains', async () => {
            const secretPaths = [
                urlPath('/my-account', 'https://my-bank.com/login'),
                urlPath('/spouse-account', 'https://my-bank.com/login'),
            ];
            vaultApiStub.getSecretPaths.mockResolvedValue(secretPaths);
            vaultApiStub.listTotpKeys.mockResolvedValue([]);

            const result = await settings.getDomains();

            expect(result).toEqual(['my-bank.com']);
        });
    });
    describe('getInputSelections', () => {
        const hostname = 'my-bank.com';
        it('returns empty object for no saved selections', async () => {
            chromeStorage.local.get.mockImplementation((keys, cb) => cb({}));

            const result = await settings.getInputSelections(hostname);

            expect(result).toEqual({});
            expect(chromeStorage.local.get).toHaveBeenCalledWith(settings.pageSettingsKey, expect.any(Function));
        });
        it('returns empty object for no saved selection for hostname', async () => {
            chromeStorage.local.get.mockImplementation((keys, cb) => cb({[settings.pageSettingsKey]: {'other-bank.com': {username: {}}}}));

            const result = await settings.getInputSelections(hostname);

            expect(result).toEqual({});
            expect(chromeStorage.local.get).toHaveBeenCalledWith(settings.pageSettingsKey, expect.any(Function));
        });
        it('returns empty saved selection for hostname', async () => {
            const selection = {username: {frameId: 'top', label: 'User ID'}};
            chromeStorage.local.get.mockImplementation((keys, cb) => cb({[settings.pageSettingsKey]: {[hostname]: selection}}));

            const result = await settings.getInputSelections(hostname);

            expect(result).toEqual(selection);
            expect(chromeStorage.local.get).toHaveBeenCalledWith(settings.pageSettingsKey, expect.any(Function));
        });
    });
    describe('saveInputSelection', () => {
        const hostname = 'my-bank.com';
        const selection = {username: {frameId: 'top', refId: 1, type: 'text', label: 'User ID'}};
        it('adds selection settings', async () => {
            chromeStorage.local.get.mockImplementation((keys, cb) => cb({}));

            await settings.saveInputSelection(hostname, 'username', selection.username);

            expect(chromeStorage.local.get).toHaveBeenCalledWith(settings.pageSettingsKey, expect.any(Function));
            expect(chromeStorage.local.set).toHaveBeenCalledWith({[settings.pageSettingsKey]: {[hostname]: selection}}, expect.any(Function));
        });
        it('adds selection for hostname', async () => {
            const existingSettings = {'other-bank.com': {username: {frameId: 'top', label: 'User Name'}}};
            chromeStorage.local.get.mockImplementation((keys, cb) => cb({[settings.pageSettingsKey]: existingSettings}));

            await settings.saveInputSelection(hostname, 'username', selection.username);

            expect(chromeStorage.local.get).toHaveBeenCalledWith(settings.pageSettingsKey, expect.any(Function));
            expect(chromeStorage.local.set).toHaveBeenCalledWith({[settings.pageSettingsKey]: {
                ...existingSettings,
                [hostname]: selection},
            }, expect.any(Function));
        });
        it('updates selection for hostname', async () => {
            const existingSettings = {username: {frameId: 'top', label: 'User Name'}, password: {frameId: 'top', type: 'password'}};
            chromeStorage.local.get.mockImplementation((keys, cb) => cb({[settings.pageSettingsKey]: {[hostname]: existingSettings}}));

            await settings.saveInputSelection(hostname, 'username', selection.username);

            expect(chromeStorage.local.get).toHaveBeenCalledWith(settings.pageSettingsKey, expect.any(Function));
            expect(chromeStorage.local.set).toHaveBeenCalledWith({[settings.pageSettingsKey]: {
                [hostname]: {...existingSettings, ...selection}},
            }, expect.any(Function));
        });
        it('stores de-selection', async () => {
            const existingSettings = {username: {frameId: 'top', label: 'User Name'}, password: {frameId: 'top', type: 'password'}};
            chromeStorage.local.get.mockImplementation((keys, cb) => cb({[settings.pageSettingsKey]: {[hostname]: existingSettings}}));

            await settings.saveInputSelection(hostname, 'username');

            expect(chromeStorage.local.get).toHaveBeenCalledWith(settings.pageSettingsKey, expect.any(Function));
            expect(chromeStorage.local.set).toHaveBeenCalledWith({[settings.pageSettingsKey]: {
                [hostname]: {...existingSettings, username: 'none'}},
            }, expect.any(Function));
        });
    });
});

