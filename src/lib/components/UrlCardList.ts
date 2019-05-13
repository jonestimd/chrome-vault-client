const html = (href: string, url: string, vaultPaths: string[]) =>
`<div class="mcd-card__primary-action">
    <div class="mdc-typography--headline6"><a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a></div>
    <div class="mdc-typography--body2"><ul>
        ${vaultPaths.map(path => `<li>${path}</li>`).join('')}
    </ul></div>
</div>`;

function emphasize(element: HTMLElement, value: string, search: string) {
    element.innerHTML = value.replace(RegExp(search, 'gi'), (match) => `<em>${match}</em>`);
}

class Card {
    private url: string
    private href: string
    private card: HTMLDivElement
    private vaultPaths: string[]

    constructor(parent: HTMLElement, url: string, vaultPaths: string[]) {
        this.url = url;
        this.href = url.match(/^https?:\/\//) ? url : 'https://' + url;
        this.vaultPaths = vaultPaths;
        this.card = document.createElement('div');
        this.card.className = 'mdc-card vault-url-card mdc-elevation--z4';
        this.card.innerHTML = html(this.href, url, vaultPaths);
        parent.appendChild(this.card);
    }

    private addEmphasis (search: string) {
        emphasize(this.card.querySelector('a'), this.url, search);
        this.card.querySelectorAll('li').forEach((li, i) => emphasize(li, this.vaultPaths[i], search));
    }

    private removeEmphasis() {
        this.card.querySelector('a').innerHTML = this.url;
        this.card.querySelectorAll('li').forEach((li, i) => li.innerHTML = this.vaultPaths[i]);
    }
    
    remove() {
        this.card.parentElement.removeChild(this.card);
    }

    private containsMatch(search: string) {
        return this.vaultPaths.concat(this.url).some(value => value.toLowerCase().includes(search));
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

    addCard(url: string, vaultPaths: string[]) {
        this.cards.push(new Card(this.element, url, vaultPaths));
    }

    filterCards(text: string) {
        const search = text.toLowerCase();
        this.cards.forEach(card => card.applyFilter(search));
    }

    showAll() {
        this.cards.forEach(card => card.show());
    }
}