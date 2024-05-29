import {JSDOM} from 'jsdom';
import {InputInfoProps} from './message';

const windowUrl = 'https://some.site';
const username = 'site user';
const event = {type: 'change'};
const mockRuntime = chrome.runtime as IMockChromeRuntime;

function mockValue(input: HTMLInputElement, value?: string) {
    jest.spyOn(input, 'value', 'get').mockReturnValue(value ?? '');
    const valueSetter = jest.spyOn(input, 'value', 'set').mockImplementation(() => { });
    return valueSetter;
}
function stubEach<T extends {}, K extends jest.FunctionPropertyNames<T>>(input: T, ...props: K[]): Record<K, ReturnType<typeof jest.spyOn>> {
    return Object.fromEntries(props.map((prop) => {
        const spy = jest.spyOn(input, prop).mockReturnValue(undefined as any);
        return [prop, spy];
    }));
}

function loadHtml(html: string) {
    const jsdom = new JSDOM(html);
    global.HTMLElement = jsdom.window.HTMLElement;
    global.HTMLLabelElement = jsdom.window.HTMLLabelElement;
    global.DOMParser = jsdom.window.DOMParser;
    return jsdom.window.document;
}

const frameId = 'top';

const mockVisible = (element: HTMLElement, x = 0, y = 0) => {
    jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({x, y, right: 1, left: 0, height: 1, width: 1, top: 0, bottom: 1, toJSON: () => ''});
    jest.spyOn(element, 'offsetParent', 'get').mockReturnValue(document.body);
};

const sendGetInputs = () => {
    const port = {
        name: 'popup',
        postMessage: jest.fn(),
        onMessage: {
            addListener: jest.fn(),
        },
    };
    jest.isolateModules(() => require('./contentScript'));
    mockRuntime.onConnect.addListener.mock.calls[0][0](port);
    port.onMessage.addListener.mock.calls[0][0]('get-inputs');
    return port;
};

const getInputInfo = (props: Omit<InputInfoProps, 'frameId'>) => ({frameId, id: '', label: null, name: '', placeholder: '', ...props});

