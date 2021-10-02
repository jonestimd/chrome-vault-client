
export function removeClass(element: Element, toRemove: string): void {
    element.className = element.className.split(/ +/).filter(name => name !== toRemove).join(' ');
}

export function addClass(element: Element, toAdd: string): void {
    const classList = element.className.split(/ +/);
    element.className = classList.includes(toAdd) ? element.className : `${element.className} ${toAdd}`;
}

interface ISpanProps {
    text?: string;
    children?: HTMLElement[];
    className?: string;
}

export function createSpan({text, children, className}: ISpanProps): HTMLSpanElement {
    const span = document.createElement('span');
    if (text) span.append(text);
    if (children) span.replaceChildren(...children);
    if (className) span.className = className;
    return span;
}

export function createLink(url: string): HTMLAnchorElement {
    const link = document.createElement('a');
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.href = url;
    link.replaceChildren(url);
    return link;
}

export function createList(items: string[]): HTMLUListElement {
    const ul = document.createElement('ul');
    for (const item of items) {
        const li = document.createElement('li');
        li.replaceChildren(item);
        ul.appendChild(li);
    }
    return ul;
}