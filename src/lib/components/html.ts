
export function html<T extends HTMLElement>(strings: TemplateStringsArray, ...values: (string | number)[]) {
    const content = strings.flatMap((s, i) => [s, values[i]]).join('').trim();
    const element = new DOMParser().parseFromString(content, 'text/html').body.firstChild as T;
    return document.importNode(element, true);
}
