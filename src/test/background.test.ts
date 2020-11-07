import './types/global';
import * as settings from '../lib/settings';
import * as vaultApi from '../lib/vaultApi';

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
let storage: StorageStub;
const alarms = chrome.alarms as AlarmStub;

const vaultUrl = 'https://my.vault';
const token = 'the token';
const action = {name: 'show page'};
const matcher = {name: 'url matcher'};

const getInstalledListener = () => chrome.runtime.onInstalled.addListener.mock.calls[0][0];
const getStorageListener = () => storage.onChanged.addListener.mock.calls[0][0];
const getAlarmListener = () => alarms.onAlarm.addListener.mock.calls[0][0];

describe('background', () => {
    beforeEach(() => {
        global.chrome.declarativeContent = {
            onPageChanged: {
                addRules: jest.fn(),
                removeRules: jest.fn().mockImplementation((x, cb) => cb()),
            },
            PageStateMatcher: jest.fn().mockReturnValue(matcher),
            ShowPageAction: jest.fn().mockReturnValue(action),
        };
        global.chrome.storage = storage = {
            local: {
                get: jest.fn(),
                set: jest.fn(),
                remove: jest.fn(),
            },
            onChanged: {
                addListener: jest.fn(),
            },
        };
        jest.isolateModules(() => {
            require('../lib/background');
        });
    });
    describe('onInstalled', () => {
        it('handles error from Vault', async () => {
            jest.spyOn(settings, 'cacheUrlPaths').mockRejectedValue({message: 'not logged in'});

            await getInstalledListener()();

            expect(settings.cacheUrlPaths).toBeCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.removeRules).not.toBeCalled();
            expect(chrome.declarativeContent.onPageChanged.addRules).not.toBeCalled();
        });
        it('clears page rules if no cached URLs', async () => {
            jest.spyOn(settings, 'cacheUrlPaths').mockResolvedValue(undefined);

            await getInstalledListener()();

            expect(chrome.declarativeContent.onPageChanged.removeRules).toBeCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).not.toBeCalled();
        });
        it('adds page rule for hostname', async () => {
            jest.spyOn(settings, 'cacheUrlPaths').mockResolvedValue({'some.site.com': [{url: 'some.site.login', path: '', keys: []}]});

            await getInstalledListener()();

            expect(chrome.declarativeContent.onPageChanged.removeRules).toBeCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher).toBeCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher).toBeCalledWith({pageUrl: {hostEquals: 'some.site.login', schemes: ['https']}});
            expect(chrome.declarativeContent.ShowPageAction).toBeCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toBeCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toBeCalledWith([{conditions: [matcher], actions: [action]}]);
        });
        it('adds page rule for scheme and hostname', async () => {
            jest.spyOn(settings, 'cacheUrlPaths').mockResolvedValue({'some.site.com': [{url: 'http://some.site.com', path: '', keys: []}]});

            await getInstalledListener()();

            expect(chrome.declarativeContent.onPageChanged.removeRules).toBeCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher).toBeCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher).toBeCalledWith({pageUrl: {hostEquals: 'some.site.com', schemes: ['http']}});
            expect(chrome.declarativeContent.ShowPageAction).toBeCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toBeCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toBeCalledWith([{conditions: [matcher], actions: [action]}]);
        });
        it('adds page rule for scheme, hostname and port', async () => {
            jest.spyOn(settings, 'cacheUrlPaths').mockResolvedValue({'some.site.com': [{url: 'https://some.site.com:8888', path: '', keys: []}]});

            await getInstalledListener()();

            expect(chrome.declarativeContent.onPageChanged.removeRules).toBeCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher).toBeCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher)
                .toBeCalledWith({pageUrl: {hostEquals: 'some.site.com', ports: [8888], schemes: ['https']}});
            expect(chrome.declarativeContent.ShowPageAction).toBeCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toBeCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toBeCalledWith([{conditions: [matcher], actions: [action]}]);
        });
        it('adds page rule for scheme, hostname and path prefix', async () => {
            jest.spyOn(settings, 'cacheUrlPaths').mockResolvedValue({'some.site.com': [{url: 'https://some.site.com/account', path: '', keys: []}]});

            await getInstalledListener()();

            expect(chrome.declarativeContent.onPageChanged.removeRules).toBeCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher).toBeCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher)
                .toBeCalledWith({pageUrl: {hostEquals: 'some.site.com', pathPrefix: '/account', schemes: ['https']}});
            expect(chrome.declarativeContent.ShowPageAction).toBeCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toBeCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toBeCalledWith([{conditions: [matcher], actions: [action]}]);
        });
        it('adds page rule for scheme, hostname, path prefix and query', async () => {
            jest.spyOn(settings, 'cacheUrlPaths')
                .mockResolvedValue({'some.site.com': [{url: 'https://some.site.com/account?login=true', path: '', keys: []}]});

            await getInstalledListener()();

            expect(chrome.declarativeContent.onPageChanged.removeRules).toBeCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher).toBeCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher)
                .toBeCalledWith({
                    pageUrl: {
                        hostEquals: 'some.site.com',
                        pathPrefix: '/account',
                        queryContains: 'login=true',
                        schemes: ['https'],
                    },
                });
            expect(chrome.declarativeContent.ShowPageAction).toBeCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toBeCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toBeCalledWith([{conditions: [matcher], actions: [action]}]);
        });
    });
    describe('storage.onChanged', () => {
        it('ignores message for sync storage change', async () => {
            await getStorageListener()({urlPaths: {}}, 'sync');

            expect(chrome.declarativeContent.onPageChanged.removeRules).not.toBeCalled();
        });
        it('ignores message if urlPaths did not change', async () => {
            await getStorageListener()({vaultUrl: 'new url'}, 'local');

            expect(chrome.declarativeContent.onPageChanged.removeRules).not.toBeCalled();
        });
        it('updates page rules when urlPaths changes', async () => {
            await getStorageListener()({urlPaths: {newValue: {'some.site.com': [{url: 'https://some.site.com'}]}}}, 'local');

            expect(chrome.declarativeContent.onPageChanged.removeRules).toBeCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher).toBeCalledTimes(1);
            expect(chrome.declarativeContent.PageStateMatcher)
                .toBeCalledWith({
                    pageUrl: {
                        hostEquals: 'some.site.com',
                        schemes: ['https'],
                    },
                });
            expect(chrome.declarativeContent.ShowPageAction).toBeCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toBeCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toBeCalledWith([{conditions: [matcher], actions: [action]}]);
        });
    });
    describe('onAlarm', () => {
        beforeEach(() => {
            jest.spyOn(settings, 'clearToken').mockResolvedValue(undefined);
            jest.spyOn(settings, 'load').mockResolvedValue(undefined);
            jest.spyOn(vaultApi, 'refreshToken').mockResolvedValue(undefined);
        });
        it('ignores unknown alarm', async () => {
            await getAlarmListener()({name: 'unknown alamm'});

            expect(settings.load).not.toBeCalled();
            expect(vaultApi.refreshToken).not.toBeCalled();
            expect(settings.clearToken).not.toBeCalled();
        });
        it('renews token', async () => {
            jest.spyOn(settings, 'load').mockResolvedValue({vaultUrl, token});
            jest.spyOn(vaultApi, 'refreshToken').mockResolvedValue(true);

            await getAlarmListener()({name: 'refresh-token'});

            expect(settings.load).toBeCalledTimes(1);
            expect(vaultApi.refreshToken).toBeCalledTimes(1);
            expect(vaultApi.refreshToken).toBeCalledWith(vaultUrl, token);
            expect(settings.clearToken).not.toBeCalled();
        });
        it('clears token if renewal fails', async () => {
            jest.spyOn(settings, 'load').mockResolvedValue({vaultUrl, token});
            jest.spyOn(vaultApi, 'refreshToken').mockResolvedValue(false);

            await getAlarmListener()({name: 'refresh-token'});

            expect(settings.load).toBeCalledTimes(1);
            expect(vaultApi.refreshToken).toBeCalledTimes(1);
            expect(vaultApi.refreshToken).toBeCalledWith(vaultUrl, token);
            expect(settings.clearToken).toBeCalledTimes(1);
        });
    });
});