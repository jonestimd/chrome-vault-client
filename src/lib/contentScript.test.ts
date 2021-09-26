import {JSDOM} from 'jsdom';
import {LoginInput, InputInfo} from './message';

const windowUrl = 'https://some.site';
const username = 'site user';
const email = 'user email';
const password = 'passw0rd';
const event = {type: 'change'};
const mockRuntime = chrome.runtime as IMockChromeRuntime;

function mockValue(input: HTMLInputElement, value?: string) {
    jest.spyOn(input, 'value', 'get').mockReturnValue(value ?? '');
    const valueSetter = jest.spyOn(input, 'value', 'set').mockImplementation(() => {});
    return valueSetter;
}
function stubEach<T, K extends jest.FunctionPropertyNames<T>>(input: T, ...props: K[]) {
    return Object.fromEntries(props.map((prop) => {
        const spy = jest.spyOn(input, prop).mockReturnValue(undefined as any);
        return [prop, spy];
    }));
}

function testSetInputByAttribute(loginInput: LoginInput, inputHtml: string) {
    global.document = new JSDOM(`<html>${inputHtml}</html>`).window.document;
    const input = document.querySelector<HTMLInputElement>('input')!;
    const valueSetter = mockValue(input, loginInput.value);
    const {dispatchEvent, setAttribute, getClientRects} = stubEach(input, 'dispatchEvent', 'setAttribute', 'getClientRects');
    getClientRects.mockReturnValue([{}] as any);
    jest.isolateModules(() => require('./contentScript'));

    mockRuntime.onMessage.addListener.mock.calls[0][0]([loginInput]);

    expect(setAttribute).toBeCalledTimes(1);
    expect(setAttribute).toBeCalledWith('value', loginInput.value);
    expect(Event).toBeCalledTimes(1);
    expect(Event).toBeCalledWith("change", {bubbles: true});
    expect(dispatchEvent).toBeCalledTimes(1);
    expect(dispatchEvent).toBeCalledWith(event);
    expect(valueSetter).not.toBeCalled();
}

function testSetInputByValue(loginInput: LoginInput, inputHtml: string) {
    global.document = new JSDOM(`<html>${inputHtml}</html>`).window.document;
    const input = document.querySelector<HTMLInputElement>('input')!;
    const valueSetter = mockValue(input);
    const {dispatchEvent, setAttribute, getClientRects} = stubEach(input, 'dispatchEvent', 'setAttribute', 'getClientRects');
    getClientRects.mockReturnValue([{}] as any);
    jest.isolateModules(() => require('./contentScript'));

    mockRuntime.onMessage.addListener.mock.calls[0][0]([loginInput]);

    expect(setAttribute).toBeCalledTimes(1);
    expect(setAttribute).toBeCalledWith('value', loginInput.value);
    expect(Event).toBeCalledTimes(2);
    expect(Event).toBeCalledWith("change", {bubbles: true});
    expect(Event).toBeCalledWith("input", {bubbles: true});
    expect(dispatchEvent).toBeCalledTimes(2);
    expect(dispatchEvent).toBeCalledWith(event);
    expect(valueSetter).toBeCalledTimes(1);
    expect(valueSetter).toBeCalledWith(loginInput.value);
}

class MockRectList {
    private readonly _length: number;
    readonly [index: number]: DOMRect;

    constructor(length: number) {
        this._length = length;
    }

    get length() {
        return this._length;
    }

    item(index: number): DOMRect | null {
        return null;
    }
}

function testSetInputWithLabel(field: string, value: string, body: string) {
    global.document = new JSDOM(`<html><body>${body}</body></html>`).window.document;
    const input = document.querySelector<HTMLInputElement>('input')!;
    const valueSetter = mockValue(input, value);
    const {dispatchEvent, setAttribute} = stubEach(input, 'dispatchEvent', 'setAttribute');
    jest.spyOn(document.querySelector('input')!, 'getClientRects').mockReturnValue(new MockRectList(1));
    jest.spyOn(document.querySelector('label')!, 'getClientRects').mockReturnValue(new MockRectList(1));
    jest.isolateModules(() => require('./contentScript'));

    mockRuntime.onMessage.addListener.mock.calls[0][0]([{label: field, value}]);

    expect(setAttribute).toBeCalledTimes(1);
    expect(setAttribute).toBeCalledWith('value', value);
    expect(Event).toBeCalledTimes(1);
    expect(Event).toBeCalledWith("change", {bubbles: true});
    expect(dispatchEvent).toBeCalledTimes(1);
    expect(dispatchEvent).toBeCalledWith(event);
    expect(valueSetter).not.toBeCalled();
}

const getInputInfoById = (id: string) => new InputInfo(document.getElementById(id) as HTMLInputElement);

