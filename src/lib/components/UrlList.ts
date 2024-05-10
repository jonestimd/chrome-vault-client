import {MDCRipple} from '@material/ripple';
import {MDCList} from '@material/list';
import {SecretInfo} from '../vaultApi';
import {html} from './html';

const createItem = (url: string, vaultPaths: string[]) => html`
<li class="mdc-list-item">
    <span class="mdc-list-item__ripple"></span>
    <span class="mdc-list-item__text">
        <span class="mdc-list-item__primary-text"><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></span>
        <span class="mdc-list-item__secondary-text">
            <ul>${vaultPaths.map((p) => `<li>${p}</li>`).join('')}</ul>
        </span>
    </span>
</li>`;

function emphasize(element: Element | null, value: string | undefined, search: string) {
    if (element && value) {
        const lowerValue = value.toLowerCase();
        const children: (HTMLElement | string)[] = [];
        for (let i = 0; i < value.length;) {
            const index = lowerValue.indexOf(search, i);
            if (index >= 0) {
                if (index > i) children.push(value.slice(i, index));
                i = index + search.length;
                const em = document.createElement('em');
                em.replaceChildren(value.slice(index, i));
                children.push(em);
            }
            else {
                children.push(value.slice(i));
                i = value.length;
            }
        }
        element.replaceChildren(...children);
    }
}

class UrlListItem {
    private url: string;
    private secrets: SecretInfo[];
    private listItem: HTMLElement;

    constructor(parent: HTMLElement, url: string, secrets: SecretInfo[]) {
        this.url = url.match(/^https?:\/\//) ? url : 'https://' + url;
        this.secrets = secrets;
        this.listItem = createItem(this.url, secrets.map((s) => s.path));
        parent.appendChild(this.listItem);
        new MDCRipple(this.listItem);
    }

    private addEmphasis(search: string) {
        emphasize(this.listItem.querySelector('span a'), this.url, search);
        this.listItem.querySelectorAll('li').forEach((li, i) => emphasize(li, this.secrets[i]?.path, search));
    }

    private removeEmphasis() {
        this.listItem.querySelector('span a')!.replaceChildren(this.url);
        this.listItem.querySelectorAll('li').forEach((li, i) => li.replaceChildren(this.secrets[i]!.path));
    }

    remove() {
        this.listItem.parentElement?.removeChild(this.listItem);
    }

    private containsMatch(search: string) {
        return this.url.toLowerCase().includes(search) || this.secrets.some((s) => s.path.toLowerCase().includes(search));
    }

    private removeClass(toRemove: string) {
        if (this.listItem.classList.contains(toRemove)) {
            this.listItem.classList.remove(toRemove);
            return true;
        }
        return false;
    }

    private addClass(toAdd: string) {
        if (this.listItem.classList.contains(toAdd)) return false;
        this.listItem.classList.add(toAdd);
        return true;
    }

    applyFilter(search: string) {
        if (this.containsMatch(search)) {
            this.removeClass('hidden');
            this.addEmphasis(search);
        }
        else if (this.addClass('hidden')) this.removeEmphasis();
    }

    show() {
        if (!this.removeClass('hidden')) this.removeEmphasis();
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

    addItem(domain: string, secrets: SecretInfo[]): void {
        this.items.push(new UrlListItem(this.element, domain, secrets));
    }

    filterItems(text: string): void {
        const search = text.toLowerCase();
        this.items.forEach((item) => item.applyFilter(search));
    }

    showAll(): void {
        this.items.forEach((item) => item.show());
    }
}
