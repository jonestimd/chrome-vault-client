import {LoginMessage, PageInfoMessage} from './message';

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

const username = Boolean(findVisibleInput('input[id*="user" i]') || findByLabel('user'));
const password = Boolean(findVisibleInput('input[type="password"]'));
const email = Boolean(findVisibleInput('input[id*="email" i]') || findByLabel('email'));
const result: PageInfoMessage = {username, password, email, url: window.location.href};

if (username || password || email) chrome.runtime.sendMessage(result);