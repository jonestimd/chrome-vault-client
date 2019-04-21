import agent from 'superagent';

const authHeader = 'X-Vault-Token';

export function getErrorMessage(err) {
    if (err.response && err.response.body && err.response.body.errors) return err.response.body.errors.join();
    return err.message;
}

export async function login(vaultUrl, user, password) {
    try {
        const { body } = await agent.post(`${vaultUrl}/v1/auth/userpass/login/${user}`, { password });
        return body && body.auth;
    } catch (err) {
        throw new Error(getErrorMessage(err));
    }
}

export async function logout(vaultUrl, token) {
    await agent.post(`${vaultUrl}/v1/auth/token/revoke-self`).set(authHeader, token);
}

export async function getSecret(vaultUrl, token, path) {
    const { body } = await agent.get(`${vaultUrl}/v1/secret/data/${path}`).set(authHeader, token);
    return body.data.data;
}

async function listSecrets(vaultUrl, token, path) {
    const { body } = await agent('LIST', `${vaultUrl}/v1/secret/metadata/${path || ''}`).set(authHeader, token);
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