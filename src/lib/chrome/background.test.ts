import '../../test/types/global';
import type * as settings from '../settings';
import type * as vaultApi from '../vaultApi';

interface AlarmStub extends Record<string, any> {
    onAlarm: {
        addListener: jest.MockedFunction<any>;
    }
}
interface StorageStub extends Record<string, any> {
    onChanged: {
        addListener: jest.MockedFunction<any>;
    }
}
let settingsStub: typeof settings;
let vaultStub: typeof vaultApi;
let storage: StorageStub;
const alarms = chrome.alarms as AlarmStub;
const mockRuntime = chrome.runtime as IMockChromeRuntime;

const vaultUrl = 'https://my.vault';
const token = 'the token';
const action = {name: 'show page'};
const matcher = {name: 'url matcher'};

const getInstalledListener = () => mockRuntime.onInstalled.addListener.mock.calls[0][0];
const getStorageListener = () => storage.onChanged.addListener.mock.calls[0][0];
const getAlarmListener = () => alarms.onAlarm.addListener.mock.calls[0][0];

const load = (uniqueUrls: URL[] | string, loadSettings?: settings.Settings, refresh = true) => {
    jest.isolateModules(() => {
        settingsStub = jest.requireActual<typeof settings>('../settings');
        vaultStub = jest.requireActual<typeof vaultApi>('../vaultApi');
        jest.spyOn(settingsStub, 'clearToken').mockResolvedValue(undefined);
        if (typeof uniqueUrls === 'string') jest.spyOn(settingsStub, 'uniqueUrls').mockRejectedValue({message: uniqueUrls});
        else jest.spyOn(settingsStub, 'uniqueUrls').mockResolvedValue(uniqueUrls);
        if (loadSettings) jest.spyOn(settingsStub, 'load').mockResolvedValue(loadSettings);
        else jest.spyOn(settingsStub, 'load').mockRejectedValue(new Error());
        jest.spyOn(vaultStub, 'refreshToken').mockResolvedValue(refresh);
        global.chrome.declarativeContent = {
            onPageChanged: {
                addRules: jest.fn(),
                removeRules: jest.fn().mockImplementation((x, cb) => cb()),
            } as unknown as typeof chrome.declarativeContent.onPageChanged,
            PageStateMatcher: jest.fn().mockReturnValue(matcher),
            ShowPageAction: jest.fn().mockReturnValue(action),
        } as unknown as typeof chrome.declarativeContent;
        storage = {
            local: {
                get: jest.fn(),
                set: jest.fn(),
                remove: jest.fn(),
            },
            onChanged: {
                addListener: jest.fn(),
            },
        };
        global.chrome.storage = storage as typeof chrome.storage;
        require('./background');
    });
};

