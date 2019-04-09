const vaultUrl = 'vault-url';
const vaultUser = 'vault-user';

export function getConfig() {
    if (chrome.storage) {
        return new Promise((resolve) => {
            chrome.storage.local.get([vaultUrl, vaultUser], (result) => {
                resolve({vaultUrl: result[vaultUrl], vaultUser: result[vaultUser]});
            });
        });
    }
    else return Promise.resolve({});
}