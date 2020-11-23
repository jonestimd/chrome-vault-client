import * as settings from './settings';
import * as vaultApi from './vaultApi';

const vaultUrl = 'https://my.vault.host';
const vaultPath = 'web/';
const vaultUser = 'username';
const token = 'vault token';

let vaultApiStub: {
    getUrlPaths: jest.SpyInstance<ReturnType<typeof vaultApi['getUrlPaths']>>;
};

let chromeStorage: {
    local: {
        get: jest.MockedFunction<typeof chrome.storage.local['get']>,
        set: jest.MockedFunction<typeof chrome.storage.local['set']>,
        remove: jest.MockedFunction<typeof chrome.storage.local['remove']>
    }
};

const urlPath = (path: string, url: string, keys: string[] = []) => ({path, url, keys});

describe('settings', () => {
    beforeEach(() => {
        vaultApiStub = {
            getUrlPaths: jest.spyOn(vaultApi, 'getUrlPaths').mockResolvedValue(undefined),
        };
        global.chrome.storage = chromeStorage = {
            local: {
                get: jest.fn(),
                set: jest.fn().mockImplementation((data, cb) => cb()),
                remove: jest.fn().mockImplementation((keys, cb) => cb()),
            },
        };
    });
    describe('load', () => {
        it('returns stored settings', async () => {
            const storedSettings = {vaultUrl, vaultPath, vaultUser};
            chromeStorage.local.get.mockImplementation((keys, cb) => cb(storedSettings));

            const result = await settings.load();

            expect(result).toEqual(storedSettings);
            expect(chromeStorage.local.get).toBeCalledTimes(1);
            expect(chromeStorage.local.get.mock.calls[0][0])
                .toEqual(['vaultUrl', 'vaultPath', 'vaultUser', 'token', 'urlPaths']);
        });
    });
    describe('save', () => {
        it('saves vault Url, username and token to local storage', async () => {
            await settings.save(vaultUrl, vaultPath, vaultUser, token);

            expect(chromeStorage.local.set).toBeCalledTimes(1);
            expect(chromeStorage.local.set.mock.calls[0][0]).toEqual({vaultUrl, vaultPath, vaultUser, token});
        });
    });
    describe('saveToken', () => {
        it('saves token', async () => {
            await settings.saveToken(token);

            expect(chromeStorage.local.set).toBeCalledTimes(1);
            expect(chromeStorage.local.set.mock.calls[0][0]).toEqual({token});
        });
    });
    describe('clearToken', () => {
        it('removes token from stored settings', async () => {
            await settings.clearToken();

            expect(chromeStorage.local.remove).toBeCalledTimes(1);
            expect(chromeStorage.local.remove.mock.calls[0][0]).toEqual(['token']);
        });
    });
    describe('cacheUrlPaths', () => {
        it('does nothing if URL is not saved', async () => {
            chromeStorage.local.get.mockImplementationOnce((keys, cb) => cb({}));

            await settings.cacheUrlPaths();

            expect(chromeStorage.local.get).toBeCalledTimes(1);
            expect(chromeStorage.local.set).not.toBeCalled();
            expect(vaultApiStub.getUrlPaths).not.toBeCalled();
        });
        it('saves result from vaultApi.getUrlPaths', async () => {
            const urlPaths = {'https://some.web.site': [urlPath('/vault/secret/path', '')]};
            chromeStorage.local.get.mockImplementationOnce((keys, cb) => cb({vaultUrl, vaultPath, token}));
            vaultApiStub.getUrlPaths.mockResolvedValue(urlPaths);

            const result = await settings.cacheUrlPaths();

            expect(result).toEqual(urlPaths);
            expect(chromeStorage.local.set).toBeCalledTimes(1);
            expect(chromeStorage.local.set.mock.calls[0][0]).toEqual({urlPaths});
            expect(vaultApiStub.getUrlPaths).toBeCalledTimes(1);
            expect(vaultApiStub.getUrlPaths).toBeCalledWith(vaultUrl, vaultPath, token);
        });
    });
    describe('uniqueUrls', () => {
        beforeEach(() => {
            chromeStorage.local.get.mockImplementation((keys, cb) => cb({vaultUrl, vaultPath, token}));
        });
        it('returns empty array if no vaultUrl', async () => {
            chromeStorage.local.get.mockImplementation((keys, cb) => cb({}));

            const result = await settings.uniqueUrls();

            expect(result).toEqual([]);
            expect(vaultApiStub.getUrlPaths).not.toBeCalled();
        });
        it('caches URLs and converts secret URL', async () => {
            const urlPaths = {'https://my-bank.web.site': [urlPath('', 'https://my-bank.com/login')]};
            vaultApiStub.getUrlPaths.mockResolvedValue(urlPaths);

            const result = await settings.uniqueUrls();

            expect(chromeStorage.local.set).toBeCalledTimes(1);
            expect(chromeStorage.local.set).toBeCalledWith({urlPaths}, expect.any(Function));
            expect(result).toEqual([new URL(urlPaths['https://my-bank.web.site'][0].url)]);
        });
        it('returns unique secret URLs', async () => {
            const urlPaths = {
                'https://my-bank.web.site': [
                    urlPath('/my-account', 'https://my-bank.com/login'),
                    urlPath('/spouse-account', 'https://my-bank.com/login'),
                ],
            };
            vaultApiStub.getUrlPaths.mockResolvedValue(urlPaths);

            const result = await settings.uniqueUrls();

            expect(result).toEqual([new URL(urlPaths['https://my-bank.web.site'][0].url)]);
        });
        it('defaults protocol to https', async () => {
            const hostname = 'my-bank.com';
            const urlPaths = {'https://my-bank.web.site': [urlPath('', hostname)]};
            vaultApiStub.getUrlPaths.mockResolvedValue(urlPaths);

            const result = await settings.uniqueUrls();

            expect(result).toEqual([new URL('https://' + hostname)]);
        });
    });
});

