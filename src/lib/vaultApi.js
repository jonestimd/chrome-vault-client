import agent from 'superagent';
import {refreshTokenAlarm} from './alarms';

const authHeader = 'X-Vault-Token';

export function getErrorMessage(err) {
    if (err.response && err.response.body && err.response.body.errors) return err.response.body.errors.join();
    return err.message;
}

function setRenewAlarm(body) {
    const auth = body && body.auth;
    if (auth && auth.renewable && auth.lease_duration >= 60) {
        chrome.alarms.create(refreshTokenAlarm, {delayInMinutes: (auth.lease_duration - 30)/60});
    }
    return auth;
}

export async function login(vaultUrl, user, password) {
    try {
        const {body} = await agent.post(`${vaultUrl}/v1/auth/userpass/login/${user}`, {password});
        return setRenewAlarm(body);
    } catch (err) {
        throw new Error(getErrorMessage(err));
    }
}

export async function refreshToken(vaultUrl, token) {
    try {
        const {body} = await agent.post(`${vaultUrl}/v1/auth/token/renew-self`).set(authHeader, token);
        setRenewAlarm(body);
        return true;
    } catch (err) {
        console.log('error renewing token', err);
        return false;
    }
}

export async function logout(vaultUrl, token) {
    await agent.post(`${vaultUrl}/v1/auth/token/revoke-self`).set(authHeader, token);
}

export async function getSecret(vaultUrl, token, path) {
    const {body} = await agent.get(`${vaultUrl}/v1/secret/data/${path}`).set(authHeader, token);
    return body.data.data;
}

async function listSecrets(vaultUrl, token, path) {
    const {body} = await agent('LIST', `${vaultUrl}/v1/secret/metadata/${path || ''}`).set(authHeader, token);
    return body.data.keys;
}

export async function getUrlPaths(vaultUrl, token) {
    const names = await listSecrets(vaultUrl, token);
    const urlPaths = {};
    for (let i = 0; i < names.length;) {
        const path = names[i];
        if (path.endsWith('/')) {
            const nested = await listSecrets(vaultUrl, token, path);
            names.splice(i, 1, ...nested.map(child => path + child));
        }
        else {
            const data = await getSecret(vaultUrl, token, names[i]);
            if (data.url) {
                urlPaths[data.url] = {
                    path,
                    username: Boolean(data.username),
                    password: Boolean(data.password)
                };
            }
            i++;
        }
    }
    return urlPaths;
}