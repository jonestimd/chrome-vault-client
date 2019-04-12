const vaultUrl = 'vault-url';
const vaultUser = 'vault-user';

export function load() {
    if (chrome.storage) {
        return new Promise((resolve) => {
            chrome.storage.local.get([vaultUrl, vaultUser], (result) => {
                resolve({vaultUrl: result[vaultUrl], vaultUser: result[vaultUser]});
            });
        });
    }
    else return Promise.resolve({});
}

export function save(baseUrl, username) {
    chrome.storage.local.set({[vaultUrl]: baseUrl, [vaultUser]: username});
}