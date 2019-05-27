import {LoginMessage, PageInfoMessage, InputInfo} from './message';

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

function containsText(value: string): (element: HTMLElement) => boolean {
    return (element: HTMLElement) => {
        return element.innerHTML && element.innerHTML.toLowerCase().includes(value);
    }
}

function findByLabel(text: string): HTMLInputElement | undefined {
    const labels = document.querySelectorAll('label[for]');
    const label = Array.from(labels).filter(isVisible).find(containsText(text));
    return label && document.getElementById(label.getAttribute('for')) as HTMLInputElement;
}

function findVisibleInput(selector: string): HTMLInputElement | undefined {
    const elements = document.querySelectorAll(selector);
    return Array.from(elements).filter(isInput).find(isVisible) as HTMLInputElement;
}

chrome.runtime.onMessage.addListener(function (message: LoginMessage) {
    if (message) {
        if (message.username) {
            const userInput = findVisibleInput('input[id*="user" i]') || findByLabel('user');
            if (userInput) setInput(userInput, message.username);
        }
        if (message.email) {
            const emailInput = findVisibleInput('input[id*="email" i]') || findByLabel('email');
            if (emailInput) setInput(emailInput, message.email);
        }
        if (message.password) {
            const passwordInput = findVisibleInput('input[type="password"]');
            if (passwordInput) setInput(passwordInput, message.password);
        }
    }
});

function getLabel(input: HTMLInputElement): HTMLLabelElement {
    const label = input.id && document.querySelector(`label[for="${input.id}"]`);
    if (label) return label as HTMLLabelElement;
    else {
        let parent = input.parentElement;
        while (parent && parent.tagName !== 'LABEL') parent = parent.parentElement;
        return parent as HTMLLabelElement;
    }
}

function getText(element: Element): string {
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

function getInputInfo(input: HTMLInputElement): InputInfo {
    const label = getLabel(input);
    return {
        id: input.id,
        name: input.name,
        label: label && getText(label),
        visible: input.getClientRects().length > 0
    };
}

const inputTypes = ['text', 'email', 'tel', 'password'];
const inputSelector = inputTypes.map(type => `input[type="${type}"]`).join(', ');
const username = Boolean(findVisibleInput('input[id*="user" i]') || findByLabel('user'));
const password = Boolean(findVisibleInput('input[type="password"]'));
const email = Boolean(findVisibleInput('input[id*="email" i]') || findByLabel('email'));
const inputs: InputInfo[] = Array.from(document.querySelectorAll(inputSelector))
    .map(getInputInfo)
    .filter(input => input.id || input.name || input.label);
const result: PageInfoMessage = {username, password, email, url: window.location.href, inputs};

if (username || password || email) chrome.runtime.sendMessage(result);