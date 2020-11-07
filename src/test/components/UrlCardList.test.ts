import {JSDOM} from 'jsdom';
import UrlCardList from '../../lib/components/UrlCardList';

let element: HTMLElement;
let pageOpener: HTMLAnchorElement;

function getText(nodeList: NodeListOf<Element>) {
    return Array.from(nodeList).map(node => node.innerHTML);
}

function checkVaultPaths(card: Element, vaultPaths: string[]) {
    const items = card.querySelectorAll('li.vault-path');
    expect(getText(items)).toEqual(vaultPaths);
}

describe('UrlCardList', () => {
    beforeEach(() => {
        global.window = new JSDOM('<html><body><a id="page-opener"></a><div id="saved-urls"></body></html>').window as any;
        global.requestAnimationFrame = jest.fn();
        global.document = window.document;
        element = document.querySelector('#saved-urls');
        pageOpener = document.getElementById('page-opener') as HTMLAnchorElement;
        jest.spyOn(pageOpener, 'click').mockImplementation(() => {});
    });
    afterEach(() => {
        delete global.window;
        delete global.document;
    });
    describe('addCard', () => {
        it('appends a card with a button to the html', () => {
            const list = new UrlCardList(element);

            list.addCard('my.bank.com', ['http://my.bank.com', 'http://my.bank.com'], ['/secret1', '/secret2']);

            const cards = element.querySelectorAll('.mdc-card');
            expect(cards).toHaveLength(1);
            const button = cards[0].querySelector<HTMLButtonElement>('button span');
            expect(button.innerHTML).toEqual('my.bank.com');
            checkVaultPaths(cards[0], ['/secret1', '/secret2']);
            button.click();
            expect(pageOpener.href).toEqual('http://my.bank.com/');
            expect(pageOpener.click).toBeCalledTimes(1);
        });
        it('appends a card with a menu button to the html', () => {
            const list = new UrlCardList(element);
            const urls = ['https://my.bank.com/page1', 'https://my.bank.com/page2'];

            list.addCard('my.bank.com', urls, ['/secret1', '/secret2']);

            const cards = element.querySelectorAll('.mdc-card');
            expect(cards).toHaveLength(1);
            const button = cards[0].querySelector('button span.mdc-button__label');
            expect(button.innerHTML).toEqual('my.bank.com');
            const menuItems = cards[0].querySelectorAll<HTMLButtonElement>('.mdc-menu .mdc-list li.mdc-list-item span.mdc-list-item__text');
            expect(getText(menuItems)).toEqual(urls);
            checkVaultPaths(cards[0], ['/secret1', '/secret2']);
            menuItems[0].click();
            expect(pageOpener.href).toEqual('https://my.bank.com/page1');
            expect(pageOpener.click).toBeCalledTimes(1);
        });
        it('defaults protocol to https', () => {
            const list = new UrlCardList(element);

            list.addCard('my.bank.com', ['my.bank.com'], ['/secret1']);

            const cards = element.querySelectorAll('.mdc-card');
            expect(cards).toHaveLength(1);
            checkVaultPaths(cards[0], ['/secret1']);
            cards[0].querySelector('button').click();
            expect(pageOpener.href).toEqual('https://my.bank.com/');
            expect(pageOpener.click).toBeCalledTimes(1);
        });
    });
    describe('filterCards', () => {
        it('hides cards that do not match', () => {
            const list = new UrlCardList(element);
            list.addCard('my.bank.com', ['my.bank.com'], ['/secret1', '/secret2']);
            list.addCard('some.other.host', ['some.other.host'], ['/secret4', '/secret5']);

            list.filterCards('other');

            expect(getText(element.querySelectorAll('.mdc-card.hidden button span'))).toEqual(['my.bank.com']);
            expect(getText(element.querySelectorAll('.mdc-card:not(.hidden) button span'))).toEqual(['some.<em>other</em>.host']);
        });
        it('unhides cards that match', () => {
            const list = new UrlCardList(element);
            list.addCard('my.bank.com', ['my.bank.com'], ['/secret1', '/secret2']);
            list.addCard('some.other.host', ['some.other.host'], ['/secret4', '/secret5']);

            list.filterCards('other');
            list.filterCards('my');

            expect(getText(element.querySelectorAll('.mdc-card:not(.hidden) button span'))).toEqual(['<em>my</em>.bank.com']);
            expect(getText(element.querySelectorAll('.mdc-card.hidden button span'))).toEqual(['some.other.host']);
        });
        it('highlights paths that match', () => {
            const list = new UrlCardList(element);
            list.addCard('my.bank.com', ['my.bank.com'], ['/private1', '/private2']);
            list.addCard('some.other.host', ['some.other.host'], ['/secret1', '/secret2']);

            list.filterCards('private');

            expect(getText(element.querySelectorAll('.mdc-card:not(.hidden) button span'))).toEqual(['my.bank.com']);
            expect(getText(element.querySelectorAll('.mdc-card:not(.hidden) li'))).toEqual(['/<em>private</em>1', '/<em>private</em>2']);
            expect(getText(element.querySelectorAll('.mdc-card.hidden button span'))).toEqual(['some.other.host']);
        });
    });
    describe('showAll', () => {
        it('unhides all cards and clears highlighting', () => {
            const list = new UrlCardList(element);
            list.addCard('my.bank.com', ['my.bank.com'], ['/secret1', '/secret2']);
            list.addCard('some.other.host', ['some.other.host'], ['/secret4', '/secret5']);
            list.filterCards('other');

            list.showAll();

            expect(element.querySelectorAll('.hidden')).toHaveLength(0);
            expect(getText(element.querySelectorAll('.mdc-card:not(.hidden) button span'))).toEqual(['my.bank.com', 'some.other.host']);
        });
    });
});