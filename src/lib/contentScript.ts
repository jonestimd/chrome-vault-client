import {getLabel, getText} from './htmlUtil';
import {PageInfoMessage, LoginInput, InputType, inputTypes, InputInfoProps} from './message';

let frameId: string | undefined;
let pageInfo: PageInfoMessage | undefined;

const displayProps: Array<keyof InputInfoProps> = ['id', 'name', 'label', 'placeholder'];
const inputsById = new Map<number, HTMLInputElement>();

const getInput = (refId: number) => inputsById.get(refId);

class InputInfo implements InputInfoProps {
    readonly id?: string;
    readonly name?: string;
    readonly label?: string;
    readonly placeholder?: string;
    readonly type: string;

    constructor(readonly frameId: string, readonly refId: number, input: HTMLInputElement) {
        inputsById.set(refId, input);
        const label = getLabel(input);
        this.id = input.id;
        this.name = input.name;
        this.placeholder = input.placeholder;
        this.label = label && getText(label);
        this.type = input.type || 'text';
    }

    get isEmpty(): boolean {
        return this.type !== 'password' && !displayProps.some((prop) => Boolean(this[prop]));
    }
}

function setInput(input: HTMLInputElement, value: string): void {
    input.dispatchEvent(new Event('focus', {bubbles: true}));
    input.setAttribute('value', value);
    input.dispatchEvent(new Event('input', {bubbles: true}));
    input.dispatchEvent(new Event('change', {bubbles: true}));
    if (input.value !== value) {
        input.value = value;
        input.dispatchEvent(new Event('input', {bubbles: true}));
        input.dispatchEvent(new Event('change', {bubbles: true}));
    }
    input.dispatchEvent(new Event('blur', {bubbles: true}));
}

function isVisible(element: Element): boolean | undefined{
    if (element instanceof HTMLElement && element.offsetParent) {
        const rect = element.getBoundingClientRect();
        return rect.x >= 0 && rect.y >= 0;
    }
}

function isValid(input: HTMLInputElement): boolean | undefined {
    return isVisible(input) && (!input.type || inputTypes.includes(input.type as InputType));
}

chrome.runtime.onMessage.addListener(function (loginInputs: LoginInput[]) {
    loginInputs.filter((i) => i.frameId === frameId).forEach((i) => setInput(getInput(i.refId)!, i.value));
});

function getFrameId(w: Window = window): string {
    if (w === window.top) return 'top';
    for (let i = 0; i < w.parent.length; i++) {
        if (w === w.parent[i]) return `${getFrameId(w.parent)}.${i}`;
    }
    throw new Error('invalid frame');
}

function findInputs(document: Document) {
    return Array.from(document.querySelectorAll('input'))
        .filter(isValid)
        .map((input, index) => new InputInfo(frameId!, index, input))
        .filter((input) => !input.isEmpty);
}

chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
    if (port.name === 'popup') {
        port.onMessage.addListener((message: string) => {
            if (message === 'get-inputs') {
                if (!pageInfo) {
                    frameId = getFrameId();
                    const inputs = findInputs(document);
                    pageInfo = {url: window.location.href, inputs};
                }
                if (pageInfo.inputs.length) port.postMessage(pageInfo);
            }
        });
    }
});