describe('chrome/background', () => {
    describe('onInstalled', () => {
        it('handles error from Vault', async () => {
            load('not logged in');

            await getInstalledListener()();

            expect(settingsStub.uniqueUrls).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.removeRules).not.toHaveBeenCalled();
            expect(chrome.declarativeContent.onPageChanged.addRules).not.toHaveBeenCalled();
        });
        it('clears page rules if no cached URLs', async () => {
            load([]);

            await getInstalledListener()();

            expect(chrome.declarativeContent.onPageChanged.removeRules).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).not.toHaveBeenCalled();
        });
        it('adds page rule for scheme and hostname', async () => {
            load([new URL('http://some.site.com')]);

            await getInstalledListener()();

            expect(chrome.declarativeContent.onPageChanged.removeRules).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher).toHaveBeenCalledWith({pageUrl: {hostEquals: 'some.site.com', schemes: ['http']}});
            expect(chrome.declarativeContent.ShowPageAction).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toHaveBeenCalledWith([{conditions: [matcher], actions: [action]}]);
        });
        it('adds page rule for scheme, hostname and port', async () => {
            load([new URL('https://some.site.com:8888')]);

            await getInstalledListener()();

            expect(chrome.declarativeContent.onPageChanged.removeRules).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher)
                .toHaveBeenCalledWith({pageUrl: {hostEquals: 'some.site.com', ports: [8888], schemes: ['https']}});
            expect(chrome.declarativeContent.ShowPageAction).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toHaveBeenCalledWith([{conditions: [matcher], actions: [action]}]);
        });
        it('adds page rule for scheme, hostname and path prefix', async () => {
            load([new URL('https://some.site.com/account')]);

            await getInstalledListener()();

            expect(chrome.declarativeContent.onPageChanged.removeRules).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher)
                .toHaveBeenCalledWith({pageUrl: {hostEquals: 'some.site.com', pathPrefix: '/account', schemes: ['https']}});
            expect(chrome.declarativeContent.ShowPageAction).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toHaveBeenCalledWith([{conditions: [matcher], actions: [action]}]);
        });
        it('adds page rule for scheme, hostname, path prefix and query', async () => {
            load([new URL('https://some.site.com/account?login=true')]);

            await getInstalledListener()();

            expect(chrome.declarativeContent.onPageChanged.removeRules).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher)
                .toHaveBeenCalledWith({
                    pageUrl: {
                        hostEquals: 'some.site.com',
                        pathPrefix: '/account',
                        queryContains: 'login=true',
                        schemes: ['https'],
                    },
                });
            expect(chrome.declarativeContent.ShowPageAction).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toHaveBeenCalledWith([{conditions: [matcher], actions: [action]}]);
        });
    });
    describe('storage.onChanged', () => {
        it('ignores message for sync storage change', async () => {
            load([]);

            await getStorageListener()({urlPaths: {}}, 'sync');

            expect(chrome.declarativeContent.onPageChanged.removeRules).not.toHaveBeenCalled();
        });
        it('ignores message if urlPaths did not change', async () => {
            load([]);

            await getStorageListener()({vaultUrl: 'new url'}, 'local');

            expect(chrome.declarativeContent.onPageChanged.removeRules).not.toHaveBeenCalled();
        });
        it('updates page rules when urlPaths changes', async () => {
            load([]);

            await getStorageListener()({urlPaths: {newValue: {'some.site.com': [{url: 'https://some.site.com'}]}}}, 'local');

            expect(chrome.declarativeContent.onPageChanged.removeRules).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher)
                .toHaveBeenCalledWith({
                    pageUrl: {
                        hostEquals: 'some.site.com',
                        schemes: ['https'],
                    },
                });
            expect(chrome.declarativeContent.ShowPageAction).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toHaveBeenCalledWith([{conditions: [matcher], actions: [action]}]);
        });
    });
    describe('onAlarm', () => {
        it('ignores unknown alarm', async () => {
            load([], {vaultUrl, token});

            await getAlarmListener()({name: 'unknown alamm'});

            expect(settingsStub.load).not.toHaveBeenCalled();
            expect(vaultStub.refreshToken).not.toHaveBeenCalled();
            expect(settingsStub.clearToken).not.toHaveBeenCalled();
        });
        it('renews token', async () => {
            load([], {vaultUrl, token});

            await getAlarmListener()({name: 'refresh-token'});

            expect(settingsStub.load).toHaveBeenCalledTimes(1);
            expect(vaultStub.refreshToken).toHaveBeenCalledTimes(1);
            expect(vaultStub.refreshToken).toHaveBeenCalledWith(vaultUrl, token);
            expect(settingsStub.clearToken).not.toHaveBeenCalled();
        });
        it('clears token if renewal fails', async () => {
            load([], {vaultUrl, token}, false);

            await getAlarmListener()({name: 'refresh-token'});

            expect(settingsStub.load).toHaveBeenCalledTimes(1);
            expect(vaultStub.refreshToken).toHaveBeenCalledTimes(1);
            expect(vaultStub.refreshToken).toHaveBeenCalledWith(vaultUrl, token);
            expect(settingsStub.clearToken).toHaveBeenCalledTimes(1);
        });
    });
});