import {JSDOM} from 'jsdom';
import * as htmlUtil from './htmlUtil';

function loadPage(body: string) {
    const jsdom = new JSDOM(`<html><body>${body}</body></html>`);
    global.document = jsdom.window.document;
    global.HTMLLabelElement = jsdom.window.HTMLLabelElement;
}

function getInput() {
    return document.querySelector('input')!;
}

function getLabel() {
    return document.querySelector('label')!;
}

describe('htmlUtil', () => {
    describe('getLabel', () => {
        it('ignores hidden label with for=id', () => {
            loadPage('<label for="the-input">the label</label><input id="the-input"></input>');

            expect(htmlUtil.getLabel(getInput())).toBeNull();
        });
        it('finds label using for=id', () => {
            loadPage('<label for="the-input">the label</label><input id="the-input"></input>');
            jest.spyOn(document.querySelector('label')!, 'offsetParent', 'get').mockReturnValue(document.body);

            expect(htmlUtil.getLabel(getInput())).toEqual(getLabel());
        });
        it('finds ancestor label', () => {
            loadPage('<label>the label<input></input></label>');

            expect(htmlUtil.getLabel(getInput())).toEqual(getLabel());
        });
        it('returns undefined if no label found', () => {
            loadPage('<label>the label</label><input></input>');

            expect(htmlUtil.getLabel(getInput())).toBeNull();
        });
    });
    describe('getText', () => {
        it('ignores hidden elements', () => {
            loadPage('<label>the label<span>hidden text</span></label>');
            const span = document.querySelector('span')!;
            span.getClientRects = jest.fn().mockReturnValue([]);

            expect(htmlUtil.getText(getLabel())).toEqual('the label');
        });
        it('includes nested elements', () => {
            loadPage('<label>the label<span>nested text</span></label>');
            document.querySelector('span')!.getClientRects = jest.fn().mockReturnValue([{}]);

            expect(htmlUtil.getText(getLabel())).toEqual('the label nested text');
        });
        it('ignores nested scripts', () => {
            loadPage('<label>the label<script>script text</script></label>');
            document.querySelector('script')!.getClientRects = jest.fn().mockReturnValue([{}]);

            expect(htmlUtil.getText(getLabel())).toEqual('the label');
        });
        it('ignores nested styles', () => {
            loadPage('<label>the label<style>style text</style></label>');
            document.querySelector('style')!.getClientRects = jest.fn().mockReturnValue([{}]);

            expect(htmlUtil.getText(getLabel())).toEqual('the label');
        });
        it('ignores nested buttons', () => {
            loadPage('<label>the label<button>buttton text</button></label>');
            document.querySelector('button')!.getClientRects = jest.fn().mockReturnValue([{}]);

            expect(htmlUtil.getText(getLabel())).toEqual('the label');
        });
        it('ignores nested selects', () => {
            loadPage('<label>the label<select>select text<option>option text</option></select></label>');
            document.querySelector('select')!.getClientRects = jest.fn().mockReturnValue([{}]);
            document.querySelector('option')!.getClientRects = jest.fn().mockReturnValue([{}]);

            expect(htmlUtil.getText(getLabel())).toEqual('the label');
        });
        it('ignores nested images', () => {
            loadPage('<label>the label<i class="material-icons">search</i></label>');
            document.querySelector('i')!.getClientRects = jest.fn().mockReturnValue([{}]);

            expect(htmlUtil.getText(getLabel())).toEqual('the label');
        });
    });
});

