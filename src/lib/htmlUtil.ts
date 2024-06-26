export function getLabel(input: HTMLInputElement): HTMLLabelElement | undefined {
    if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label instanceof HTMLLabelElement && label.offsetParent) return label;
    }
    return getContainingLabel(input);
}

export function getContainingLabel(input: HTMLInputElement): HTMLLabelElement | undefined {
    let parent = input.parentElement;
    while (parent && parent.tagName !== 'LABEL') parent = parent.parentElement;
    return parent as HTMLLabelElement;
}

export function getText(element: Element): string {
    const ignoredTags = ['SCRIPT', 'STYLE', 'BUTTON', 'SELECT', 'I'];
    const texts: string[] = [];
    element.childNodes.forEach((child) => {
        if (child.nodeName === '#text') texts.push(child.textContent?.trim() ?? '');
        else if (child.nodeType === Node.ELEMENT_NODE && !ignoredTags.includes(child.nodeName)) {
            if ((child as Element).getClientRects().length > 0) texts.push(getText(child as Element));
        }
    });
    return texts.filter((text) => text.length > 0).join(' ');
}
