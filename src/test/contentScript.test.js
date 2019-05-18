import * as chai from 'chai';
chai.use(require('sinon-chai'));
const {expect} = chai;
import * as sinon from 'sinon';
import {JSDOM} from 'jsdom';

const windowUrl = 'https://some.site';
const username = 'site user';
const password = 'passw0rd';
const event = {type: 'change'};

function stubProperty(obj, name, value) {
    const def = {
        get: sinon.stub().returns(value),
        set: sinon.stub()
    };
    Object.defineProperty(obj, name, def);
    return def;
}
function stubEach(obj, ...props) {
    return props.reduce((stubs, prop) => Object.assign(stubs, {[prop]: sinon.stub(obj, prop)}), {});
}

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
            beforeEach() {
                global.Event = sinon.stub().returns(event);
            },
            afterEach() {
                delete global.Event;
            },
            'does nothing if message not provided': () => {
                global.document = new JSDOM('<html></html>').window.document;
                require('../lib/contentScript');

                chrome.runtime.onMessage.addListener.args[0][0]();
            },
            'ignores hidden inputs': () => {
                global.document = new JSDOM('<html><input type="text" id="username"/></html>').window.document;
                const input = document.querySelector('input');
                const value = stubProperty(input, 'value', username);
                const {dispatchEvent, setAttribute, getClientRects} = stubEach(input, 'dispatchEvent', 'setAttribute', 'getClientRects');
                getClientRects.returns([]);
                require('../lib/contentScript');

                chrome.runtime.onMessage.addListener.args[0][0]({username});

                expect(setAttribute).to.not.be.called;
                expect(Event).to.not.be.called;
                expect(dispatchEvent).to.not.be.called;
                expect(value.set).to.not.be.called;
            },
            'populates username field using setAttribute': () => {
                global.document = new JSDOM('<html><input type="text" id="username"/></html>').window.document;
                const input = document.querySelector('input');
                const value = stubProperty(input, 'value', username);
                const {dispatchEvent, setAttribute, getClientRects} = stubEach(input, 'dispatchEvent', 'setAttribute', 'getClientRects');
                getClientRects.returns([{}]);
                require('../lib/contentScript');

                chrome.runtime.onMessage.addListener.args[0][0]({username});

                expect(setAttribute).to.be.calledOnce.calledWithExactly('value', username);
                expect(Event).to.be.calledOnce.calledWithExactly("change", {bubbles: true});
                expect(dispatchEvent).to.be.calledOnce.calledWithExactly(event);
                expect(value.set).to.not.be.called;
            },
            'populates username field using value when setAttribute fails': () => {
                global.document = new JSDOM('<html><input type="text" id="username"/></html>').window.document;
                const input = document.querySelector('input');
                const value = stubProperty(input, 'value');
                const {dispatchEvent, setAttribute, getClientRects} = stubEach(input, 'dispatchEvent', 'setAttribute', 'getClientRects');
                getClientRects.returns([{}]);
                require('../lib/contentScript');

                chrome.runtime.onMessage.addListener.args[0][0]({username});

                expect(setAttribute).to.be.calledOnce.calledWithExactly('value', username);
                expect(Event).to.be.calledTwice
                    .calledWithExactly("change", {bubbles: true})
                    .calledWithExactly("input", {bubbles: true});
                expect(dispatchEvent).to.be.calledTwice.calledWithExactly(event);
                expect(value.set).to.be.calledOnce.calledWithExactly(username);
            },
            'populates password field using setAttribute': () => {
                global.document = new JSDOM('<html><input type="password"/></html>').window.document;
                const input = document.querySelector('input');
                const value = stubProperty(input, 'value', password);
                const {dispatchEvent, setAttribute, getClientRects} = stubEach(input, 'dispatchEvent', 'setAttribute', 'getClientRects');
                getClientRects.returns([{}]);
                require('../lib/contentScript');

                chrome.runtime.onMessage.addListener.args[0][0]({password});

                expect(setAttribute).to.be.calledOnce.calledWithExactly('value', password);
                expect(Event).to.be.calledOnce.calledWithExactly("change", {bubbles: true});
                expect(dispatchEvent).to.be.calledOnce.calledWithExactly(event);
                expect(value.set).to.not.be.called;
            },
            'populates password field using value when setAttribute fails': () => {
                global.document = new JSDOM('<html><input type="password"/></html>').window.document;
                const input = document.querySelector('input');
                const value = stubProperty(input, 'value');
                const {dispatchEvent, setAttribute, getClientRects} = stubEach(input, 'dispatchEvent', 'setAttribute', 'getClientRects');
                getClientRects.returns([{}]);
                require('../lib/contentScript');

                chrome.runtime.onMessage.addListener.args[0][0]({password});

                expect(setAttribute).to.be.calledOnce.calledWithExactly('value', password);
                expect(Event).to.be.calledTwice
                    .calledWithExactly("change", {bubbles: true})
                    .calledWithExactly("input", {bubbles: true});
                expect(dispatchEvent).to.be.calledTwice.calledWithExactly(event);
                expect(value.set).to.be.calledOnce.calledWithExactly(password);
            }
        }
    }
};