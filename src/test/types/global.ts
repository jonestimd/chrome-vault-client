/* eslint-disable @typescript-eslint/no-namespace */
import "jsdom"; // need an import for global declarations

declare global {
    namespace NodeJS {
        interface Global {
            window: {location: {href: string}};
            document: Document;
            chrome: any;
            Event: jest.MockedFunction<any>;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    namespace chrome.runtime {
        interface RuntimeInstalledEvent {
            addListener: jest.MockedFunction<any>;
        }

        interface ExtensionMessageEvent {
            addListener: jest.MockedFunction<any>;
        }
    }
}
