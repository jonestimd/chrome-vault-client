import * as chai from 'chai';
chai.use(require('sinon-chai'));
const {expect} = chai;
import {JSDOM} from 'jsdom';
import * as sinon from 'sinon';
import * as htmlUtil from '../lib/htmlUtil';

function loadPage(body: string) {
    global.document = new JSDOM(`<html><body>${body}</body></html>`).window.document;
}

function getInput() {
    return document.querySelector('input');
}

function getLabel() {
    return document.querySelector('label');
}

module.exports = {
    htmlUtil: {
        getLabel: {
            'finds label using for=id': () => {
                loadPage('<label for="the-input">the label</label><input id="the-input"></input>');

                expect(htmlUtil.getLabel(getInput())).to.equal(getLabel());
            },
            'finds ancestor label': () => {
                loadPage('<label>the label<input></input></label>');

                expect(htmlUtil.getLabel(document.querySelector('input'))).to.equal(getLabel());
            },
            'returns undefined if no label found': () => {
                loadPage('<label>the label</label><input></input>');

                expect(htmlUtil.getLabel(document.querySelector('input'))).to.be.null;
            },
        },
        getText: {
            'ignores hidden elements': () => {
                loadPage('<label>the label<span>hidden text</span></label>');
                const span = document.querySelector('span');
                span.getClientRects = sinon.stub().returns([]);

                expect(htmlUtil.getText(getLabel())).to.equal('the label');
            },
            'includes nested elements': () => {
                loadPage('<label>the label<span>nested text</span></label>');
                document.querySelector('span').getClientRects = sinon.stub().returns([{}]);

                expect(htmlUtil.getText(getLabel())).to.equal('the label nested text');
            },
            'ignores nested scripts': () => {
                loadPage('<label>the label<script>script text</script></label>');
                document.querySelector('script').getClientRects = sinon.stub().returns([{}]);

                expect(htmlUtil.getText(getLabel())).to.equal('the label');
            },
            'ignores nested styles': () => {
                loadPage('<label>the label<style>style text</style></label>');
                document.querySelector('style').getClientRects = sinon.stub().returns([{}]);

                expect(htmlUtil.getText(getLabel())).to.equal('the label');
            },
            'ignores nested buttons': () => {
                loadPage('<label>the label<button>buttton text</button></label>');
                document.querySelector('button').getClientRects = sinon.stub().returns([{}]);

                expect(htmlUtil.getText(getLabel())).to.equal('the label');
            },
            'ignores nested selects': () => {
                loadPage('<label>the label<select>select text<option>option text</option></select></label>');
                document.querySelector('select').getClientRects = sinon.stub().returns([{}]);
                document.querySelector('option').getClientRects = sinon.stub().returns([{}]);

                expect(htmlUtil.getText(getLabel())).to.equal('the label');
            },
        },
    },
};