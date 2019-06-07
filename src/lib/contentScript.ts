import {PageInfoMessage, InputInfo, LoginInput} from './message';
import {getText, getContainingLabel} from './htmlUtil';

function setInput(input: HTMLInputElement, value: string): void {
    input.setAttribute('value', value);
    input.dispatchEvent(new Event("change", {bubbles: true}));
    if (input.value !== value) {
        input.value = value;
        input.dispatchEvent(new Event("input", {bubbles: true}));
    }
}

function isInput(element: Element): boolean {
    return element.tagName === 'INPUT';
}

function isVisible(element: Element): boolean {
    return element.getClientRects().length > 0;
}

function hasText(element: HTMLElement, value: string): boolean {
    return getText(element) === value;
}

type InputLabel = [HTMLInputElement, HTMLLabelElement];

function findByLabel(text: string): HTMLInputElement | undefined {
    const [input] = Array.from(document.querySelectorAll('label input')).filter(isVisible)
        .map<InputLabel>((input: HTMLInputElement) => [input, getContainingLabel(input)])
        .filter(([, label]) => isVisible(label))
        .find(([, label]) => hasText(label, text));
    return input;
}

function findVisibleInput(selector: string): HTMLInputElement | undefined {
    const elements = document.querySelectorAll(selector);
    return Array.from(elements).filter(isInput).find(isVisible) as HTMLInputElement;
}

chrome.runtime.onMessage.addListener(function (inputs: LoginInput[]) {
    if (inputs) {
        for (const {label, selector, value} of inputs) {
            const input = selector && findVisibleInput(selector) || label && findByLabel(label);
            if (input) setInput(input, value);
        }
    }
});

const inputs: InputInfo[] = Array.from(document.querySelectorAll('input'))
    .filter(InputInfo.isValid)
    .map(input => new InputInfo(input))
    .filter(input => !input.isEmpty);
const result: PageInfoMessage = {url: window.location.href, inputs};

if (result.inputs.length > 0) chrome.runtime.sendMessage(result);