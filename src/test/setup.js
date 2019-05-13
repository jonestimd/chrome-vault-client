import * as sinon from 'sinon';

module.exports = {
    beforeEach() {
        global.chrome = {
            alarms: {
                create: sinon.stub(),
                onAlarm: {
                    addListener: sinon.stub()
                }
            },
            declarativeContent: {
                onPageChanged: {
                    addRules: sinon.stub(),
                    removeRules: sinon.stub().yields()
                },
                PageStateMatcher: sinon.stub(),
                ShowPageAction: sinon.stub()
            },
            storage: {
                local: {
                    get: sinon.stub(),
                    set: sinon.stub(),
                    remove: sinon.stub()
                },
                onChanged: {
                    addListener: sinon.stub()
                }
            },
            permissions: {
                getAll: sinon.stub(),
                request: sinon.stub()
            },
            runtime: {
                onInstalled: {
                    addListener: sinon.stub()
                },
                onMessage: {
                    addListener: sinon.stub()
                }
            },
            tabs: {
                sendMessage: sinon.stub(),
                executeScript: sinon.stub()
            }
        };
    }
};