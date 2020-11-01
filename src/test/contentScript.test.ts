import './types/global';
import * as chai from 'chai';
chai.use(require('sinon-chai'));
const {expect} = chai;
import * as sinon from 'sinon';
import {JSDOM} from 'jsdom';
import {fromPairs} from 'lodash';
import {LoginInput, InputInfo} from '../lib/message';

const windowUrl = 'https://some.site';
const username = 'site user';
const email = 'user email';
const password = 'passw0rd';
const event = {type: 'change'};

function stubProperty(obj: any, name: string, value?: any) {
    const def = {
        get: sinon.stub().returns(value),
        set: sinon.stub(),
    };
    Object.defineProperty(obj, name, def);
    return def;
}
function stubEach<K extends string>(obj: any, ...props: K[]): {[P in K]: sinon.SinonStub} {
    return fromPairs(props.map(prop => [prop, sinon.stub(obj, prop)])) as {[P in K]: sinon.SinonStub};
}

function testSetInputByAttribute(loginInput: LoginInput, inputHtml: string) {
    global.document = new JSDOM(`<html>${inputHtml}</html>`).window.document;
    const input = document.querySelector('input');
    const inputValue = stubProperty(input, 'value', loginInput.value);
    const {dispatchEvent, setAttribute, getClientRects} = stubEach(input, 'dispatchEvent', 'setAttribute', 'getClientRects');
    getClientRects.returns([{}]);
    require('../lib/contentScript');

    chrome.runtime.onMessage.addListener.args[0][0]([loginInput]);

    expect(setAttribute).to.be.calledOnce.calledWithExactly('value', loginInput.value);
    expect(Event).to.be.calledOnce.calledWithExactly("change", {bubbles: true});
    expect(dispatchEvent).to.be.calledOnce.calledWithExactly(event);
    expect(inputValue.set).to.not.be.called;
}

function testSetInputByValue(loginInput: LoginInput, inputHtml: string) {
    global.document = new JSDOM(`<html>${inputHtml}</html>`).window.document;
    const input = document.querySelector('input');
    const inputValue = stubProperty(input, 'value');
    const {dispatchEvent, setAttribute, getClientRects} = stubEach(input, 'dispatchEvent', 'setAttribute', 'getClientRects');
    getClientRects.returns([{}]);
    require('../lib/contentScript');

    chrome.runtime.onMessage.addListener.args[0][0]([loginInput]);

    expect(setAttribute).to.be.calledOnce.calledWithExactly('value', loginInput.value);
    expect(Event).to.be.calledTwice
        .calledWithExactly("change", {bubbles: true})
        .calledWithExactly("input", {bubbles: true});
    expect(dispatchEvent).to.be.calledTwice.calledWithExactly(event);
    expect(inputValue.set).to.be.calledOnce.calledWithExactly(loginInput.value);
}

class MockRectList {
    private readonly _length: number;
    readonly [index: number]: DOMRect;

    constructor(...items: any[]) {
        this._length = items.length;
    }

    get length() {
        return this._length;
    }

    item(index: number): DOMRect {
        return null;
    }
}

function testSetInputWithLabel(field: string, value: string, body: string) {
    global.document = new JSDOM(`<html><body>${body}</body></html>`).window.document;
    const input = document.querySelector('input');
    const inputValue = stubProperty(input, 'value', value);
    const {dispatchEvent, setAttribute} = stubEach(input, 'dispatchEvent', 'setAttribute');
    sinon.stub(document.querySelector('input'), 'getClientRects').returns(new MockRectList({}));
    sinon.stub(document.querySelector('label'), 'getClientRects').returns(new MockRectList({}));
    require('../lib/contentScript');

    chrome.runtime.onMessage.addListener.args[0][0]([{label: field, value}]);

    expect(setAttribute).to.be.calledOnce.calledWithExactly('value', value);
    expect(Event).to.be.calledOnce.calledWithExactly("change", {bubbles: true});
    expect(dispatchEvent).to.be.calledOnce.calledWithExactly(event);
    expect(inputValue.set).to.not.be.called;
}

const getInputInfoById = (id: string) => new InputInfo(document.getElementById(id) as HTMLInputElement);

