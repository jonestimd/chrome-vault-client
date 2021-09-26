import {MDCRipple} from '@material/ripple';
import {MDCList} from '@material/list';
import {SecretInfo} from '../vaultApi';

const itemHtml = (url: string, vaultPaths: string[]) =>
`<span class="mdc-list-item__ripple"></span>
<span class="mdc-list-item__text">
    <span class="mdc-list-item__primary-text"><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></span>
    <span class="mdc-list-item__secondary-text">
        <ul>${vaultPaths.map((path) => `<li class="vault-path">${path}</li>`).join('')}</ul>
    </span>
</span>`;

function emphasize(element: Element | null, value: string, search: string) {
    if (element) element.innerHTML = value.replace(RegExp(search, 'gi'), (match) => `<em>${match}</em>`);
}

class UrlListItem {
    private url: string
    private secrets: SecretInfo[]
    private listItem: HTMLLIElement;

    constructor(parent: HTMLElement, url: string, secrets: SecretInfo[]) {
        this.url = url.match(/^https?:\/\//) ? url : 'https://' + url;
        this.secrets = secrets;
        this.listItem = document.createElement('li');
        this.listItem.className = 'mdc-list-item';
        this.listItem.innerHTML = itemHtml(this.url, secrets.map((s) => s.path));
        parent.appendChild(this.listItem);
        new MDCRipple(this.listItem);
    }

    private addEmphasis(search: string) {
        emphasize(this.listItem.querySelector('span a'), this.url, search);
        this.listItem.querySelectorAll('li.vault-path').forEach((li, i) => emphasize(li, this.secrets[i].path, search));
    }

    private removeEmphasis() {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.listItem.querySelector('span a')!.innerHTML = this.url;
        this.listItem.querySelectorAll('li.vault-path').forEach((li, i) => li.innerHTML = this.secrets[i].path);
    }

    remove() {
        this.listItem.parentElement?.removeChild(this.listItem);
    }

    private containsMatch(search: string) {
        return this.url.toLowerCase().includes(search) || this.secrets.some((s) => s.path.toLowerCase().includes(search));
    }

    private removeClass(toRemove: string) {
        this.listItem.className = this.listItem.className.split(/ +/).filter(name => name !== toRemove).join(' ');
    }

    private addClass(toAdd: string) {
        const classList = this.listItem.className.split(/ +/);
        this.listItem.className = classList.includes(toAdd) ? this.listItem.className : `${this.listItem.className} ${toAdd}`;
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

export default class UrlList {
    private list: MDCList;
    private items: UrlListItem[] = [];
    private element: HTMLElement;

    constructor(element: HTMLElement) {
        this.element = element;
        this.list = new MDCList(element);
    }

    removeAll(): void {
        this.items.splice(0, this.items.length).forEach((item) => item.remove());
    }

    addItem(hostname: string, secrets: SecretInfo[]): void {
        this.items.push(new UrlListItem(this.element, hostname, secrets));
    }

    filterItems(text: string): void {
        const search = text.toLowerCase();
        this.items.forEach((item) => item.applyFilter(search));
    }

    showAll(): void {
        this.items.forEach((item) => item.show());
    }
}
