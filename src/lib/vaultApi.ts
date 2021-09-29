import * as agent from './agent';
import {refreshTokenAlarm} from './alarms';
import {getMessage} from './errors';
import {InputInfoProps} from './message';

const authHeader = 'X-Vault-Token';

export interface SecretInfo {
    path: string;
    url: string;
    keys: string[];
}

export interface UrlPaths {
    [siteUrl: string]: SecretInfo[]
}

interface VaultError {
    response: {
        body: {errors: string[]}
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isVaultError(err: any): err is VaultError {
    return 'response' in err && 'body' in err.response && 'errors' in err.response.body;
}

export function getErrorMessage(err: unknown): string | undefined {
    if (isVaultError(err)) return err.response.body.errors.join();
    return getMessage(err);
}

export interface AuthToken {
    client_token: string
    lease_duration: number
    renewable?: boolean
}

interface AuthResponse {
    auth?: AuthToken
}

function setRenewAlarm(body: AuthResponse): AuthToken {
    if (body.auth?.lease_duration) {
        const {renewable, lease_duration: leaseDuration} = body.auth;
        if (renewable && leaseDuration >= 60) {
            chrome.alarms.create(refreshTokenAlarm, {delayInMinutes: (leaseDuration - 30) / 60});
        }
        return body.auth;
    }
    console.info('no auth token', body);
    throw new Error('Login failed');
}

export async function login(vaultUrl: string, user: string, password: string): Promise<AuthToken> {
    try {
        const body = await agent.post<AuthResponse>(`${vaultUrl}/v1/auth/userpass/login/${user}`, {}, {password});
        return setRenewAlarm(body);
    } catch (err) {
        throw new Error(getErrorMessage(err));
    }
}

export async function refreshToken(vaultUrl: string, token: string): Promise<boolean> {
    try {
        const body = await agent.post<AuthResponse>(`${vaultUrl}/v1/auth/token/renew-self`, {[authHeader]: token});
        setRenewAlarm(body);
        return true;
    } catch (err) {
        console.log('error renewing token', err);
        return false;
    }
}

export async function logout(vaultUrl: string, token: string): Promise<void> {
    await agent.post(`${vaultUrl}/v1/auth/token/revoke-self`, {[authHeader]: token});
}

interface SecretData extends Record<string, string | undefined> {
    url: string
    username?: string
    password?: string
    'site url'?: string;
}

interface SecretResponse {
    data: {
        data: SecretData;
    }
}

interface SecretsList {
    data: {
        keys: string[];
    }
}

class Matcher {
    private static readonly inputProps: (keyof InputInfoProps)[] = ['id', 'name', 'label', 'placeholder'];
    private readonly conditions: Array<[keyof InputInfoProps, (value: string) => boolean]> = []

    constructor(input: InputInfoProps) {
        for (const prop of Matcher.inputProps) {
            const propValue = input[prop]?.toLowerCase();
            if (propValue) this.conditions.push([prop, (secretProp) => propValue.includes(secretProp)]);
        }
    }

    find(lowerKey: string): keyof InputInfoProps | void {
        const match = this.conditions.find(([, condition]) => condition(lowerKey));
        return match && match[0] as keyof InputInfoProps || undefined;
    }
}

export interface InputMatch {
    inputProp: keyof InputInfoProps;
    key: string;
    value?: string;
}

export function hasSecretValue(input: InputInfoProps, secret: SecretInfo): boolean {
    const matcher = new Matcher(input);
    return secret.keys.some(key => !!matcher.find(key.toLowerCase()))
        || input.type === 'password' && secret.keys.includes('password');
}

function asUrl(hostOrUrl: string): string {
    return /^https?:\/\//.test(hostOrUrl) ? hostOrUrl : 'https://' + hostOrUrl;
}

export class Secret {
    readonly url: string
    private readonly _siteUrl?: string
    private readonly _data: Readonly<Record<string, string | undefined>>;
    private readonly _keys: string[];

    constructor({url, 'site url': siteUrl, ...data}: SecretData) {
        this.url = asUrl(url);
        this._siteUrl = siteUrl && asUrl(siteUrl);
        this._data = data;
        this._keys = Object.keys(this._data);
    }

    get siteUrl(): string {
        return this._siteUrl ?? this.url;
    }

    get password(): string | undefined {
        return this._data['password'];
    }

    get(key: string): string | undefined {
        return this._data[key];
    }

    get keys(): string[] {
        return this._keys;
    }

    findValue(input: InputInfoProps): InputMatch | void {
        const matcher = new Matcher(input);
        for (const key of this._keys) {
            const inputProp = matcher.find(key.toLowerCase());
            if (inputProp) return {inputProp, key, value: this._data[key]};
        }
    }
}

export async function getSecret(vaultUrl: string, token: string, path: string): Promise<Secret | undefined> {
    const body = await agent.get<SecretResponse>(`${vaultUrl}/v1/secret/data/${path}`, {}, {[authHeader]: token});
    return body.data.data.url ? new Secret(body.data.data) : undefined;
}

async function listSecrets(vaultUrl: string, token: string, path?: string): Promise<string[]> {
    const body = await agent.list<SecretsList>(`${vaultUrl}/v1/secret/metadata/${path || ''}`, {[authHeader]: token});
    return body.data.keys;
}

export async function getUrlPaths(vaultUrl: string, vaultPath: string | undefined, token: string): Promise<UrlPaths> {
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
            if (secret && secret.keys.length > 0) {
                if (!urlPaths[secret.siteUrl]) urlPaths[secret.siteUrl] = [];
                urlPaths[secret.siteUrl].push({
                    path,
                    url: secret.url,
                    keys: secret.keys,
                });
            }
            i++;
        }
    }
    return urlPaths;
}
