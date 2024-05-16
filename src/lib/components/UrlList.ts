import {MDCRipple} from '@material/ripple';
import {MDCList} from '@material/list';
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
    private listItem: HTMLElement;

    constructor(parent: HTMLElement, private readonly url: string, private readonly secretPaths: string[], useCurrentTab: boolean) {
        this.url = url.match(/^https?:\/\//) ? url : 'https://' + url;
        this.secretPaths = secretPaths;
        this.listItem = createItem(this.url, secretPaths.map((s) => s));
        parent.appendChild(this.listItem);
        new MDCRipple(this.listItem);
        if (useCurrentTab) this.useCurrentTab();
    }

    useCurrentTab() {
        this.listItem.querySelector('a')!.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.tabs.update({url: this.url});
        });
    }

    private addEmphasis(search: string) {
        emphasize(this.listItem.querySelector('span a'), this.url, search);
        this.listItem.querySelectorAll('li').forEach((li, i) => emphasize(li, this.secretPaths[i], search));
    }

    private removeEmphasis() {
        this.listItem.querySelector('span a')!.replaceChildren(this.url);
        this.listItem.querySelectorAll('li').forEach((li, i) => li.replaceChildren(this.secretPaths[i]!));
    }

    remove() {
        this.listItem.parentElement?.removeChild(this.listItem);
    }

    private containsMatch(search: string) {
        return this.url.toLowerCase().includes(search) || this.secretPaths.some((s) => s.toLowerCase().includes(search));
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
    private _useCurrentTab = false;
    private readonly list: MDCList;
    private items: UrlListItem[] = [];

    constructor(private readonly element: HTMLElement) {
        this.element = element;
        this.list = new MDCList(element);
    }

    useCurrentTab() {
        this._useCurrentTab = true;
        this.items.forEach((i) => i.useCurrentTab());
    }

    removeAll(): void {
        this.items.splice(0, this.items.length).forEach((item) => item.remove());
    }

    addItem(url: string, secretPaths: string[]): void {
        this.items.push(new UrlListItem(this.element, url, secretPaths, this._useCurrentTab));
    }

    filterItems(text: string): void {
        const search = text.toLowerCase();
        this.items.forEach((item) => item.applyFilter(search));
    }

    showAll(): void {
        this.items.forEach((item) => item.show());
    }
}
