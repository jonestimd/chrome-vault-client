import { MDCList } from '@material/list';
import { MDCRipple } from '@material/ripple/index';

export default function List(element) {
    const list = new MDCList(element);
    list.listElements.forEach(item => new MDCRipple(item));

    this.removeAll = () => element.innerHTML = '';

    this.addItem = (text, iconName) => {
        const li = document.createElement('li');
        li.className = 'mdc-list-item';
        li.innerHTML = `<span class="mdc-list-item__text">${text}</span>`;
        if (iconName) {
            const span = document.createElement('span');
            span.className = 'mdc-list-item__meta material-icons';
            span.innerHTML = iconName;
            span.setAttribute('aria-hidden', true);
            li.appendChild(span);
        }
        element.appendChild(li);
        new MDCRipple(li);
    }
}