import * as settings from './settings';
import * as vaultApi from './vaultApi';

const vaultUrl = 'https://my.vault.host';
const vaultPath = 'web/';
const vaultUser = 'username';
const token = 'vault token';

let vaultApiStub: {
    getUrlPaths: jest.SpyInstance<ReturnType<typeof vaultApi['getSecretPaths']>>;
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
            getUrlPaths: jest.spyOn(vaultApi, 'getSecretPaths').mockRejectedValue(new Error()),
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
                .toEqual(['vaultUrl', 'vaultPath', 'vaultUser', 'token', 'secretPaths']);
        });
    });
    describe('save', () => {
        it('saves vault Url, username and token to local storage', async () => {
            await settings.save(vaultUrl, vaultPath, vaultUser, token);

            expect(chromeStorage.local.set).toHaveBeenCalledTimes(1);
            expect(chromeStorage.local.set.mock.calls[0]![0]).toEqual({vaultUrl, vaultPath, vaultUser, token});
        });
    });
    describe('saveToken', () => {
        it('saves token', async () => {
            await settings.saveToken(token);

            expect(chromeStorage.local.set).toHaveBeenCalledTimes(1);
            expect(chromeStorage.local.set.mock.calls[0]![0]).toEqual({token});
        });
    });
    describe('clearToken', () => {
        it('removes token from stored settings', async () => {
            await settings.clearToken();

            expect(chromeStorage.local.remove).toHaveBeenCalledTimes(1);
            expect(chromeStorage.local.remove.mock.calls[0]![0]).toEqual(['token']);
        });
    });
    describe('cacheUrlPaths', () => {
        it('does nothing if URL is not saved', async () => {
            chromeStorage.local.get.mockImplementationOnce((keys, cb) => cb({}));

            await settings.cacheSecretPaths();

            expect(chromeStorage.local.get).toHaveBeenCalledTimes(1);
            expect(chromeStorage.local.set).not.toHaveBeenCalled();
            expect(vaultApiStub.getUrlPaths).not.toHaveBeenCalled();
        });
        it('saves result from vaultApi.getUrlPaths', async () => {
            const secretPaths = [urlPath('/vault/secret/path', '')];
            chromeStorage.local.get.mockImplementationOnce((keys, cb) => cb({vaultUrl, vaultPath, token}));
            vaultApiStub.getUrlPaths.mockResolvedValue(secretPaths);

            const result = await settings.cacheSecretPaths();

            expect(result).toEqual(secretPaths);
            expect(chromeStorage.local.set).toHaveBeenCalledTimes(1);
            expect(chromeStorage.local.set.mock.calls[0]![0]).toEqual({secretPaths});
            expect(vaultApiStub.getUrlPaths).toHaveBeenCalledTimes(1);
            expect(vaultApiStub.getUrlPaths).toHaveBeenCalledWith(vaultUrl, vaultPath, token);
        });
    });
    describe('uniqueUrls', () => {
        beforeEach(() => {
            chromeStorage.local.get.mockImplementation((keys, cb) => cb({vaultUrl, vaultPath, token}));
        });
        it('returns empty array if no vaultUrl', async () => {
            chromeStorage.local.get.mockImplementation((keys, cb) => cb({}));

            const result = await settings.getDomains();

            expect(result).toEqual([]);
            expect(vaultApiStub.getUrlPaths).not.toHaveBeenCalled();
        });
        it('caches URLs and converts secret URL', async () => {
            const secretPaths = [urlPath('', 'https://my-bank.com/login')];
            vaultApiStub.getUrlPaths.mockResolvedValue(secretPaths);

            const result = await settings.getDomains();

            expect(chromeStorage.local.set).toHaveBeenCalledTimes(1);
            expect(chromeStorage.local.set).toHaveBeenCalledWith({secretPaths}, expect.any(Function));
            expect(result).toEqual(['my-bank.com']);
        });
        it('returns unique secret url domains', async () => {
            const secretPaths = [
                urlPath('/my-account', 'https://my-bank.com/login'),
                urlPath('/spouse-account', 'https://my-bank.com/login'),
            ];
            vaultApiStub.getUrlPaths.mockResolvedValue(secretPaths);

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
    });
});

