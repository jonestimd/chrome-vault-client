import {MDCRipple} from '@material/ripple';
import {MDCMenu, Corner} from '@material/menu';

const menuItemHtml = (url: string) =>
 `<li class="mdc-list-item" role="menuitem"><span class="mdc-list-item__text">${url}</span></li>`;

const menuHtml = (urls: string[]) =>
`<div class="mdc-menu mdc-menu-surface">
  <ul class="mdc-list" role="menu" aria-hidden="true" aria-orientation="vertical" tabindex="-1">
    ${urls.map((url) => menuItemHtml(url)).join('')}
  </ul>
</div>`;

const menuButtonHtml = (hostname: string, urls: string[]) =>
`<div class="mdc-menu-surface--anchor">
  <button class="mdc-button">
    <span class="mdc-button__label">${hostname}</span>
    <i class="material-icons mdc-button__icon" aria-hidden="true">arrow_drop_down</i>
  </button>
  ${menuHtml(urls)}
</div>`;

const html = (urls: string[], hostname: string, vaultPaths: string[]) =>
`<div class="mcd-card__primary-action">
    ${urls.length === 1
        ? `<button class="mdc-button"><span class="mdc-button__label">${hostname}</span></button>`
        : menuButtonHtml(hostname, urls)}
    <div class="mdc-typography--body2"><ul>${vaultPaths.map(path => `<li class="vault-path">${path}</li>`).join('')}</ul></div>
</div>`;

function emphasize(element: HTMLElement, value: string, search: string) {
    element.innerHTML = value.replace(RegExp(search, 'gi'), (match) => `<em>${match}</em>`);
}

function openPage(url: string): void {
    const anchor = document.getElementById('page-opener') as HTMLAnchorElement;
    anchor.href = url;
    anchor.click();
}

class Card {
    private hostname: string
    private urls: string[]
    private card: HTMLDivElement
    private vaultPaths: string[]
    private button: HTMLButtonElement
    private menu?: MDCMenu

    constructor(parent: HTMLElement, hostname: string, urls: string[], vaultPaths: string[]) {
        this.hostname = hostname;
        this.urls = urls.map(url => url.match(/^https?:\/\//) ? url : 'https://' + url)
            .reduce((urls, url) => urls.includes(url) ? urls : urls.concat(url), []);
        this.vaultPaths = vaultPaths;
        this.card = document.createElement('div');
        this.card.className = 'mdc-card vault-url-card mdc-elevation--z4';
        this.card.innerHTML = html(this.urls, hostname, vaultPaths);
        parent.appendChild(this.card);
        this.button = this.card.querySelector('.mdc-button');
        new MDCRipple(this.button);
        if (this.urls.length === 1) {
            this.button.addEventListener('click', (event) => openPage(this.urls[0]));
        }
        else {
            this.button.addEventListener('click', () => this.menu.open = !this.menu.open);
            this.menu = new MDCMenu(this.card.querySelector('.mdc-menu'));
            this.menu.setAnchorCorner(Corner.BOTTOM_LEFT);
            this.menu.listen('click', (event) => openPage(this.getUrl(event.target as HTMLElement)))
        }
    }

    private getUrl(target: HTMLElement): string {
        return target.tagName === 'SPAN' ? target.innerHTML : target.querySelector('span').innerHTML;
    }

    private addEmphasis (search: string) {
        emphasize(this.card.querySelector('button span'), this.hostname, search);
        this.card.querySelectorAll('li.vault-path').forEach((li: HTMLElement, i) => emphasize(li, this.vaultPaths[i], search));
    }

    private removeEmphasis() {
        this.card.querySelector('button span').innerHTML = this.hostname;
        this.card.querySelectorAll('li.vault-path').forEach((li, i) => li.innerHTML = this.vaultPaths[i]);
    }

    remove() {
        this.menu && this.menu.destroy();
        this.card.parentElement.removeChild(this.card);
    }

    private containsMatch(search: string) {
        return this.vaultPaths.concat(this.hostname).some(value => value.toLowerCase().includes(search));
    }

    private removeClass(toRemove: string) {
        this.card.className = this.card.className.split(/ +/).filter(name => name !== toRemove).join(' ');
    }

    private addClass(toAdd: string) {
        const classList = this.card.className.split(/ +/);
        this.card.className = classList.includes(toAdd) ? this.card.className : `${this.card.className} ${toAdd}`;
    }

    applyFilter(search: string) {
        if (this.containsMatch(search)) this.removeClass('hidden');
        else this.addClass('hidden');
        this.addEmphasis(search);
    }

    show() {
        this.removeClass('hidden');
        this.removeEmphasis();
    }
}

export default class UrlCardList {
    private cards: Card[] = [];
    private element: HTMLElement;

    constructor(element: HTMLElement) {
        this.element = element;
    }

    removeAll() {
        this.cards.splice(0, this.cards.length).forEach(card => card.remove());
    }

    addCard(hostname: string, urls: string[], vaultPaths: string[]) {
        this.cards.push(new Card(this.element, hostname, urls, vaultPaths));
    }

    filterCards(text: string) {
        const search = text.toLowerCase();
        this.cards.forEach(card => card.applyFilter(search));
    }

    showAll() {
        this.cards.forEach(card => card.show());
    }
}