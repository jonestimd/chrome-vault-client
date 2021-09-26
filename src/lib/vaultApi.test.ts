import * as agent from 'superagent';
import * as vaultApi from './vaultApi';

const vaultUrl = 'https://my.vault';
const vaultPath = 'web';
const token = 'vault token';
const authHeader = 'X-Vault-Token';
const password = 'vault password';
const username = 'vault user';

jest.mock('superagent', () => {
    const mock = jest.fn() as any;
    mock.get = jest.fn();
    mock.post = jest.fn();
    return mock;
});

const mockAgent: jest.MockedFunction<typeof agent> & {
    get: jest.MockedFunction<typeof agent['get']>,
    post: jest.MockedFunction<typeof agent['post']>,
} = agent as any;

function agentRequest(type?: 'get' | 'post') {
    const request = {set: jest.fn()};
    if (type) mockAgent[type].mockReturnValue(request as any);
    else mockAgent.mockReturnValue(request as any);
    return request;
}

function mockGets(responses: Record<string, any>) {
    mockAgent.get.mockImplementation((url) => {
        return {set: jest.fn().mockResolvedValue(responses[url.substring(vaultUrl.length)])} as any;
    });
}

const secretResponse = (data: {[key: string]: string}) => ({body: {data: {data}}});

describe('vaultApi', () => {
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
            mockAgent.post.mockResolvedValue({body: {auth}} as any);

            const result = await vaultApi.login(vaultUrl, username, password);

            expect(result).toEqual(auth);
            expect(agent.post).toBeCalledTimes(1);
            expect(agent.post).toBeCalledWith(`${vaultUrl}/v1/auth/userpass/login/${username}`, {password});
            expect(chrome.alarms.create).not.toBeCalled();
        });
        it('sets alarm to renew the token', async () => {
            const auth = {renewable: true, lease_duration: 60};
            mockAgent.post.mockResolvedValue({body: {auth}} as any);

            const result = await vaultApi.login(vaultUrl, username, password);

            expect(result).toEqual(auth);
            expect(chrome.alarms.create).toBeCalledTimes(1);
            expect(chrome.alarms.create).toBeCalledWith('refresh-token', {delayInMinutes: (auth.lease_duration - 30) / 60});
        });
        it('does not set alarm to renew the token if lease duration is less than 60s', async () => {
            const auth = {renewable: true, lease_duration: 59};
            mockAgent.post.mockResolvedValue({body: {auth}} as any);

            const result = await vaultApi.login(vaultUrl, username, password);

            expect(result).toEqual(auth);
            expect(chrome.alarms.create).not.toBeCalled();
        });
        it('throws error if response does not contain auth object', async () => {
            mockAgent.post.mockResolvedValue({body: {}} as any);

            await expect(vaultApi.login('url', 'user', 'password')).rejects.toThrow('Login failed');
        });
        it('throws error with Vault message', async () => {
            const errors = ['invalid username or password'];
            mockAgent.post.mockRejectedValue({response: {body: {errors}}});

            await expect(vaultApi.login('url', 'user', 'password')).rejects.toThrow(errors[0]);
        });
    });
    describe('refreshToken', () => {
        it('sets new alarm after renewing the token', async () => {
            const auth = {renewable: true, lease_duration: 60};
            const request = agentRequest('post');
            request.set.mockResolvedValue({body: {auth}});

            expect(await vaultApi.refreshToken(vaultUrl, token)).toEqual(true);

            expect(agent.post).toBeCalledTimes(1);
            expect(agent.post).toBeCalledWith(`${vaultUrl}/v1/auth/token/renew-self`);
            expect(request.set).toBeCalledTimes(1);
            expect(request.set).toBeCalledWith(authHeader, token);
            expect(chrome.alarms.create).toBeCalledTimes(1);
            expect(chrome.alarms.create).toBeCalledWith('refresh-token', {delayInMinutes: (auth.lease_duration - 30) / 60});
        });
        it('does not set new alarm if token is not renewable', async () => {
            const auth = {renewable: false, lease_duration: 60};
            const request = agentRequest('post');
            request.set.mockResolvedValue({body: {auth}});

            expect(await vaultApi.refreshToken(vaultUrl, token)).toEqual(true);

            expect(agent.post).toBeCalledTimes(1);
            expect(agent.post).toBeCalledWith(`${vaultUrl}/v1/auth/token/renew-self`);
            expect(request.set).toBeCalledTimes(1);
            expect(request.set).toBeCalledWith(authHeader, token);
            expect(chrome.alarms.create).not.toBeCalled();
        });
        it('does not set new alarm if lease duration is less than 60s', async () => {
            const auth = {renewable: false, lease_duration: 59};
            const request = agentRequest('post');
            request.set.mockResolvedValue({body: {auth}});

            expect(await vaultApi.refreshToken(vaultUrl, token)).toEqual(true);

            expect(agent.post).toBeCalledTimes(1);
            expect(agent.post).toBeCalledWith(`${vaultUrl}/v1/auth/token/renew-self`);
            expect(request.set).toBeCalledTimes(1);
            expect(request.set).toBeCalledWith(authHeader, token);
            expect(chrome.alarms.create).not.toBeCalled();
        });
        it('returns false if renewal fails', async () => {
            const request = agentRequest('post');
            request.set.mockRejectedValue({message: 'permission denied'});

            expect(await vaultApi.refreshToken(vaultUrl, token)).toEqual(false);

            expect(agent.post).toBeCalledTimes(1);
            expect(agent.post).toBeCalledWith(`${vaultUrl}/v1/auth/token/renew-self`);
            expect(request.set).toBeCalledTimes(1);
            expect(request.set).toBeCalledWith(authHeader, token);
            expect(chrome.alarms.create).not.toBeCalled();
        });
    });
    describe('logout', () => {
        it('revokes Vault token', async () => {
            const request = agentRequest('post');

            await vaultApi.logout(vaultUrl, token);

            expect(agent.post).toBeCalledTimes(1);
            expect(agent.post).toBeCalledWith(`${vaultUrl}/v1/auth/token/revoke-self`);
            expect(request.set).toBeCalledTimes(1);
            expect(request.set).toBeCalledWith(authHeader, token);
        });
    });
    describe('getSecret', () => {
        it('returns secret data', async () => {
            const path = '/secret/path';
            const data = {url: 'https://hostname:8080/path', username: 'site user', password: 'site password', email: 'user@mail.host'};
            const request = agentRequest('get');
            request.set.mockResolvedValue(secretResponse(data));

            const result = await vaultApi.getSecret(vaultUrl, token, path);

            expect(result?.url).toEqual(data.url);
            expect(result?.siteUrl).toEqual(data.url);
            expect(result?.get('username')).toEqual(data.username);
            expect(result?.password).toEqual(data.password);
            expect(result?.get('email')).toEqual(data.email);
            expect(agent.get).toBeCalledTimes(1);
            expect(agent.get).toBeCalledWith(`${vaultUrl}/v1/secret/data/${path}`);
            expect(request.set).toBeCalledTimes(1);
            expect(request.set).toBeCalledWith(authHeader, token);
        });
    });
    describe('getUrlPaths', () => {
        it('returns empty object for no secrets', async () => {
            const request = agentRequest();
            request.set.mockResolvedValue({body: {data: {keys: []}}});

            const result = await vaultApi.getUrlPaths(vaultUrl, vaultPath, token);

            expect(result).toEqual({});
            expect(agent).toBeCalledTimes(1);
            expect(agent).toBeCalledWith('LIST', `${vaultUrl}/v1/secret/metadata/${vaultPath}`);
            expect(request.set).toBeCalledTimes(1);
            expect(request.set).toBeCalledWith(authHeader, token);
        });
        it('accepts empty string for path', async () => {
            const request = agentRequest();
            request.set.mockResolvedValue({body: {data: {keys: []}}});

            const result = await vaultApi.getUrlPaths(vaultUrl, '', token);

            expect(result).toEqual({});
            expect(agent).toBeCalledTimes(1);
            expect(agent).toBeCalledWith('LIST', `${vaultUrl}/v1/secret/metadata/`);
            expect(request.set).toBeCalledTimes(1);
            expect(request.set).toBeCalledWith(authHeader, token);
        });
        it('returns secret path and keys for each URL', async () => {
            agentRequest().set.mockResolvedValue({body: {data: {keys: ['secret1', 'secret2', 'secret3', 'secret4', 'secret5']}}});
            const getRequest = agentRequest('get');
            getRequest.set.mockResolvedValueOnce(secretResponse({url: 'url1', username: 'url1 user'}));
            getRequest.set.mockResolvedValueOnce(secretResponse({url: 'url2', password: 'url2 password'}));
            getRequest.set.mockResolvedValueOnce(secretResponse({url: 'url3', note: 'no username or password'}));
            getRequest.set.mockResolvedValueOnce(secretResponse({url: 'url4', username: 'url3 user', password: 'url3 password', email: 'url3 email'}));
            getRequest.set.mockResolvedValueOnce(secretResponse({username: 'url3 user', password: 'url3 password', note: 'skipped: no url'}));

            const result = await vaultApi.getUrlPaths(vaultUrl, vaultPath, token);

            expect(result).toEqual({
                'https://url1': [{path: 'web/secret1', url: 'https://url1', keys: ['username']}],
                'https://url2': [{path: 'web/secret2', url: 'https://url2', keys: ['password']}],
                'https://url3': [{path: 'web/secret3', url: 'https://url3', keys: ['note']}],
                'https://url4': [{path: 'web/secret4', url: 'https://url4', keys: ['username', 'password', 'email']}],
            });
            expect(agent.get).toBeCalledTimes(5);
            expect(agent.get).toBeCalledWith(`${vaultUrl}/v1/secret/data/${vaultPath}/secret1`);
            expect(agent.get).toBeCalledWith(`${vaultUrl}/v1/secret/data/${vaultPath}/secret2`);
            expect(agent.get).toBeCalledWith(`${vaultUrl}/v1/secret/data/${vaultPath}/secret3`);
            expect(getRequest.set).toBeCalledTimes(5);
            expect(getRequest.set).toBeCalledWith(authHeader, token);
        });
        it('groups data by url', async () => {
            agentRequest().set.mockResolvedValue({body: {data: {keys: ['secret1', 'secret2', 'secret3', 'secret4']}}});
            const getRequest = agentRequest('get');
            getRequest.set.mockResolvedValueOnce(secretResponse({url: 'https://host1', username: 'host1 user'}));
            getRequest.set.mockResolvedValueOnce(secretResponse({url: 'host2', password: 'host2 password'}));
            getRequest.set.mockResolvedValueOnce(secretResponse({url: 'host1', username: 'host1 user2', password: 'host1 password2'}));
            getRequest.set.mockResolvedValueOnce(secretResponse({url: 'https://host1:8080', username: 'host1 user3', password: 'host1 password3'}));

            const result = await vaultApi.getUrlPaths(vaultUrl, vaultPath, token);

            expect(result).toEqual({
                'https://host1': [
                    {path: 'web/secret1', url: 'https://host1', keys: ['username']},
                    {path: 'web/secret3', url: 'https://host1', keys: ['username', 'password']}],
                'https://host1:8080': [{path: 'web/secret4', url: 'https://host1:8080', keys: ['username', 'password']}],
                'https://host2': [{path: 'web/secret2', url: 'https://host2', keys: ['password']}],
            });
            expect(agent.get).toBeCalledTimes(4);
            expect(agent.get).toBeCalledWith(`${vaultUrl}/v1/secret/data/web/secret1`);
            expect(agent.get).toBeCalledWith(`${vaultUrl}/v1/secret/data/web/secret2`);
            expect(agent.get).toBeCalledWith(`${vaultUrl}/v1/secret/data/web/secret3`);
            expect(agent.get).toBeCalledWith(`${vaultUrl}/v1/secret/data/web/secret4`);
            expect(getRequest.set).toBeCalledTimes(4);
            expect(getRequest.set).toBeCalledWith(authHeader, token);
        });
        it('returns data for nested secret paths', async () => {
            const listRequest = agentRequest().set;
            listRequest.mockResolvedValueOnce({body: {data: {keys: ['nested/', 'secret1']}}});
            listRequest.mockResolvedValueOnce({body: {data: {keys: ['secret2', 'secret3']}}});
            mockGets({
                '/v1/secret/data/web/secret1': secretResponse({url: 'url1', username: 'url1 user', email: 'user@host'}),
                '/v1/secret/data/web/nested/secret2': secretResponse({url: 'url2', password: 'url2 password'}),
                '/v1/secret/data/web/nested/secret3': secretResponse({url: 'url3', username: 'url3 user', password: 'url3 password'}),
            });

            const result = await vaultApi.getUrlPaths(vaultUrl, vaultPath, token);

            expect(result).toEqual({
                'https://url1': [{path: 'web/secret1', url: 'https://url1', keys: ['username', 'email']}],
                'https://url2': [{path: 'web/nested/secret2', url: 'https://url2', keys: ['password']}],
                'https://url3': [{path: 'web/nested/secret3', url: 'https://url3', keys: ['username', 'password']}],
            });
            expect(agent).toBeCalledTimes(2);
            expect(agent).toBeCalledWith('LIST', `${vaultUrl}/v1/secret/metadata/web`);
            expect(agent).toBeCalledWith('LIST', `${vaultUrl}/v1/secret/metadata/web/nested/`);
            expect(agent.get).toBeCalledTimes(3);
            expect(agent.get).toBeCalledWith(`${vaultUrl}/v1/secret/data/web/secret1`);
            expect(agent.get).toBeCalledWith(`${vaultUrl}/v1/secret/data/web/nested/secret2`);
            expect(agent.get).toBeCalledWith(`${vaultUrl}/v1/secret/data/web/nested/secret3`);
        });
    });
});