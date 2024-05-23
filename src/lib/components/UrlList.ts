import List, {ListItem} from './List';
import type {SecretInfo} from '../vaultApi';
import {getHostname} from '../urls';

const itemPrimaryText = (url: string) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
const itemSecondaryText = (vaultPaths: string[]) => `<ul>${vaultPaths.map((p) => `<li>${p}</li>`).join('')}</ul>`;

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

class UrlListItem extends ListItem {
    static newItem(urlOrHost: string, secretPaths: string[], useCurrentTab: boolean) {
        const url = urlOrHost.match(/^https?:\/\//) ? urlOrHost : 'https://' + urlOrHost;
        return new UrlListItem(url, secretPaths, useCurrentTab);
    }

    private constructor(private readonly url: string, private readonly secretPaths: string[], useCurrentTab: boolean) {
        super(itemPrimaryText(url), itemSecondaryText(secretPaths));
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

type Comparator<T> = (v1: T, v2: T) => number;
const compareKeys: Comparator<[string, unknown]> = ([key1], [key2]) => key1.localeCompare(key2);

export default class UrlList extends List<UrlListItem> {
    private _useCurrentTab = false;

    constructor(readonly element: HTMLElement) {
        super(element);
        this.element = element;
    }

    useCurrentTab() {
        this._useCurrentTab = true;
        this.items.forEach((i) => i.useCurrentTab());
    }

    addItem(url: string, secretPaths: string[]): void {
        super.addListItem(UrlListItem.newItem(url, secretPaths, this._useCurrentTab));
    }

    setItems(secretPaths: SecretInfo[] = []) {
        this.removeAll();
        const byHost = secretPaths.reduce<Record<string, SecretInfo[]>>((byHost, secret) => {
            const hostname = getHostname(secret.url);
            const urlSecrets = byHost[hostname] ?? [];
            return {...byHost, [hostname]: [...urlSecrets, secret]};
        }, {});
        Object.entries(byHost).sort(compareKeys).forEach(([url, secrets]) => this.addItem(url, secrets.map((s) => s.path)));
    }

    filterItems(text: string): void {
        const search = text.toLowerCase();
        this.items.forEach((item) => item.applyFilter(search));
    }

    showAll(): void {
        this.items.forEach((item) => item.show());
    }
}
