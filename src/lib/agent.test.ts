import * as agent from './agent';

const url = 'https://example.com';

describe('agent', () => {
    const fetch = jest.fn();

    beforeEach(() => {
        global.fetch = fetch;
    });
    afterAll(() => {
        global.fetch = null as any;
    });
    describe('get', () => {
        it('parses response', async () => {
            const data = {data: 'value'};
            const query = {param: 'value'};
            const headers = {auth: 'token'};
            fetch.mockResolvedValue({ok: true, text: () => JSON.stringify(data)});

            const result = await agent.get(url, query, headers);

            expect(result).toEqual(data);
            expect(fetch).toBeCalledWith(`${url}/?param=value`, {headers});
        });
        it('defaults to no query or headers', async () => {
            const data = {data: 'value'};
            fetch.mockResolvedValue({ok: true, text: () => JSON.stringify(data)});

            const result = await agent.get(url);

            expect(result).toEqual(data);
            expect(fetch).toBeCalledWith(`${url}/`, {headers: {}});
        });
        it('throws error if !ok', async () => {
            const message = 'something went wrong';
            fetch.mockResolvedValue({ok: false, statusText: message});

            await expect(agent.get(url)).rejects.toThrow(message);
        });
    });
    describe('list', () => {
        it('parses response', async () => {
            const data = {data: 'value'};
            const headers = {auth: 'token'};
            fetch.mockResolvedValue({ok: true, text: () => JSON.stringify(data)});

            const result = await agent.list(url, headers);

            expect(result).toEqual(data);
            expect(fetch).toBeCalledWith(url, {method: 'LIST', headers});
        });
        it('defaults to no query or headers', async () => {
            const data = {data: 'value'};
            fetch.mockResolvedValue({ok: true, text: () => JSON.stringify(data)});

            const result = await agent.list(url);

            expect(result).toEqual(data);
            expect(fetch).toBeCalledWith(url, {method: 'LIST', headers: {}});
        });
        it('throws error if !ok', async () => {
            const message = 'something went wrong';
            fetch.mockResolvedValue({ok: false, statusText: message});

            await expect(agent.list(url)).rejects.toThrow(message);
        });
    });
    describe('post', () => {
        it('parses non-empty response', async () => {
            const data = {data: 'value'};
            const headers = {auth: 'token'};
            fetch.mockResolvedValue({ok: true, text: () => JSON.stringify(data)});

            const result = await agent.post(url, headers);

            expect(result).toEqual(data);
            expect(fetch).toBeCalledWith(url, {method: 'POST', body: undefined, headers});
        });
        it('returns empty response', async () => {
            const headers = {auth: 'token'};
            fetch.mockResolvedValue({ok: true, text: () => ''});

            const result = await agent.post(url, headers);

            expect(result).toEqual('');
            expect(fetch).toBeCalledWith(url, {method: 'POST', body: undefined, headers});
        });
        it('stringifies body', async () => {
            const data = {data: 'value'};
            const body = {param: 'value'};
            const headers = {auth: 'token'};
            fetch.mockResolvedValue({ok: true, text: () => JSON.stringify(data)});

            const result = await agent.post(url, headers, body);

            expect(result).toEqual(data);
            expect(fetch).toBeCalledWith(url, {method: 'POST', body: JSON.stringify(body), headers});
        });
        it('throws error if !ok', async () => {
            const message = 'something went wrong';
            fetch.mockResolvedValue({ok: false, statusText: message});

            await expect(agent.post(url)).rejects.toThrow(message);
        });
    });
});
