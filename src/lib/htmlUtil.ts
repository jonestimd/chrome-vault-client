export function getLabel(input: HTMLInputElement): HTMLLabelElement {
    const label = input.id && document.querySelector(`label[for="${input.id}"]`);
    if (label) return label as HTMLLabelElement;
    else {
        let parent = input.parentElement;
        while (parent && parent.tagName !== 'LABEL') parent = parent.parentElement;
        return parent as HTMLLabelElement;
    }
}

export function getText(element: Element): string {
    const ignoredTags = ['SCRIPT', 'STYLE', 'INPUT', 'BUTTON', 'SELECT'];
    let text: string[] = [];
    element.childNodes.forEach(child => {
        if (child.nodeName === '#text') text.push(child.textContent.trim());
        else if (child.nodeType === Node.ELEMENT_NODE && !ignoredTags.includes(child.nodeName)) {
            if ((child as Element).getClientRects().length > 0) text.push(getText(child as Element));
        }
    });
    return text.join(' ');
}
