import * as vaultApi from './vaultApi';
import {settings} from 'cluster';

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
    })
}

export async function cacheUrlPaths(): Promise<vaultApi.UrlPaths> {
    const {vaultUrl, vaultPath, token} = await load();
    if (vaultUrl) {
        const urlPaths = await vaultApi.getUrlPaths(vaultUrl, vaultPath, token);
        return new Promise(resolve => {
            chrome.storage.local.set({urlPaths}, () => resolve(urlPaths));
        });
    }
}