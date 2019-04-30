import chai, {expect} from 'chai';
chai.use(require('sinon-chai'));
import sinon from 'sinon';
import {JSDOM} from 'jsdom';

const windowUrl = 'https://some.site';
const username = 'site user';
const password = 'passw0rd';

module.exports = {
    'contentScript': {
        beforeEach() {
            global.chrome.runtime = {
                onMessage: {addListener: sinon.stub()},
                sendMessage: sinon.stub()
            };
            global.window = {location: {href: windowUrl}};
            delete require.cache[require.resolve('../lib/contentScript')];
        },
        afterEach() {
            delete global.chrome;
            delete global.document;
            delete global.window;
        },
        'does not send message if no username or password inputs': () => {
            global.document = new JSDOM('<html></html>').window.document;

            require('../lib/contentScript');

            expect(chrome.runtime.sendMessage).to.not.be.called;
        },
        'sends message with username true if input exists': () => {
            global.document = new JSDOM('<html><input type="text" id="username"/></html>').window.document;

            require('../lib/contentScript');

            expect(chrome.runtime.sendMessage).to.be.calledOnce
                .calledWithExactly({username: true, password: false, url: windowUrl});
        },
        'sends message with password true if input exists': () => {
            global.document = new JSDOM('<html><input type="password"/></html>').window.document;

            require('../lib/contentScript');

            expect(chrome.runtime.sendMessage).to.be.calledOnce
                .calledWithExactly({username: false, password: true, url: windowUrl});
        },
        'message listener': {
            'does nothing if message not provided': () => {
                global.document = new JSDOM('<html></html>').window.document;
                require('../lib/contentScript');

                chrome.runtime.onMessage.addListener.args[0][0]();
            },
            'populates username field': () => {
                global.document = new JSDOM('<html><input type="text" id="username"/></html>').window.document;
                require('../lib/contentScript');
    
                chrome.runtime.onMessage.addListener.args[0][0]({username});

                expect(document.querySelector('input').value).to.equal(username);
            },
            'populates password field': () => {
                global.document = new JSDOM('<html><input type="password"/></html>').window.document;
                require('../lib/contentScript');
    
                chrome.runtime.onMessage.addListener.args[0][0]({password});

                expect(document.querySelector('input').value).to.equal(password);
            }
        }
    }
};