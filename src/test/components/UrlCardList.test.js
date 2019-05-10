import chai, {expect} from 'chai';
chai.use(require('sinon-chai'));
import sinon from 'sinon';
import {JSDOM} from 'jsdom';
import UrlCardList from '../../lib/components/UrlCardList';

let element;

function checkAnchor(anchor, href, text) {
    expect(anchor.innerHTML).to.equal(text);
    expect(anchor.getAttribute('href')).to.equal(href);
}

function getText(nodeList) {
    return Array.from(nodeList).map(node => node.innerHTML);
}

function checkVaultPaths(card, vaultPaths) {
    const items = card.querySelectorAll('li');
    expect(getText(items)).to.deep.equal(vaultPaths);
}

module.exports = {
    'UrlCardList': {
        beforeEach() {
            global.window = new JSDOM('<html><body><div id="saved-urls"></body></html>').window;
            global.document = window.document;
            element = document.querySelector('#saved-urls');
        },
        afterEach() {
            delete global.window;
            delete global.document;
        },
        'addCard': {
            'appends a card to the html': () => {
                const list = new UrlCardList(element);

                list.addCard('http://my.vault.host', ['/secret1']);

                const cards = element.querySelectorAll('.mdc-card');
                expect(cards).to.have.length(1);
                checkAnchor(cards[0].querySelector('a'), 'http://my.vault.host', 'http://my.vault.host');
                checkVaultPaths(cards[0], ['/secret1']);
            },
            'defaults protocol to https': () => {
                const list = new UrlCardList(element);

                list.addCard('my.vault.host', ['/secret1', '/secret2']);

                const cards = element.querySelectorAll('.mdc-card');
                expect(cards).to.have.length(1);
                checkAnchor(cards[0].querySelector('a'), 'https://my.vault.host', 'my.vault.host');
                checkVaultPaths(cards[0], ['/secret1', '/secret2']);
            }
        },
        'filterCards': {
            'hides cards that do not match': () => {
                const list = new UrlCardList(element);
                list.addCard('my.vault.host', ['/secret1', '/secret2']);
                list.addCard('some.other.host', ['/secret4', '/secret5']);

                list.filterCards('other');

                expect(getText(element.querySelectorAll('.mdc-card.hidden a'))).to.deep.equal(['my.vault.host']);
                expect(getText(element.querySelectorAll('.mdc-card:not(.hidden) a'))).to.deep.equal(['some.<em>other</em>.host']);
            },
            'unhides cards that match': () => {
                const list = new UrlCardList(element);
                list.addCard('my.vault.host', ['/secret1', '/secret2']);
                list.addCard('some.other.host', ['/secret4', '/secret5']);

                list.filterCards('other');
                list.filterCards('my');

                expect(getText(element.querySelectorAll('.mdc-card:not(.hidden) a'))).to.deep.equal(['<em>my</em>.vault.host']);
                expect(getText(element.querySelectorAll('.mdc-card.hidden a'))).to.deep.equal(['some.other.host']);
            },
            'highlights paths that match': () => {
                const list = new UrlCardList(element);
                list.addCard('my.vault.host', ['/private1', '/private2']);
                list.addCard('some.other.host', ['/secret1', '/secret2']);

                list.filterCards('private');

                expect(getText(element.querySelectorAll('.mdc-card:not(.hidden) a'))).to.deep.equal(['my.vault.host']);
                expect(getText(element.querySelectorAll('.mdc-card:not(.hidden) li'))).to.deep.equal(['/<em>private</em>1', '/<em>private</em>2']);
                expect(getText(element.querySelectorAll('.mdc-card.hidden a'))).to.deep.equal(['some.other.host']);
            }
        },
        'showAll': {
            'unhides all cards and clears highlighting': () => {
                const list = new UrlCardList(element);
                list.addCard('my.vault.host', ['/secret1', '/secret2']);
                list.addCard('some.other.host', ['/secret4', '/secret5']);
                list.filterCards('other');

                list.showAll();

                expect(element.querySelectorAll('.hidden')).to.have.length(0);
                expect(getText(element.querySelectorAll('.mdc-card:not(.hidden) a'))).to.deep.equal(['my.vault.host', 'some.other.host']);
            }
        }
    }
};