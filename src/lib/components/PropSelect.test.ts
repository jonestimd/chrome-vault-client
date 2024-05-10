import {JSDOM} from 'jsdom';
import PropSelect from './PropSelect';

let parent: HTMLDivElement;
const propName = 'username';

const getOptionText = (option?: Element)=> option?.querySelector('span.mdc-deprecated-list-item__text')?.textContent;

describe('PropSelect', () => {
    beforeEach(() => {
        global.window = new JSDOM('<html><body><div id="inputs"></div></body></html>').window as any;
        global.document = window.document;
        parent = document.querySelector('#inputs')!;
    });
    afterEach(() => {
        global.window = {} as any;
        global.document = {} as any;
    });
    describe('constructor', () => {
        it('appends input to parent', () => {
            new PropSelect(parent, propName);

            expect(parent.querySelector('div.mdc-select.mdc-select--filled')).not.toBeNull();
            expect(parent.querySelector('span.mdc-floating-label b')?.textContent).toEqual(propName);
        });
        it('adds empty option', () => {
            const input = new PropSelect(parent, propName);

            const options = parent.querySelectorAll('ul li');
            expect(options.length).toEqual(1);
            expect(getOptionText(options[0])).toEqual('');
            expect(input.selectedInputInfo).toBeUndefined();
        });
    });
    describe('addOptions', () => {
        it('adds option for input with name', () => {
            const input = new PropSelect(parent, propName);

            input.addOptions([{frameId: 'top', refId: 1, type: 'text', label: 'username'}]);

            const options = parent.querySelectorAll('ul li');
            expect(options.length).toEqual(2);
            expect(getOptionText(options[1])).toEqual('username');
        });
        it('selects option that matches prop name', () => {
            const input = new PropSelect(parent, propName);

            input.addOptions([{frameId: 'top', refId: 1, type: 'text', label: propName}]);

            expect(input.selectedInputInfo?.refId).toEqual(1);
        });
        it('adds option for password input', () => {
            const input = new PropSelect(parent, propName);

            input.addOptions([{frameId: 'top', refId: 1, type: 'password'}]);

            const options = parent.querySelectorAll('ul li');
            expect(options.length).toEqual(2);
            expect(getOptionText(options[1])).toEqual('password');
        });
        it('selects password option for password input', () => {
            const input = new PropSelect(parent, 'password');

            input.addOptions([{frameId: 'top', refId: 1, type: 'password'}]);

            expect(input.selectedInputInfo?.refId).toEqual(1);
        });
        it('does not add option for input without name', () => {
            const input = new PropSelect(parent, propName);

            input.addOptions([{frameId: 'top', refId: 1, type: 'text'}]);

            const options = parent.querySelectorAll('ul li');
            expect(options.length).toEqual(1);
        });
    });
});
