/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-namespace */
import 'jsdom'; // need an import for global declarations

declare global {
    namespace NodeJS {
        interface Global {
            window: {location: {href: string}};
            document: Document;
            chrome: any;
            Event: jest.MockedFunction<any>;
        }
    }

    interface IMockChromeRuntime {
        onInstalled: {
            addListener: jest.MockedFunction<any>;
        }
        onMessage: {
            addListener: jest.MockedFunction<any>;
        }
        onConnect: {
            addListener: jest.MockedFunction<any>;
        }
        sendMessage: jest.MockedFunction<any>;
        getPlatformInfo: jest.MockedFunction<any>;
    }

    interface IMockTabs {
        sendMessage: jest.MockedFunction<any>,
        executeScript: jest.MockedFunction<any>,
        query: jest.MockedFunction<any>;
        connect: jest.MockedFunction<any>;
        onCreated: {
            addListener: jest.MockedFunction<any>;
        };
    }
}
