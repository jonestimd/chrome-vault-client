import * as agent from './agent';
import * as vaultApi from './vaultApi';

const vaultUrl = 'https://my.vault';
const vaultPath = 'web';
const token = 'vault token';
const authHeader = 'X-Vault-Token';
const password = 'vault password';
const username = 'vault user';

const secretResponse = (data: Record<string, string>) => ({data: {data}});

function mockGets(responses: Record<string, any>) {
    jest.spyOn(agent, 'get').mockImplementation((url) => {
        return secretResponse(responses[url.substring(vaultUrl.length)]) as any;
    });
}

describe('vaultApi', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'info').mockImplementation(() => { });
    });
    describe('getErrorMessage', () => {
        it('returns message if response is undefined', () => {
            const message = 'some error';

            expect(vaultApi.getErrorMessage({message})).toEqual(message);
        });
        it('returns message if response.body is undefined', () => {
            const message = 'some error';

            expect(vaultApi.getErrorMessage({message, response: {}})).toEqual(message);
        });
        it('returns response.body.errors', () => {
            const message = 'some error';
            const errors = ['1st error', '2nd error'];

            expect(vaultApi.getErrorMessage({message, response: {body: {errors}}})).toEqual(errors.join());
        });
    });
    describe('login', () => {
        it('does not renew token if lease duration < 60 seconds', async () => {
            const auth = {client_token: 'the token', lease_duration: 59};
            jest.spyOn(agent, 'post').mockResolvedValue({auth});

            const result = await vaultApi.login(vaultUrl, username, password);

            expect(result).toEqual(auth);
            expect(agent.post).toHaveBeenCalledTimes(1);
            expect(agent.post).toHaveBeenCalledWith(`${vaultUrl}/v1/auth/userpass/login/${username}`, {}, {password});
            expect(chrome.alarms.create).not.toHaveBeenCalled();
        });
        it('sets alarm to renew the token', async () => {
            const auth = {renewable: true, lease_duration: 60};
            jest.spyOn(agent, 'post').mockResolvedValue({auth});

            const result = await vaultApi.login(vaultUrl, username, password);

            expect(result).toEqual(auth);
            expect(chrome.alarms.create).toHaveBeenCalledTimes(1);
            expect(chrome.alarms.create).toHaveBeenCalledWith('refresh-token', {delayInMinutes: (auth.lease_duration - 30) / 60});
        });
        it('does not set alarm to renew the token if lease duration is less than 60s', async () => {
            const auth = {renewable: true, lease_duration: 59};
            jest.spyOn(agent, 'post').mockResolvedValue({auth});

            const result = await vaultApi.login(vaultUrl, username, password);

            expect(result).toEqual(auth);
            expect(chrome.alarms.create).not.toHaveBeenCalled();
        });
        it('throws error if response does not contain auth object', async () => {
            jest.spyOn(agent, 'post').mockResolvedValue({});

            await expect(vaultApi.login('url', 'user', 'password')).rejects.toThrow('Login failed');
        });
        it('throws error with Vault message', async () => {
            const errors = ['invalid username or password'];
            jest.spyOn(agent, 'post').mockRejectedValue(JSON.stringify({errors}));

            await expect(vaultApi.login('url', 'user', 'password')).rejects.toThrow(errors[0]);
        });
    });
    describe('refreshToken', () => {
        it('sets new alarm after renewing the token', async () => {
            const auth = {renewable: true, lease_duration: 60};
            jest.spyOn(agent, 'post').mockResolvedValue({auth});

            expect(await vaultApi.refreshToken(vaultUrl, token)).toEqual(true);

            expect(agent.post).toHaveBeenCalledTimes(1);
            expect(agent.post).toHaveBeenCalledWith(`${vaultUrl}/v1/auth/token/renew-self`, {[authHeader]: token});
            expect(chrome.alarms.create).toHaveBeenCalledTimes(1);
            expect(chrome.alarms.create).toHaveBeenCalledWith('refresh-token', {delayInMinutes: (auth.lease_duration - 30) / 60});
        });
        it('does not set new alarm if token is not renewable', async () => {
            const auth = {renewable: false, lease_duration: 60};
            jest.spyOn(agent, 'post').mockResolvedValue({auth});

            expect(await vaultApi.refreshToken(vaultUrl, token)).toEqual(true);

            expect(agent.post).toHaveBeenCalledTimes(1);
            expect(agent.post).toHaveBeenCalledWith(`${vaultUrl}/v1/auth/token/renew-self`, {[authHeader]: token});
            expect(chrome.alarms.create).not.toHaveBeenCalled();
        });
        it('does not set new alarm if lease duration is less than 60s', async () => {
            const auth = {renewable: false, lease_duration: 59};
            jest.spyOn(agent, 'post').mockResolvedValue({auth});

            expect(await vaultApi.refreshToken(vaultUrl, token)).toEqual(true);

            expect(agent.post).toHaveBeenCalledTimes(1);
            expect(agent.post).toHaveBeenCalledWith(`${vaultUrl}/v1/auth/token/renew-self`, {[authHeader]: token});
            expect(chrome.alarms.create).not.toHaveBeenCalled();
        });
        it('returns false if renewal fails', async () => {
            jest.spyOn(agent, 'post').mockRejectedValue(new Error('permission denied'));

            expect(await vaultApi.refreshToken(vaultUrl, token)).toEqual(false);

            expect(agent.post).toHaveBeenCalledTimes(1);
            expect(agent.post).toHaveBeenCalledWith(`${vaultUrl}/v1/auth/token/renew-self`, {[authHeader]: token});
            expect(chrome.alarms.create).not.toHaveBeenCalled();
        });
    });
    describe('logout', () => {
        it('revokes Vault token', async () => {
            jest.spyOn(agent, 'post').mockResolvedValue(undefined);

            await vaultApi.logout(vaultUrl, token);

            expect(agent.post).toHaveBeenCalledTimes(1);
            expect(agent.post).toHaveBeenCalledWith(`${vaultUrl}/v1/auth/token/revoke-self`, {[authHeader]: token});
        });
    });
    describe('getSecret', () => {
        it('returns secret data', async () => {
            const path = '/secret/path';
            const data = {url: 'https://hostname:8080/path', username: 'site user', password: 'site password', email: 'user@mail.host'};
            jest.spyOn(agent, 'get').mockResolvedValue(secretResponse(data));

            const result = await vaultApi.getSecret(vaultUrl, token, path);

            expect(result?.get('username')).toEqual(data.username);
            expect(result?.password).toEqual(data.password);
            expect(result?.get('email')).toEqual(data.email);
            expect(agent.get).toHaveBeenCalledTimes(1);
            expect(agent.get).toHaveBeenCalledWith(`${vaultUrl}/v1/secret/data/${path}`, {}, {[authHeader]: token});
        });
    });
    describe('getUrlPaths', () => {
        it('returns empty object for no secrets', async () => {
            jest.spyOn(agent, 'list').mockResolvedValue({data: {keys: []}});

            const result = await vaultApi.getSecretPaths(vaultUrl, vaultPath, token);

            expect(result).toEqual([]);
            expect(agent.list).toHaveBeenCalledTimes(1);
            expect(agent.list).toHaveBeenCalledWith(`${vaultUrl}/v1/secret/metadata/${vaultPath}`, {[authHeader]: token});
        });
        it('accepts empty string for path', async () => {
            jest.spyOn(agent, 'list').mockResolvedValue({data: {keys: []}});

            const result = await vaultApi.getSecretPaths(vaultUrl, '', token);

            expect(result).toEqual([]);
            expect(agent.list).toHaveBeenCalledTimes(1);
            expect(agent.list).toHaveBeenCalledWith(`${vaultUrl}/v1/secret/metadata/`, {[authHeader]: token});
        });
        it('returns secret path and keys for each domain', async () => {
            jest.spyOn(agent, 'list').mockResolvedValue({data: {keys: ['secret1', 'secret2', 'secret3', 'secret4', 'secret5']}});
            mockGets({
                '/v1/secret/data/web/secret1': {url: 'url1', 'site url': 'url1 site', username: 'url1 user'},
                '/v1/secret/data/web/secret2': {url: 'url2', password: 'url2 password', 'encryption key': 'url2 encryption key'},
                '/v1/secret/data/web/secret3': {url: 'url3', note: 'no username or password'},
                '/v1/secret/data/web/secret4': {url: 'url4', username: 'url3 user', password: 'url3 password', email: 'url3 email'},
                '/v1/secret/data/web/secret5': {username: 'url3 user', password: 'url3 password', note: 'skipped: no url'},
            });

            const result = await vaultApi.getSecretPaths(vaultUrl, vaultPath, token);

            expect(result).toEqual([
                {keys: ['username'], path: 'web/secret1', url: 'url1 site'},
                {keys: ['password', 'encryption key'], path: 'web/secret2', url: 'url2'},
                {keys: ['username', 'password', 'email'], path: 'web/secret4', url: 'url4'},
            ]);
            expect(agent.get).toHaveBeenCalledTimes(5);
            expect(agent.get).toHaveBeenCalledWith(`${vaultUrl}/v1/secret/data/${vaultPath}/secret1`, {}, {[authHeader]: token});
            expect(agent.get).toHaveBeenCalledWith(`${vaultUrl}/v1/secret/data/${vaultPath}/secret2`, {}, {[authHeader]: token});
            expect(agent.get).toHaveBeenCalledWith(`${vaultUrl}/v1/secret/data/${vaultPath}/secret3`, {}, {[authHeader]: token});
            expect(agent.get).toHaveBeenCalledWith(`${vaultUrl}/v1/secret/data/${vaultPath}/secret4`, {}, {[authHeader]: token});
            expect(agent.get).toHaveBeenCalledWith(`${vaultUrl}/v1/secret/data/${vaultPath}/secret5`, {}, {[authHeader]: token});
        });
        it('groups data by domain', async () => {
            jest.spyOn(agent, 'list').mockResolvedValue({data: {keys: ['secret1', 'secret2', 'secret3', 'secret4']}});
            mockGets({
                '/v1/secret/data/web/secret1': {url: 'https://host1.domain1.com', username: 'host1 user'},
                '/v1/secret/data/web/secret2': {url: 'host2', password: 'host2 password'},
                '/v1/secret/data/web/secret3': {url: 'host2.domain1.com', username: 'host1 user2', password: 'host1 password2'},
                '/v1/secret/data/web/secret4': {url: 'https://domain1.com:8080', username: 'host1 user3', password: 'host1 password3'},
            });

            const result = await vaultApi.getSecretPaths(vaultUrl, vaultPath, token);

            expect(result).toEqual([
                {keys: ['username'], path: 'web/secret1', url: 'https://host1.domain1.com'},
                {keys: ['password'], path: 'web/secret2', url: 'host2'},
                {keys: ['username', 'password'], path: 'web/secret3', url: 'host2.domain1.com'},
                {keys: ['username', 'password'], path: 'web/secret4', url: 'https://domain1.com:8080'},
            ]);
            expect(agent.get).toHaveBeenCalledTimes(4);
            expect(agent.get).toHaveBeenCalledWith(`${vaultUrl}/v1/secret/data/web/secret1`, {}, {[authHeader]: token});
            expect(agent.get).toHaveBeenCalledWith(`${vaultUrl}/v1/secret/data/web/secret2`, {}, {[authHeader]: token});
            expect(agent.get).toHaveBeenCalledWith(`${vaultUrl}/v1/secret/data/web/secret3`, {}, {[authHeader]: token});
            expect(agent.get).toHaveBeenCalledWith(`${vaultUrl}/v1/secret/data/web/secret4`, {}, {[authHeader]: token});
        });
        it('returns data for nested secret paths', async () => {
            jest.spyOn(agent, 'list')
                .mockResolvedValueOnce({data: {keys: ['nested/', 'secret1']}})
                .mockResolvedValueOnce({data: {keys: ['secret2', 'secret3']}});
            mockGets({
                '/v1/secret/data/web/secret1': {url: 'url1', username: 'url1 user', email: 'user@host'},
                '/v1/secret/data/web/nested/secret2': {url: 'url2', password: 'url2 password'},
                '/v1/secret/data/web/nested/secret3': {url: 'url3', username: 'url3 user', password: 'url3 password'},
            });

            const result = await vaultApi.getSecretPaths(vaultUrl, vaultPath, token);

            expect(result).toEqual([
                {keys: ['username', 'email'], path: 'web/secret1', url: 'url1'},
                {keys: ['password'], path: 'web/nested/secret2', url: 'url2'},
                {keys: ['username', 'password'], path: 'web/nested/secret3', url: 'url3'},
            ]);
            expect(agent.list).toHaveBeenCalledWith(`${vaultUrl}/v1/secret/metadata/web`, {[authHeader]: token});
            expect(agent.list).toHaveBeenCalledWith(`${vaultUrl}/v1/secret/metadata/web/nested/`, {[authHeader]: token});
            expect(agent.get).toHaveBeenCalledTimes(3);
            expect(agent.get).toHaveBeenCalledWith(`${vaultUrl}/v1/secret/data/web/secret1`, {}, {[authHeader]: token});
            expect(agent.get).toHaveBeenCalledWith(`${vaultUrl}/v1/secret/data/web/nested/secret2`, {}, {[authHeader]: token});
            expect(agent.get).toHaveBeenCalledWith(`${vaultUrl}/v1/secret/data/web/nested/secret3`, {}, {[authHeader]: token});
        });
    });
});