import '../../test/types/global';
import type * as settings from '../settings';

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
let storage: StorageStub;
const alarms = chrome.alarms as AlarmStub;
const mockRuntime = chrome.runtime as IMockChromeRuntime;

const action = {name: 'show page'};

const getInstalledListener = () => mockRuntime.onInstalled.addListener.mock.calls[0][0];
const getStorageListener = () => storage.onChanged.addListener.mock.calls[0][0];
const getAlarmListener = () => alarms.onAlarm.addListener.mock.calls[0][0];

const load = (errorOrDomains: string[] | string) => {
    jest.isolateModules(() => {
        settingsStub = jest.requireActual<typeof settings>('../settings');
        jest.spyOn(settingsStub, 'refreshToken').mockResolvedValue();
        if (typeof errorOrDomains === 'string') jest.spyOn(settingsStub, 'getDomains').mockRejectedValue({message: errorOrDomains});
        else jest.spyOn(settingsStub, 'getDomains').mockResolvedValue(errorOrDomains);
        global.chrome.declarativeContent = {
            onPageChanged: {
                addRules: jest.fn(),
                removeRules: jest.fn().mockImplementation((x, cb) => cb()),
            } as unknown as typeof chrome.declarativeContent.onPageChanged,
            PageStateMatcher: jest.fn().mockImplementation((args) => ({args})),
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

            expect(settingsStub.getDomains).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.removeRules).not.toHaveBeenCalled();
            expect(chrome.declarativeContent.onPageChanged.addRules).not.toHaveBeenCalled();
        });
        it('clears page rules if no cached URLs', async () => {
            load([]);

            await getInstalledListener()();

            expect(chrome.declarativeContent.onPageChanged.removeRules).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).not.toHaveBeenCalled();
        });
        it('adds page rule for scheme domain', async () => {
            load(['site.com']);

            await getInstalledListener()();

            expect(chrome.declarativeContent.onPageChanged.removeRules).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.ShowPageAction).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toHaveBeenCalledWith([{
                actions: [action],
                conditions: [
                    {args: {pageUrl: {hostEquals: 'site.com', schemes: ['https']}}},
                    {args: {pageUrl: {hostSuffix: '.site.com', schemes: ['https']}}},
                ],
            }]);
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
        it('updates page rules when secretPaths changes', async () => {
            load(['site.com']);

            await getStorageListener()({secretPaths: {newValue: {'some.site.com': [{url: 'https://some.site.com'}]}}}, 'local');

            expect(chrome.declarativeContent.onPageChanged.removeRules).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.ShowPageAction).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toHaveBeenCalledTimes(1);
            expect(chrome.declarativeContent.onPageChanged.addRules).toHaveBeenCalledWith([{
                actions: [{name: 'show page'}],
                conditions: [
                    {args: {pageUrl: {hostEquals: 'site.com', schemes: ['https']}}},
                    {args: {pageUrl: {hostSuffix: '.site.com', schemes: ['https']}}},
                ],
            }]);
        });
    });
    describe('onAlarm', () => {
        it('ignores unknown alarm', async () => {
            load([]);

            await getAlarmListener()({name: 'unknown alamm'});

            expect(settingsStub.refreshToken).not.toHaveBeenCalled();
        });
        it('renews token', async () => {
            load([]);

            await getAlarmListener()({name: 'refresh-token'});

            expect(settingsStub.refreshToken).toHaveBeenCalledTimes(1);
        });
    });
});