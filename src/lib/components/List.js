import { MDCList } from '@material/list';
import { MDCRipple } from '@material/ripple/index';

// export function newListItem(text) {
//     const li = document.createElement('li');
//     li.className = 'mdc-list-item';
//     li.innerHTML = `<span class="mdc-list-item__text">${text}</span>`;
//     return li;
// }

export default function List(element) {
    const list = new MDCList(element);
    list.listElements.forEach(item => new MDCRipple(item));

    this.removeAll = () => element.innerHTML = '';

    this.addItem = (text) => {
        const li = document.createElement('li');
        li.className = 'mdc-list-item';
        li.innerHTML = `<span class="mdc-list-item__text">${text}</span>`;
        element.appendChild(li);
        new MDCRipple(li);
    }
}