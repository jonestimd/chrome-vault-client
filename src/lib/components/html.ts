
export function html(strings: TemplateStringsArray, ...values: (string | number)[]) {
    const root = document.createElement('template');
    root.innerHTML = strings.flatMap((s, i) => [s, values[i]]).join('').trim();
    return root.content.firstElementChild as HTMLElement;
}
