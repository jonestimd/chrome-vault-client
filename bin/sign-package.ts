#! /usr/bin/env -S node -r ts-node/register
import * as file from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as childProcess from 'node:child_process';

if (!process.env.VAULT_ADDR) {
    console.error('please set VAULT_ADDR');
    process.exit(1);
}

const tokenFile = path.join(process.env.HOME ?? path.join(process.env.HOMEDRIVE!, process.env.HOMEPATH!), '.vault-token');
if (!file.existsSync(tokenFile)) {
    console.error('no token file');
    process.exit(1);
}
const vaultToken = file.readFileSync(tokenFile, 'utf-8');
const headers = {
    'X-Vault-Token': vaultToken,
};

interface ISecret {
    data?: {data: Record<string, string>};
    errors?: string[];
}

function getJwtSecret() {
    return new Promise<{secret: string, user: string}>((resolve, reject) => {
        https.get(`${process.env.VAULT_ADDR!}/v1/secret/data/web/development/firefox`, {headers}, (res) => {
            let data = '';
            res.on('error', (error) => reject(error));
            res.on('data', (chunk: string) => {
                data = data + chunk;
            });
            res.on('end', () => {
                const {errors, data: secretData} = JSON.parse(data) as ISecret;
                if (errors?.length) reject(new Error(`Error reading Vault secret: ${errors.join()}`));
                else {
                    const {'JWT secret': secret, 'JWT user': user} = secretData?.data ?? {};
                    if (secret && user) resolve({secret, user});
                    else reject(new Error('Vault secret must include "JWT user" and "JWT secret'));
                }
            });
        });
    });
}

getJwtSecret().then(({user, secret}) => {
    childProcess.fork(path.join(__dirname, '..', '/node_modules/web-ext/bin/web-ext.js'), [
        'sign',
        '-s', 'build',
        '-i', 'chrome*.js',
        '--api-key', user,
        '--api-secret', secret]);
}).catch((error) => {
    console.error(error);
});
