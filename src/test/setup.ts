global.chrome = {
    alarms: {
        create: jest.fn(),
        onAlarm: {
            addListener: jest.fn(),
        },
    },
    runtime: {
        onInstalled: {
            addListener: jest.fn(),
        },
        onMessage: {
            addListener: jest.fn(),
        },
    },
    tabs: {
        sendMessage: jest.fn(),
        executeScript: jest.fn(),
    },
};
global.Node = {
    ELEMENT_NODE: 1,
} as any;
