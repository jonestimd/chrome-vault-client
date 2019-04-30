const username = Boolean(document.querySelector('input[type="text"][id*="user" i]'));
const password = Boolean(document.querySelector('input[type="password"]'));
const result = {username, password, url: window.location.href};

chrome.runtime.onMessage.addListener(function(message) {
    if (message) {
        if (message.username) {
            const userInput = document.querySelector('input[type="text"][id*="user" i]');
            if (userInput) userInput.value = message.username;
        }
        if (message.password) {
            const passwordInput = document.querySelector('input[type="password"]');
            if (passwordInput) passwordInput.value = message.password;
        }
    }
});

if (username || password) chrome.runtime.sendMessage(result);