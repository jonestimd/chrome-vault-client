import {getDomain} from './urls';
import * as vaultApi from './vaultApi';

const keys = ['vaultUrl', 'vaultPath', 'vaultUser', 'token', 'secretPaths'];

export interface Settings {
    vaultUrl?: string;
    vaultPath?: string;
    vaultUser?: string;
    token?: string;
    secretPaths?: vaultApi.SecretInfo[];
}

export function load(): Promise<Settings> {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result?: Settings) => resolve(result ?? {}));
    });
}

export function save(vaultUrl: string, vaultPath: string, vaultUser: string, token: string): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.set({vaultUrl, vaultPath, vaultUser, token}, () => resolve());
    });
}

export function saveToken(token: string): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.set({token}, () => resolve());
    });
}

export function clearToken(): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.remove(['token'], () => resolve());
    });
}

export async function cacheSecretPaths(): Promise<vaultApi.SecretInfo[] | undefined> {
    const {vaultUrl, vaultPath, token} = await load();
    if (vaultUrl && token) {
        const secretPaths = await vaultApi.getSecretPaths(vaultUrl, vaultPath, token);
        return new Promise((resolve) => {
            chrome.storage.local.set({secretPaths}, () => resolve(secretPaths));
        });
    }
}

export async function getDomains(): Promise<string[]> {
    const secretPaths = await cacheSecretPaths() ?? [];
    const domains = new Set(secretPaths.map((s) => getDomain(s.url)));
    return Array.from(domains);
}
