import "jsdom"; // need an import for global declarations

declare global {
    namespace NodeJS {
        interface Global {
            window: {location: {href: string}};
            document: Document;
            chrome: any;
            Event: sinon.SinonStub;
        }
    }

    namespace chrome.runtime {
        interface RuntimeInstalledEvent {
            addListener: sinon.SinonStub;
        }

        interface ExtensionMessageEvent {
            addListener: sinon.SinonStub;
        }
    }
}
