const username = Boolean(document.querySelector('input[id*="user" i]'));
const password = Boolean(document.querySelector('input[type="password"]'));
const result = {username, password, url: window.location.href};

chrome.runtime.onMessage.addListener(function(message) {
    if (message) {
        if (message.username) {
            const userInput = document.querySelector('input[id*="user" i]');
            if (userInput) {
                userInput.setAttribute('value', message.username);
                userInput.dispatchEvent(new Event("change", {bubbles: true}));
                if (userInput.value !== message.username) userInput.value = message.username;
            }
        }
        if (message.password) {
            const passwordInput = document.querySelector('input[type="password"]');
            if (passwordInput) {
                passwordInput.setAttribute('value', message.password);
                passwordInput.dispatchEvent(new Event("change", {bubbles: true}));
                if (passwordInput.value !== message.password) passwordInput.value = message.password;
            }
        }
    }
});

if (username || password) chrome.runtime.sendMessage(result);