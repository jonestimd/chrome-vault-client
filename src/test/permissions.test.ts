import * as permissions from '../lib/permissions';

const baseUrl = 'https://my.vault.host';

interface PermissionsStub {
    request: jest.MockedFunction<typeof chrome.permissions['request']>;
}

let chromePermissions: PermissionsStub;

describe('permissions', () => {
    beforeEach(() => {
        global.chrome.permissions = chromePermissions = {
            request: jest.fn(),
        };
    });
    describe('requestOrigin', () => {
        it('requests access if not already granted', async () => {
            chromePermissions.request.mockImplementationOnce((perm, cb) => cb(true));

            expect(await permissions.requestOrigin(baseUrl)).toEqual(true);

            expect(chromePermissions.request).toBeCalledTimes(1);
            expect(chromePermissions.request.mock.calls[0][0]).toEqual({origins: [baseUrl + '/*']});
        });
        it('allows trailing / on url', async () => {
            chromePermissions.request.mockImplementationOnce((perm, cb) => cb(true));

            expect(await permissions.requestOrigin(baseUrl + '/')).toEqual(true);

            expect(chromePermissions.request).toBeCalledTimes(1);
            expect(chromePermissions.request.mock.calls[0][0]).toEqual({origins: [baseUrl + '/*']});
        });
        it('returns granted flag', async () => {
            chromePermissions.request.mockImplementationOnce((perm, cb) => cb(false));

            expect(await permissions.requestOrigin(baseUrl + '/')).toEqual(false);
        });
    });
});
