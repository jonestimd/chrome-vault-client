import * as agent from 'superagent';
import { refreshTokenAlarm } from './alarms';

const authHeader = 'X-Vault-Token';

export interface SecretInfo {
    path: string
    url: string
    username: boolean
    password: boolean
    email: boolean
}

export interface UrlPaths {
    [siteHost: string]: SecretInfo[]
}

interface VaultError {
    response?: {
        body?: { errors?: string[] }
    }
    message?: string
}

export function getErrorMessage(err: VaultError): string {
    if (err.response && err.response.body && err.response.body.errors) return err.response.body.errors.join();
    return err.message;
}

export interface AuthToken {
    client_token?: string
    lease_duration?: number
    renewable?: boolean
}
interface AuthResponse {
    auth?: AuthToken
}

function setRenewAlarm(body: AuthResponse): AuthToken {
    const auth = body && body.auth;
    if (auth && auth.renewable && auth.lease_duration >= 60) {
        chrome.alarms.create(refreshTokenAlarm, { delayInMinutes: (auth.lease_duration - 30) / 60 });
    }
    return auth;
}

export async function login(vaultUrl: string, user: string, password: string): Promise<AuthToken> {
    try {
        const { body } = await agent.post(`${vaultUrl}/v1/auth/userpass/login/${user}`, { password });
        return setRenewAlarm(body);
    } catch (err) {
        throw new Error(getErrorMessage(err));
    }
}

export async function refreshToken(vaultUrl: string, token: string): Promise<boolean> {
    try {
        const { body } = await agent.post(`${vaultUrl}/v1/auth/token/renew-self`).set(authHeader, token);
        setRenewAlarm(body);
        return true;
    } catch (err) {
        console.log('error renewing token', err);
        return false;
    }
}

export async function logout(vaultUrl: string, token: string): Promise<void> {
    await agent.post(`${vaultUrl}/v1/auth/token/revoke-self`).set(authHeader, token);
}
function getHost(url: string): string {
    try {
        const {hostname, port} = new URL(url);
        return hostname + (port ? ':' + port : '');
    } catch (err) {
        return url;
    }
}

interface SecretData {
    url?: string
    username?: string
    password?: string
    [key: string]: string
}

export class Secret {
    readonly url?: string
    readonly username?: string
    readonly password?: string
    readonly email?: string
    private data: {readonly [key: string]: string}

    constructor({url, username, password, email, ...data}: SecretData) {
        this.url = url;
        this.username = username;
        this.password = password;
        this.email = email;
        this.data = data;
    }

    get siteHost(): string | undefined {
        if (this.data['site url']) return getHost(this.data['site url']);
        return getHost(this.url);
    }
}

export async function getSecret(vaultUrl: string, token: string, path: string): Promise<Secret> {
    const { body } = await agent.get(`${vaultUrl}/v1/secret/data/${path}`).set(authHeader, token);
    return new Secret(body.data.data);
}

async function listSecrets(vaultUrl: string, token: string, path?: string): Promise<string[]> {
    const { body } = await agent('LIST', `${vaultUrl}/v1/secret/metadata/${path || ''}`).set(authHeader, token);
    return body.data.keys;
}

export async function getUrlPaths(vaultUrl: string, vaultPath: string, token: string): Promise<UrlPaths> {
    const names = (await listSecrets(vaultUrl, token, vaultPath)).map(name => vaultPath ? `${vaultPath}/${name}` : name);
    const urlPaths: UrlPaths = {};
    for (let i = 0; i < names.length;) {
        const path = names[i];
        if (path.endsWith('/')) {
            const nested = await listSecrets(vaultUrl, token, path);
            names.splice(i, 1, ...nested.map(child => path + child));
        }
        else {
            const secret = await getSecret(vaultUrl, token, names[i]);
            if (secret.url && (secret.username || secret.password || secret.email)) {
                if (!urlPaths[secret.siteHost]) urlPaths[secret.siteHost] = [];
                urlPaths[secret.siteHost].push({
                    path,
                    url: secret.url,
                    username: Boolean(secret.username),
                    password: Boolean(secret.password),
                    email: Boolean(secret.email)
                });
            }
            i++;
        }
    }
    return urlPaths;
}