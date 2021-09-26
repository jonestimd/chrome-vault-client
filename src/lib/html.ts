
export function removeClass(element: Element, toRemove: string): void {
    element.className = element.className.split(/ +/).filter(name => name !== toRemove).join(' ');
}

export function addClass(element: Element, toAdd: string): void {
    const classList = element.className.split(/ +/);
    element.className = classList.includes(toAdd) ? element.className : `${element.className} ${toAdd}`;
}