module.exports = {
    'contentScript': {
        beforeEach() {
            global.chrome.runtime = {
                onMessage: {addListener: sinon.stub()},
                sendMessage: sinon.stub(),
            };
            global.window = {location: {href: windowUrl}} as any;
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
        'sends message with username true if input id matches': () => {
            global.document = new JSDOM('<html><input type="text" id="username"/></html>').window.document;
            sinon.stub(document.getElementById('username'), 'getClientRects').returns(new MockRectList({}));

            require('../lib/contentScript');

            const inputs: InputInfo[] = [getInputInfoById('username')];
            expect(chrome.runtime.sendMessage).to.be.calledOnce.calledWithExactly({url: windowUrl, inputs});
        },
        'sends message with username true if input label matches': () => {
            global.document = new JSDOM('<html><label for="loginId">Username</label>'
                + '<input type="text" id="loginId" name="login.user"/></html>').window.document;
            sinon.stub(document.querySelector('label'), 'getClientRects').returns(new MockRectList({}));
            sinon.stub(document.querySelector('input'), 'getClientRects').returns(new MockRectList({}));

            require('../lib/contentScript');

            const inputs: InputInfo[] = [getInputInfoById('loginId')];
            expect(chrome.runtime.sendMessage).to.be.calledOnce.calledWithExactly({url: windowUrl, inputs});
        },
        'sends message with password true if input exists': () => {
            global.document = new JSDOM('<html><input type="password"/></html>').window.document;
            sinon.stub(document.querySelector('input'), 'getClientRects').returns(new MockRectList({}));

            require('../lib/contentScript');

            const inputs = [new InputInfo(document.querySelector('input'))];
            expect(chrome.runtime.sendMessage).to.be.calledOnce.calledWithExactly({url: windowUrl, inputs});
        },
        'sends message with email true if input exists': () => {
            global.document = new JSDOM('<html><input id="email" type="text"/></html>').window.document;
            sinon.stub(document.querySelector('input'), 'getClientRects').returns(new MockRectList({}));

            require('../lib/contentScript');

            const inputs: InputInfo[] = [getInputInfoById('email')];
            expect(chrome.runtime.sendMessage).to.be.calledOnce.calledWithExactly({url: windowUrl, inputs});
        },
        'sends message with email if input label matches': () => {
            global.document = new JSDOM('<html><label for="abc"><p><strong>Email</strong></p></label><input type="text" id="abc"/></html>').window.document;
            sinon.stub(document.querySelector('label'), 'getClientRects').returns(new MockRectList({}));
            sinon.stub(document.querySelector('p'), 'getClientRects').returns(new MockRectList({}));
            sinon.stub(document.querySelector('strong'), 'getClientRects').returns(new MockRectList({}));
            sinon.stub(document.querySelector('input'), 'getClientRects').returns(new MockRectList({}));

            require('../lib/contentScript');

            const inputs: InputInfo[] = [getInputInfoById('abc')];
            expect(chrome.runtime.sendMessage).to.be.calledOnce.calledWithExactly({url: windowUrl, inputs});
        },
        'message listener': {
            beforeEach() {
                global.Event = sinon.stub().returns(event) as any;
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
                testSetInputByAttribute({selector: 'input[id="username"]', value: username}, '<input type="text" id="username"/>');
            },
            'populates username field using value when setAttribute fails': () => {
                testSetInputByValue({selector: 'input[id="username"]', value: username}, '<input type="text" id="username"/>');
            },
            'populates username field by matching outer label': () => {
                testSetInputWithLabel('Username', username, '<label>Username<input type="text"/></label>');
            },
            'populates username field by matching label with "for"': () => {
                testSetInputWithLabel('Username', username, '<label for="login">Username</label><input id="login" type="text"/>');
            },
            'populates email field using setAttribute': () => {
                testSetInputByAttribute({selector: 'input[id="email"]', value: email}, '<input type="text" id="email"/>');
            },
            'populates email field using value when setAttribute fails': () => {
                testSetInputByValue({selector: 'input[name="email"]', value: email}, '<input type="text" name="email"/>');
            },
            'populates email field by matching outer label': () => {
                testSetInputWithLabel('Email', email, '<label>Email<input type="text"/></label>');
            },
            'populates password field using setAttribute': () => {
                testSetInputByAttribute({selector: 'input[type="password"]', value: password}, '<input type="password"/>');
            },
            'populates password field using value when setAttribute fails': () => {
                testSetInputByValue({selector: 'input[type="password"]', value: password}, '<input type="password"/>');
            },
        },
    },
};