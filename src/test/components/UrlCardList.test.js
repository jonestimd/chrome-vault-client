import * as chai from 'chai';
const {expect} = chai;
chai.use(require('sinon-chai'));
import * as sinon from 'sinon';
import {JSDOM} from 'jsdom';
import UrlCardList from '../../lib/components/UrlCardList';

let element, pageOpener;

function checkAnchor(anchor, href, text) {
    expect(anchor.innerHTML).to.equal(text);
    expect(anchor.getAttribute('href')).to.equal(href);
}

function getText(nodeList) {
    return Array.from(nodeList).map(node => node.innerHTML);
}

function checkVaultPaths(card, vaultPaths) {
    const items = card.querySelectorAll('li.vault-path');
    expect(getText(items)).to.deep.equal(vaultPaths);
}

module.exports = {
    'UrlCardList': {
        beforeEach() {
            global.window = new JSDOM('<html><body><a id="page-opener"></a><div id="saved-urls"></body></html>').window;
            global.requestAnimationFrame = sinon.stub();
            global.document = window.document;
            element = document.querySelector('#saved-urls');
            pageOpener = document.getElementById('page-opener');
            sinon.stub(pageOpener, 'click');
        },
        afterEach() {
            delete global.window;
            delete global.document;
        },
        'addCard': {
            'appends a card with a button to the html': () => {
                const list = new UrlCardList(element);

                list.addCard('my.bank.com', ['http://my.bank.com', 'http://my.bank.com'], ['/secret1', '/secret2']);

                const cards = element.querySelectorAll('.mdc-card');
                expect(cards).to.have.length(1);
                const button = cards[0].querySelector('button span');
                expect(button.innerHTML).to.equal('my.bank.com');
                checkVaultPaths(cards[0], ['/secret1', '/secret2']);
                button.click();
                expect(pageOpener.href).to.equal('http://my.bank.com/');
                expect(pageOpener.click).to.be.calledOnce;
            },
            'appends a card with a menu button to the html': () => {
                const list = new UrlCardList(element);
                const urls = ['https://my.bank.com/page1', 'https://my.bank.com/page2'];

                list.addCard('my.bank.com', urls, ['/secret1', '/secret2']);

                const cards = element.querySelectorAll('.mdc-card');
                expect(cards).to.have.length(1);
                const button = cards[0].querySelector('button span.mdc-button__label');
                expect(button.innerHTML).to.equal('my.bank.com');
                const menuItems = cards[0].querySelectorAll('.mdc-menu .mdc-list li.mdc-list-item span.mdc-list-item__text');
                expect(getText(menuItems)).to.deep.equal(urls);
                checkVaultPaths(cards[0], ['/secret1', '/secret2']);
                menuItems[0].click();
                expect(pageOpener.href).to.equal('https://my.bank.com/page1');
                expect(pageOpener.click).to.be.calledOnce;
            },
            'defaults protocol to https': () => {
                const list = new UrlCardList(element);

                list.addCard('my.bank.com', ['my.bank.com'], ['/secret1']);

                const cards = element.querySelectorAll('.mdc-card');
                expect(cards).to.have.length(1);
                checkVaultPaths(cards[0], ['/secret1']);
                cards[0].querySelector('button').click();
                expect(pageOpener.href).to.equal('https://my.bank.com/');
                expect(pageOpener.click).to.be.calledOnce;
            }
        },
        'filterCards': {
            'hides cards that do not match': () => {
                const list = new UrlCardList(element);
                list.addCard('my.bank.com', ['my.bank.com'], ['/secret1', '/secret2']);
                list.addCard('some.other.host', ['some.other.host'], ['/secret4', '/secret5']);

                list.filterCards('other');

                expect(getText(element.querySelectorAll('.mdc-card.hidden button span'))).to.deep.equal(['my.bank.com']);
                expect(getText(element.querySelectorAll('.mdc-card:not(.hidden) button span'))).to.deep.equal(['some.<em>other</em>.host']);
            },
            'unhides cards that match': () => {
                const list = new UrlCardList(element);
                list.addCard('my.bank.com', ['my.bank.com'], ['/secret1', '/secret2']);
                list.addCard('some.other.host', ['some.other.host'], ['/secret4', '/secret5']);

                list.filterCards('other');
                list.filterCards('my');

                expect(getText(element.querySelectorAll('.mdc-card:not(.hidden) button span'))).to.deep.equal(['<em>my</em>.bank.com']);
                expect(getText(element.querySelectorAll('.mdc-card.hidden button span'))).to.deep.equal(['some.other.host']);
            },
            'highlights paths that match': () => {
                const list = new UrlCardList(element);
                list.addCard('my.bank.com', ['my.bank.com'], ['/private1', '/private2']);
                list.addCard('some.other.host', ['some.other.host'], ['/secret1', '/secret2']);

                list.filterCards('private');

                expect(getText(element.querySelectorAll('.mdc-card:not(.hidden) button span'))).to.deep.equal(['my.bank.com']);
                expect(getText(element.querySelectorAll('.mdc-card:not(.hidden) li'))).to.deep.equal(['/<em>private</em>1', '/<em>private</em>2']);
                expect(getText(element.querySelectorAll('.mdc-card.hidden button span'))).to.deep.equal(['some.other.host']);
            }
        },
        'showAll': {
            'unhides all cards and clears highlighting': () => {
                const list = new UrlCardList(element);
                list.addCard('my.bank.com', ['my.bank.com'], ['/secret1', '/secret2']);
                list.addCard('some.other.host', ['some.other.host'], ['/secret4', '/secret5']);
                list.filterCards('other');

                list.showAll();

                expect(element.querySelectorAll('.hidden')).to.have.length(0);
                expect(getText(element.querySelectorAll('.mdc-card:not(.hidden) button span'))).to.deep.equal(['my.bank.com', 'some.other.host']);
            }
        }
    }
};