import {JSDOM} from 'jsdom';
import UrlList from './UrlList';

let element: HTMLElement;
let pageOpener: HTMLAnchorElement;

function getText(nodeList: NodeListOf<Element>) {
    return Array.from(nodeList).map((node) => node.innerHTML);
}

function checkVaultPaths(card: Element, vaultPaths: string[]) {
    const items = card.querySelectorAll('li');
    expect(getText(items)).toEqual(vaultPaths);
}

describe('UrlList', () => {
    beforeEach(() => {
        global.window = new JSDOM('<html><body><a id="page-opener"></a><div id="saved-urls"></body></html>').window as any;
        global.requestAnimationFrame = jest.fn();
        global.document = window.document;
        global.DOMParser = window.DOMParser;
        element = document.querySelector('#saved-urls')!;
        pageOpener = document.getElementById('page-opener') as HTMLAnchorElement;
        jest.spyOn(pageOpener, 'click').mockImplementation(() => { });
    });
    afterEach(() => {
        global.window = {} as any;
        global.document = {} as any;
    });
    describe('useCurrentTab', () => {
        it('opens link url in current tab', () => {
            const addListener = jest.spyOn(window.HTMLAnchorElement.prototype, 'addEventListener');
            const list = new UrlList(element);

            list.useCurrentTab();
            list.addItem('https://my.bank.com', ['/secret1']);

            expect(addListener).toHaveBeenCalledWith('click', expect.any(Function));
            const listener = addListener.mock.calls[0]?.[1] as EventListener;
            const event = {preventDefault: jest.fn()};
            listener(event as any);
            expect(chrome.tabs.update).toHaveBeenCalledWith({url: 'https://my.bank.com'});
            expect(event.preventDefault).toHaveBeenCalled();
        });
    });
    describe('addItem', () => {
        it('appends a list item with list of vault paths', () => {
            const list = new UrlList(element);

            list.addItem('https://my.bank.com', ['/secret1', '/secret2']);

            const items = element.querySelectorAll('.mdc-list-item');
            expect(items).toHaveLength(1);
            expect(items[0]!.querySelector('a')?.innerHTML).toEqual('https://my.bank.com');
            expect(items[0]!.querySelector('a')?.getAttribute('href')).toEqual('https://my.bank.com');
            checkVaultPaths(items[0]!, ['/secret1', '/secret2']);
        });
        it('defaults protocol to https', () => {
            const list = new UrlList(element);

            list.addItem('my.bank.com', ['/secret1']);

            const items = element.querySelectorAll('.mdc-list-item');
            expect(items).toHaveLength(1);
            expect(items[0]!.querySelector('a')?.innerHTML).toEqual('https://my.bank.com');
            expect(items[0]!.querySelector('a')?.getAttribute('href')).toEqual('https://my.bank.com');
            checkVaultPaths(items[0]!, ['/secret1']);
        });
    });
    describe('filteritems', () => {
        it('hides items that do not match', () => {
            const list = new UrlList(element);
            list.addItem('my.bank.com', ['/secret1', '/secret2']);
            list.addItem('some.other.host', ['/secret4', '/secret5']);

            list.filterItems('other');

            expect(getText(element.querySelectorAll('.mdc-list-item.hidden a'))).toEqual(['https://my.bank.com']);
            expect(getText(element.querySelectorAll('.mdc-list-item:not(.hidden) a'))).toEqual(['https://some.<em>other</em>.host']);
        });
        it('unhides items that match', () => {
            const list = new UrlList(element);
            list.addItem('my.bank.com', ['/secret1', '/secret2']);
            list.addItem('some.other.host', ['/secret4', '/secret5']);

            list.filterItems('other');
            list.filterItems('my');

            expect(getText(element.querySelectorAll('.mdc-list-item:not(.hidden) a'))).toEqual(['https://<em>my</em>.bank.com']);
            expect(getText(element.querySelectorAll('.mdc-list-item.hidden a'))).toEqual(['https://some.other.host']);
        });
        it('highlights paths that match', () => {
            const list = new UrlList(element);
            list.addItem('my.bank.com', ['/private1', '/private2/private3']);
            list.addItem('some.other.host', ['/secret1', '/secret2']);

            list.filterItems('private');

            expect(getText(element.querySelectorAll('.mdc-list-item:not(.hidden) a'))).toEqual(['https://my.bank.com']);
            expect(getText(element.querySelectorAll('.mdc-list-item:not(.hidden) li')))
                .toEqual(['/<em>private</em>1', '/<em>private</em>2/<em>private</em>3']);
            expect(getText(element.querySelectorAll('.mdc-list-item.hidden a'))).toEqual(['https://some.other.host']);
        });
    });
    describe('showAll', () => {
        it('unhides all items and clears highlighting', () => {
            const list = new UrlList(element);
            list.addItem('my.bank.com', ['/secret1', '/secret2']);
            list.addItem('some.other.host', ['/secret4', '/secret5']);
            list.filterItems('other');

            list.showAll();

            expect(element.querySelectorAll('.hidden')).toHaveLength(0);
            expect(getText(element.querySelectorAll('.mdc-list-item:not(.hidden) a')))
                .toEqual(['https://my.bank.com', 'https://some.other.host']);
        });
    });
});