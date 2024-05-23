import {MDCRipple} from '@material/ripple';
import {MDCList} from '@material/list';
import {html} from './html';

const createItem = (primary: string, secondary: string, meta?: string) => html`
<li class="mdc-list-item">
    <span class="mdc-list-item__ripple"></span>
    <span class="mdc-list-item__text">
        <span class="mdc-list-item__primary-text">${primary}</span>
        <span class="mdc-list-item__secondary-text">${secondary}</span>
    </span>
    ${meta ? `<span class="mdc-deprecated-list-item__meta">${meta}</span>` : ''}
</li>`;

export class ListItem {
    readonly listItem: HTMLElement;

    constructor(primary: string, secondary: string, meta?: string) {
        this.listItem = createItem(primary, secondary, meta);
        new MDCRipple(this.listItem);
    }

    remove() {
        this.listItem.parentElement?.removeChild(this.listItem);
    }
}

export default class List<T extends ListItem> {
    protected readonly list: MDCList;
    readonly items: T[] = [];

    constructor(readonly element: HTMLElement) {
        this.element = element;
        this.list = new MDCList(element);
    }

    addListItem(item: T) {
        this.items.push(item);
        this.element.appendChild(item.listItem);
    }

    removeAll(): void {
        this.items.splice(0, this.items.length).forEach((item) => item.remove());
    }
}
