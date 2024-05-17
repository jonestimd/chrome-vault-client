import {JSDOM} from 'jsdom';
import PropSelect from './PropSelect';
import {MDCSelect} from '@material/select';

jest.mock('@material/select');

let parent: HTMLDivElement;
const propName = 'username';

const MockMdcSelect = MDCSelect as jest.MockedClass<typeof MDCSelect>;

const getOptionText = (option?: Element)=> option?.querySelector('span.mdc-deprecated-list-item__text')?.textContent;

describe('PropSelect', () => {
    beforeEach(() => {
        global.window = new JSDOM('<html><body><div id="inputs"></div></body></html>').window as any;
        global.document = window.document;
        global.DOMParser = window.DOMParser;
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
            const mockSelect = {
                layoutOptions: jest.fn(),
                selectedIndex: 0,
            };
            MockMdcSelect.mockReturnValue(mockSelect as unknown as MDCSelect);
            const input = new PropSelect(parent, propName);

            input.addOptions([{frameId: 'top', refId: 1, type: 'text', label: propName}]);

            expect(mockSelect.selectedIndex).toEqual(1);
        });
        it('adds option for password input', () => {
            const input = new PropSelect(parent, propName);

            input.addOptions([{frameId: 'top', refId: 1, type: 'password'}]);

            const options = parent.querySelectorAll('ul li');
            expect(options.length).toEqual(2);
            expect(getOptionText(options[1])).toEqual('password');
        });
        it('selects password option for password input', () => {
            const mockSelect = {
                layoutOptions: jest.fn(),
                selectedIndex: 0,
            };
            MockMdcSelect.mockReturnValue(mockSelect as unknown as MDCSelect);
            const input = new PropSelect(parent, 'password');

            input.addOptions([{frameId: 'top', refId: 1, type: 'password'}]);

            expect(mockSelect.selectedIndex).toEqual(1);
        });
        it('does not add option for input without name', () => {
            const input = new PropSelect(parent, propName);

            input.addOptions([{frameId: 'top', refId: 1, type: 'text'}]);

            const options = parent.querySelectorAll('ul li');
            expect(options.length).toEqual(1);
        });
        it('re-selects matching input', () => {
            const input = new PropSelect(parent, 'username');
            const options = [
                {frameId: 'top.1', refId: 1, type: 'text', label: 'username'},
                {frameId: 'top', refId: 2, type: 'text', label: 'username', placeholder: 'User Name'},
                {frameId: 'top', refId: 1, type: 'text', label: 'username'},
            ];

            input.addOptions(options, {frameId: 'top', type: 'text', label: 'username'});

            expect(input.selectedInputInfo).toEqual(options[2]);
        });
    });
});
