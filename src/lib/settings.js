import * as vaultApi from './vaultApi';

const keys = ['vaultUrl', 'vaultUser', 'token', 'urlPaths'];

export function load() {
    return new Promise(resolve => {
        chrome.storage.local.get(keys, (result) => resolve(result));
    });
}

export function save(vaultUrl, vaultUser, token) {
    return new Promise(resolve => {
        chrome.storage.local.set({ vaultUrl, vaultUser, token }, () => resolve());
    });
}

export function saveToken(token) {
    return new Promise(resolve => {
        chrome.storage.local.set({ token }, () => resolve());
    });
}

export function clearToken() {
    return new Promise(resolve => {
        chrome.storage.local.remove(['token'], () => resolve());
    })
}

export async function cacheUrlPaths() {
    const { vaultUrl, token } = await load();
    if (vaultUrl) {
        const urlPaths = await vaultApi.getUrlPaths(vaultUrl, token);
        return new Promise(resolve => {
            chrome.storage.local.set({urlPaths}, () => resolve(urlPaths));
        });
    }
}