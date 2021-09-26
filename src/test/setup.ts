/* eslint-disable @typescript-eslint/no-explicit-any */
global.chrome = {
    alarms: {
        create: jest.fn(),
        onAlarm: {
            addListener: jest.fn(),
        } as unknown as typeof chrome.alarms['onAlarm'],
    } as unknown as typeof chrome.alarms,
    runtime: {
        onInstalled: {
            addListener: jest.fn(),
        } as unknown as typeof chrome.runtime['onInstalled'],
        onMessage: {
            addListener: jest.fn(),
        } as unknown as typeof chrome.runtime['onMessage'],
        sendMessage: jest.fn(),
        getPlatformInfo: jest.fn().mockResolvedValue({os: 'Linux'}),
    } as unknown as typeof chrome.runtime,
    tabs: {
        sendMessage: jest.fn(),
        executeScript: jest.fn(),
        getCurrent: jest.fn().mockReturnValue({id: 42}),
        onCreated: {
            addListener: jest.fn(),
        },
    } as unknown as typeof chrome.tabs,
} as typeof chrome;
global.Node = {
    ELEMENT_NODE: 1,
} as any;
