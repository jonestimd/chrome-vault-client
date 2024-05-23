import {InputInfoProps} from './message';
import {getDomain} from './urls';
import * as vaultApi from './vaultApi';

const keys = ['vaultUrl', 'vaultPath', 'vaultUser', 'auth', 'secretPaths', 'totpSettings'];

export interface Settings {
    vaultUrl?: string;
    vaultPath?: string;
    vaultUser?: string;
    auth?: vaultApi.AuthToken;
    secretPaths?: vaultApi.SecretInfo[];
    totpSettings?: vaultApi.TotpSetting[]
}

export function load(): Promise<Settings> {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result?: Settings) => resolve(result ?? {}));
    });
}

export function save(vaultUrl: string, vaultPath: string, vaultUser: string, auth: vaultApi.AuthToken) {
    return new Promise<void>((resolve) => {
        chrome.storage.local.set({vaultUrl, vaultPath, vaultUser, auth}, () => resolve());
    });
}

export function saveToken(auth: vaultApi.AuthToken) {
    return new Promise<void>((resolve) => {
        chrome.storage.local.set({auth}, () => resolve());
    });
}

export const pageSettingsKey = 'pageInputSettings';

export interface InputSelections {
    [secretProp: string]: InputInfoProps | 'none';
}

interface PageInputSelection {
    [domain: string]: InputSelections;
}

interface PageInputSettings {
    [pageSettingsKey]?: PageInputSelection;
}

export function getInputSelections(hostname: string) {
    return new Promise<InputSelections>((resolve) => {
        chrome.storage.local.get(pageSettingsKey, (result: PageInputSettings = {}) => {
            resolve(result[pageSettingsKey]?.[hostname] ?? {});
        });
    });
}

export function saveInputSelection(hostname: string, secretProp: string, selection?: InputInfoProps) {
    return new Promise<void>((resolve) => {
        chrome.storage.local.get(pageSettingsKey, (result: PageInputSettings = {}) => {
            const pageSelection = result[pageSettingsKey]?.[hostname] ?? {};
            pageSelection[secretProp] = selection ?? 'none';
            chrome.storage.local.set({[pageSettingsKey]: {...result[pageSettingsKey], [hostname]: pageSelection}}, () => resolve());
        });
    });
}

export function clearToken() {
    return new Promise<void>((resolve) => {
        chrome.storage.local.remove(['auth'], () => resolve());
    });
}

export async function refreshToken() {
    const {vaultUrl, auth} = await load();
    if (vaultUrl && auth?.token) {
        const newAuth = await vaultApi.refreshToken(vaultUrl, auth.token);
        if (newAuth) {
            await saveToken(newAuth);
            return;
        }
    }
    await clearToken();
}

export async function cacheSecretInfo() {
    const {vaultUrl, vaultPath, auth} = await load();
    if (vaultUrl && auth && auth.expiresAt > Date.now()) {
        const secretPaths = await vaultApi.getSecretPaths(vaultUrl, vaultPath, auth.token);
        const totpSettings = await vaultApi.listTotpKeys(vaultUrl, auth.token);
        return new Promise<Required<Pick<Settings, 'secretPaths' | 'totpSettings'>>>((resolve) => {
            chrome.storage.local.set({secretPaths, totpSettings}, () => resolve({secretPaths, totpSettings}));
        });
    }
}

export async function getDomains() {
    const {secretPaths = []} = await cacheSecretInfo() ?? {};
    const domains = new Set(secretPaths.map((s) => getDomain(s.url)));
    return Array.from(domains);
}
