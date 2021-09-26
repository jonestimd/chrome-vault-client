import * as vaultApi from './vaultApi';

const keys = ['vaultUrl', 'vaultPath', 'vaultUser', 'token', 'urlPaths'];

export interface Settings {
    vaultUrl?: string;
    vaultPath?: string;
    vaultUser?: string;
    token?: string;
    urlPaths?: vaultApi.UrlPaths;
}

export function load(): Promise<Settings> {
    return new Promise(resolve => {
        chrome.storage.local.get(keys, (result: Settings) => resolve(result));
    });
}

export function save(vaultUrl: string, vaultPath: string, vaultUser: string, token: string): Promise<void> {
    return new Promise(resolve => {
        chrome.storage.local.set({vaultUrl, vaultPath, vaultUser, token}, () => resolve());
    });
}

export function saveToken(token: string): Promise<void> {
    return new Promise(resolve => {
        chrome.storage.local.set({token}, () => resolve());
    });
}

export function clearToken(): Promise<void> {
    return new Promise(resolve => {
        chrome.storage.local.remove(['token'], () => resolve());
    });
}

export async function cacheUrlPaths(): Promise<vaultApi.UrlPaths | undefined> {
    const {vaultUrl, vaultPath, token} = await load();
    if (vaultUrl && token) {
        const urlPaths = await vaultApi.getUrlPaths(vaultUrl, vaultPath, token);
        return new Promise(resolve => {
            chrome.storage.local.set({urlPaths}, () => resolve(urlPaths));
        });
    }
}

function toUrl(url: string): URL {
    try {
        return new URL(url);
    } catch (err) { // just the hostname
        return new URL(`https://` + url);
    }
}

export async function uniqueUrls(): Promise<URL[]> {
    return toUniqueUrls(await cacheUrlPaths());
}

export function toUniqueUrls(urlPaths?: vaultApi.UrlPaths): URL[] {
    if (urlPaths) {
        const urlStrings = new Map<string, URL>();
        Object.values(urlPaths).forEach((secrets) => {
            secrets.forEach((secret) => {
                const url = toUrl(secret.url);
                if (!urlStrings.has(url.toString())) urlStrings.set(url.toString(), url);
            });
        });
        return Array.from(urlStrings.values());
    }
    return [];
}
