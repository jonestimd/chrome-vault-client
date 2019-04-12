const vaultUrl = 'vault-url';
const vaultUser = 'vault-user';

export function load() {
    return new Promise(resolve => {
        chrome.storage.local.get([vaultUrl, vaultUser], (result) => {
            resolve({vaultUrl: result[vaultUrl], vaultUser: result[vaultUser]});
        });
    });
}

export function save(baseUrl, username) {
    return new Promise(resolve => {
        chrome.storage.local.set({[vaultUrl]: baseUrl, [vaultUser]: username}, (result) => {
            resolve();
        });
    });
}