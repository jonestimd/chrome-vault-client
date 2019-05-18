import {LoginMessage, PageInfoMessage} from './message';

const username = Boolean(document.querySelector('input[id*="user" i]'));
const password = Boolean(document.querySelector('input[type="password"]'));
const result: PageInfoMessage = {username, password, url: window.location.href};

function setInput(input: HTMLInputElement, value: string): void {
    input.setAttribute('value', value);
    input.dispatchEvent(new Event("change", {bubbles: true}));
    if (input.value !== value) {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
    }
}

function isVisibleInput(element: Element): boolean {
    return element.tagName === 'INPUT' && element.getClientRects().length > 0;
}

function findVisibleInput(selector: string): HTMLInputElement | undefined{
    const elements = document.querySelectorAll(selector);
    return Array.from(elements).find(isVisibleInput) as HTMLInputElement;
}

chrome.runtime.onMessage.addListener(function(message: LoginMessage) {
    if (message) {
        if (message.username) {
            const userInput = findVisibleInput('input[id*="user" i]');
            if (userInput) setInput(userInput, message.username);
        }
        if (message.password) {
            const passwordInput = findVisibleInput('input[type="password"]');
            if (passwordInput) setInput(passwordInput, message.password);
        }
    }
});

if (username || password) chrome.runtime.sendMessage(result);