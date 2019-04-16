import agent from 'superagent';

export async function login(vaultUrl, user, password) {
    const { body } = await agent.post(`${vaultUrl}/v1/auth/userpass/login/${user}`, { password });
    return body && body.auth;
}

async function listSecrets(vaultUrl, token, path) {
    const { body } = await agent('LIST', `${vaultUrl}/v1/secret/metadata/${path || ''}`).set('X-Vault-Token', token);
    return body.data.keys;
}

async function getSecret(vaultUrl, token, path) {
    const { body } = await agent.get(`${vaultUrl}/v1/secret/data/${path}`).set('X-Vault-Token', token);
    return body.data.data;
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
            if (data.url) urlPaths[data.url] = path;
            i++;
        }
    }
    return urlPaths;
}