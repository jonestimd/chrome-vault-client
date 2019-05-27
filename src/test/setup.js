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
        global.Node = {
            ELEMENT_NODE: 1
        };
    }
};