describe('contentScript', () => {
    beforeEach(() => {
        global.window = {location: {href: windowUrl}} as any;
    });
    it('does not send message if no username or password inputs', () => {
        global.document = new JSDOM('<html></html>').window.document;

        jest.isolateModules(() => require('./contentScript'));

        expect(mockRuntime.sendMessage).not.toBeCalled();
    });
    it('sends message with username true if input id matches', () => {
        global.document = new JSDOM('<html><input type="text" id="username"/></html>').window.document;
        jest.spyOn(document.getElementById('username')!, 'getClientRects').mockReturnValue(new MockRectList(1));

        jest.isolateModules(() => require('./contentScript'));

        const inputs: InputInfo[] = [getInputInfoById('username')];
        expect(mockRuntime.sendMessage).toBeCalledTimes(1);
        expect(mockRuntime.sendMessage).toBeCalledWith({url: windowUrl, inputs});
    });
    it('sends message with username true if input label matches', () => {
        global.document = new JSDOM('<html><label for="loginId">Username</label>'
            + '<input type="text" id="loginId" name="login.user"/></html>').window.document;
        jest.spyOn(document.querySelector('label')!, 'getClientRects').mockReturnValue(new MockRectList(1));
        jest.spyOn(document.querySelector('input')!, 'getClientRects').mockReturnValue(new MockRectList(1));

        jest.isolateModules(() => require('./contentScript'));

        const inputs: InputInfo[] = [getInputInfoById('loginId')];
        expect(mockRuntime.sendMessage).toBeCalledTimes(1);
        expect(mockRuntime.sendMessage).toBeCalledWith({url: windowUrl, inputs});
    });
    it('sends message with password true if input exists', () => {
        global.document = new JSDOM('<html><input type="password"/></html>').window.document;
        jest.spyOn(document.querySelector('input')!, 'getClientRects').mockReturnValue(new MockRectList(1));

        jest.isolateModules(() => require('./contentScript'));

        const inputs = [new InputInfo(document.querySelector('input')!)];
        expect(mockRuntime.sendMessage).toBeCalledTimes(1);
        expect(mockRuntime.sendMessage).toBeCalledWith({url: windowUrl, inputs});
    });
    it('sends message with email true if input exists', () => {
        global.document = new JSDOM('<html><input id="email" type="text"/></html>').window.document;
        jest.spyOn(document.querySelector('input')!, 'getClientRects').mockReturnValue(new MockRectList(1));

        jest.isolateModules(() => require('./contentScript'));

        const inputs: InputInfo[] = [getInputInfoById('email')];
        expect(mockRuntime.sendMessage).toBeCalledTimes(1);
        expect(mockRuntime.sendMessage).toBeCalledWith({url: windowUrl, inputs});
    });
    it('sends message with email if input label matches', () => {
        global.document = new JSDOM('<html><label for="abc"><p><strong>Email</strong></p></label><input type="text" id="abc"/></html>').window.document;
        jest.spyOn(document.querySelector('label')!, 'getClientRects').mockReturnValue(new MockRectList(1));
        jest.spyOn(document.querySelector('p')!, 'getClientRects').mockReturnValue(new MockRectList(1));
        jest.spyOn(document.querySelector('strong')!, 'getClientRects').mockReturnValue(new MockRectList(1));
        jest.spyOn(document.querySelector('input')!, 'getClientRects').mockReturnValue(new MockRectList(1));

        jest.isolateModules(() => require('./contentScript'));

        const inputs: InputInfo[] = [getInputInfoById('abc')];
        expect(mockRuntime.sendMessage).toBeCalledTimes(1);
        expect(mockRuntime.sendMessage).toBeCalledWith({url: windowUrl, inputs});
    });
    describe('message listener', () => {
        beforeEach(() => {
            global.Event = jest.fn().mockReturnValue(event) as any;
        });
        afterEach(() => {
            global.Event = {} as any;
        });
        it('does nothing if message not provided', () => {
            global.document = new JSDOM('<html></html>').window.document;
            jest.isolateModules(() => require('./contentScript'));

            mockRuntime.onMessage.addListener.mock.calls[0][0]();
        });
        it('ignores hidden inputs', () => {
            global.document = new JSDOM('<html><input type="text" id="username"/></html>').window.document;
            const input = document.querySelector<HTMLInputElement>('input')!;
            const valueSetter = mockValue(input, username);
            const {dispatchEvent, setAttribute, getClientRects} = stubEach(input, 'dispatchEvent', 'setAttribute', 'getClientRects');
            getClientRects.mockReturnValue([] as any);
            jest.isolateModules(() => require('./contentScript'));

            mockRuntime.onMessage.addListener.mock.calls[0][0]([{selector: '#username', value: username}]);

            expect(setAttribute).not.toBeCalled();
            expect(Event).not.toBeCalled();
            expect(dispatchEvent).not.toBeCalled();
            expect(valueSetter).not.toBeCalled();
        });
        it('populates username field using setAttribute', () => {
            testSetInputByAttribute({selector: 'input[id="username"]', value: username}, '<input type="text" id="username"/>');
        });
        it('populates username field using value when setAttribute fails', () => {
            testSetInputByValue({selector: 'input[id="username"]', value: username}, '<input type="text" id="username"/>');
        });
        it('populates username field by matching outer label', () => {
            testSetInputWithLabel('Username', username, '<label>Username<input type="text"/></label>');
        });
        it('populates username field by matching label with "for"', () => {
            testSetInputWithLabel('Username', username, '<label for="login">Username</label><input id="login" type="text"/>');
        });
        it('populates email field using setAttribute', () => {
            testSetInputByAttribute({selector: 'input[id="email"]', value: email}, '<input type="text" id="email"/>');
        });
        it('populates email field using value when setAttribute fails', () => {
            testSetInputByValue({selector: 'input[name="email"]', value: email}, '<input type="text" name="email"/>');
        });
        it('populates email field by matching outer label', () => {
            testSetInputWithLabel('Email', email, '<label>Email<input type="text"/></label>');
        });
        it('populates password field using setAttribute', () => {
            testSetInputByAttribute({selector: 'input[type="password"]', value: password}, '<input type="password"/>');
        });
        it('populates password field using value when setAttribute fails', () => {
            testSetInputByValue({selector: 'input[type="password"]', value: password}, '<input type="password"/>');
        });
    });
});