describe('contentScript', () => {
    beforeEach(() => {
        global.window = {location: {href: windowUrl}} as any;
        global.window.top = global.window;
    });
    describe('get-inputs', () => {
        it('does not send message if no text or password inputs', () => {
            global.document = loadHtml('<html><input type="button" id="submit"/></html>');
            mockVisible(document.getElementById('submit')!);

            const port = sendGetInputs();

            expect(port.postMessage).not.toHaveBeenCalled();
        });
        it('ignores invisible input', () => {
            global.document = loadHtml('<html><input type="text" id="username"/></html>');

            const port = sendGetInputs();

            expect(port.postMessage).not.toHaveBeenCalled();
        });
        it('sends message for input with default type', () => {
            global.document = loadHtml('<html><input id="username"/></html>');
            mockVisible(document.getElementById('username')!);

            const port = sendGetInputs();

            expect(port.postMessage).toHaveBeenCalledWith({
                url: window.location.href,
                inputs: [getInputInfo({refId: 0, id: 'username', type: 'text'})],
            });
        });
        it('sends message for input with id', () => {
            global.document = loadHtml('<html><input type="text" id="username"/></html>');
            mockVisible(document.getElementById('username')!);

            const port = sendGetInputs();

            expect(port.postMessage).toHaveBeenCalledWith({
                url: window.location.href,
                inputs: [getInputInfo({refId: 0, id: 'username', type: 'text'})],
            });
        });
        it('sends message for input with label, id and name', () => {
            global.document = loadHtml('<html><label for="loginId">Username</label><input type="text" id="loginId" name="login.user"/></html>');
            mockVisible(document.querySelector('label')!);
            mockVisible(document.querySelector('input')!);

            const port = sendGetInputs();

            expect(port.postMessage).toHaveBeenCalledWith({
                url: windowUrl,
                inputs: [getInputInfo({refId: 0, type: 'text', label: 'Username', id: 'loginId', name: 'login.user'})],
            });
        });
        it('sends message for password input', () => {
            global.document = loadHtml('<html><input type="password"/></html>');
            mockVisible(document.querySelector('input')!);

            const port = sendGetInputs();

            expect(port.postMessage).toHaveBeenCalledWith({
                url: windowUrl,
                inputs: [getInputInfo({refId: 0, type: 'password'})],
            });
        });
        it('sends message for added input', () => {
            global.document = loadHtml('<html><body><input type="password"/></body></html>');
            mockVisible(document.querySelector('input')!);
            sendGetInputs();
            document.body.appendChild(new DOMParser().parseFromString('<div><input type="text" id="loginId"/></div>', 'text/html').body.firstElementChild!);
            mockVisible(document.querySelector('#loginId')!);
            console.info(document.body.innerHTML);

            const port = sendGetInputs();

            expect(port.postMessage).toHaveBeenCalledWith({
                url: windowUrl,
                inputs: [
                    getInputInfo({refId: 0, type: 'password'}),
                    getInputInfo({refId: 1, type: 'text', id: 'loginId'}),
                ],
            });
        });
    });
    describe('message listener', () => {
        let MockEvent: jest.Mock;
        beforeEach(() => {
            global.Event = MockEvent = jest.fn().mockReturnValue(event) as any;
        });
        afterEach(() => {
            global.Event = {} as any;
        });
        it('does nothing for empty message', () => {
            global.document = loadHtml('<html></html>');
            sendGetInputs();

            mockRuntime.onMessage.addListener.mock.calls[0][0]([]);
        });
        it('populates field using setAttribute', () => {
            global.document = loadHtml('<html><input type="text" id="username"/></html>');
            const input = document.querySelector<HTMLInputElement>('input')!;
            mockVisible(input);
            sendGetInputs();
            const valueSetter = mockValue(input, username);
            const {dispatchEvent, setAttribute} = stubEach(input, 'dispatchEvent', 'setAttribute');

            mockRuntime.onMessage.addListener.mock.calls[0][0]([{frameId, refId: 0, value: username}]);

            expect(setAttribute).toHaveBeenCalledTimes(1);
            expect(setAttribute).toHaveBeenCalledWith('value', username);
            expect(MockEvent).toHaveBeenCalledTimes(4);
            expect(MockEvent.mock.calls).toEqual([
                ['focus', {bubbles: true}],
                ['input', {bubbles: true}],
                ['change', {bubbles: true}],
                ['blur', {bubbles: true}],
            ]);
            expect(dispatchEvent).toHaveBeenCalledTimes(4);
            expect(dispatchEvent).toHaveBeenCalledWith(event);
            expect(valueSetter).not.toHaveBeenCalled();
        });
        it('populates username field using value when setAttribute fails', () => {
            global.document = loadHtml('<html><input type="text" id="username"/></html>');
            const input = document.querySelector<HTMLInputElement>('input')!;
            mockVisible(input);
            sendGetInputs();
            const valueSetter = mockValue(input);
            const {dispatchEvent, setAttribute, getClientRects} = stubEach(input, 'dispatchEvent', 'setAttribute', 'getClientRects');
            getClientRects.mockReturnValue([{}] as any);
            jest.isolateModules(() => require('./contentScript'));

            mockRuntime.onMessage.addListener.mock.calls[0][0]([{frameId, refId: 0, value: username}]);

            expect(setAttribute).toHaveBeenCalledTimes(1);
            expect(setAttribute).toHaveBeenCalledWith('value', username);
            expect(MockEvent).toHaveBeenCalledTimes(6);
            expect(MockEvent.mock.calls).toEqual([
                ['focus', {bubbles: true}],
                ['input', {bubbles: true}],
                ['change', {bubbles: true}],
                ['input', {bubbles: true}],
                ['change', {bubbles: true}],
                ['blur', {bubbles: true}],
            ]);
            expect(dispatchEvent).toHaveBeenCalledTimes(6);
            expect(dispatchEvent).toHaveBeenCalledWith(event);
            expect(valueSetter).toHaveBeenCalledTimes(1);
            expect(valueSetter).toHaveBeenCalledWith(username);
        });
    });
});

