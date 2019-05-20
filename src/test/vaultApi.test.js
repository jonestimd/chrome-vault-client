import * as chai from 'chai';
chai.use(require('sinon-chai'));
const {expect} = chai;
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

let vaultApi, superagent;

const vaultUrl = 'https://my.vault';
const token = 'vault token';
const authHeader = 'X-Vault-Token';
const password = 'vault password';
const username = 'vault user';

function agentRequest(type) {
    const request = {set: sinon.stub().resolves()};
    const method = type ? superagent[type] : superagent;
    method.returns(request);
    return request;
}

function getPathRequest(path) {
    const request = {set: sinon.stub().resolves()};
    superagent.get.withArgs(vaultUrl + path).returns(request);
    return request;
}

const secretResponse = (data) => ({body: {data: {data}}});

module.exports = {
    'vaultApi': {
        beforeEach() {
            superagent = sinon.stub();
            superagent.post = sinon.stub();
            superagent.get = sinon.stub();
            vaultApi = proxyquire('../lib/vaultApi', {superagent});
        },
        'getErrorMessage': {
            'returns message if response is undefined': () => {
                const message = 'some error';

                expect(vaultApi.getErrorMessage({message})).to.equal(message);
            },
            'returns message if response.body is undefined': () => {
                const message = 'some error';

                expect(vaultApi.getErrorMessage({message, response: {}})).to.equal(message);
            },
            'returns response.body.errors': () => {
                const message = 'some error';
                const errors = ['1st error', '2nd error'];

                expect(vaultApi.getErrorMessage({message, response: {body: {errors}}})).to.equal(errors.join());
            }
        },
        'login': {
            'returns auth object': async () => {
                const auth = {client_token: 'the token'};
                superagent.post.resolves({body: {auth}});

                const result = await vaultApi.login(vaultUrl, username, password);

                expect(result).to.equal(auth);
                expect(superagent.post).to.be.calledOnce
                    .calledWithExactly(`${vaultUrl}/v1/auth/userpass/login/${username}`, {password});
                expect(chrome.alarms.create, 'token not renewable').to.not.be.called;
            },
            'sets alarm to renew the token': async () => {
                const auth = {renewable: true, lease_duration: 60};
                superagent.post.resolves({body: {auth}});

                const result = await vaultApi.login(vaultUrl, username, password);

                expect(result).to.equal(auth);
                expect(chrome.alarms.create).to.be.calledOnce
                    .calledWithExactly('refresh-token', {delayInMinutes: (auth.lease_duration-30)/60});
            },
            'does not set alarm to renew the token if lease duration is less than 60s': async () => {
                const auth = {renewable: true, lease_duration: 59};
                superagent.post.resolves({body: {auth}});

                const result = await vaultApi.login(vaultUrl, username, password);

                expect(result).to.equal(auth);
                expect(chrome.alarms.create).to.not.be.called;
            },
            'returns undefined if response does not contain auth object': async () => {
                superagent.post.resolves({body: {}});

                const result = await vaultApi.login();

                expect(result).to.be.undefined;
            },
            'throws error with Vault message': async () => {
                const errors = ['invalid username or password'];
                superagent.post.rejects({response: {body: {errors}}});

                return vaultApi.login().then(() => expect.fail('expected an error'), (err) => {

                    expect(err.message).to.equal(errors[0]);
                });
            }
        },
        'refreshToken': {
            'sets new alarm after renewing the token': async () => {
                const auth = {renewable: true, lease_duration: 60};
                const request = agentRequest('post');
                superagent.post.returns(request);
                request.set.resolves({body: {auth}});

                expect(await vaultApi.refreshToken(vaultUrl, token)).to.be.true;

                expect(superagent.post).to.be.calledOnce.calledWithExactly(`${vaultUrl}/v1/auth/token/renew-self`);
                expect(request.set).to.be.calledOnce.calledWithExactly(authHeader, token);
                expect(chrome.alarms.create).to.be.calledOnce
                    .calledWithExactly('refresh-token', {delayInMinutes: (auth.lease_duration-30)/60});
            },
            'does not set new alarm if token is not renewable': async () => {
                const auth = {renewable: false, lease_duration: 60};
                const request = agentRequest('post');
                superagent.post.returns(request);
                request.set.resolves({body: {auth}});

                expect(await vaultApi.refreshToken(vaultUrl, token)).to.be.true;

                expect(superagent.post).to.be.calledOnce.calledWithExactly(`${vaultUrl}/v1/auth/token/renew-self`);
                expect(request.set).to.be.calledOnce.calledWithExactly(authHeader, token);
                expect(chrome.alarms.create).to.not.be.called;
            },
            'does not set new alarm if lease duration is less than 60s': async () => {
                const auth = {renewable: false, lease_duration: 59};
                const request = agentRequest('post');
                superagent.post.returns(request);
                request.set.resolves({body: {auth}});

                expect(await vaultApi.refreshToken(vaultUrl, token)).to.be.true;

                expect(superagent.post).to.be.calledOnce.calledWithExactly(`${vaultUrl}/v1/auth/token/renew-self`);
                expect(request.set).to.be.calledOnce.calledWithExactly(authHeader, token);
                expect(chrome.alarms.create).to.not.be.called;
            },
            'returns false if renewal fails': async () => {
                const auth = {renewable: false, lease_duration: 59};
                const request = agentRequest('post');
                superagent.post.returns(request);
                request.set.rejects({message: 'permission denied'});

                expect(await vaultApi.refreshToken(vaultUrl, token)).to.be.false;

                expect(superagent.post).to.be.calledOnce.calledWithExactly(`${vaultUrl}/v1/auth/token/renew-self`);
                expect(request.set).to.be.calledOnce.calledWithExactly(authHeader, token);
                expect(chrome.alarms.create).to.not.be.called;
            }
        },
        'logout': {
            'revokes Vault token': async () => {
                const request = agentRequest('post');

                await vaultApi.logout(vaultUrl, token);

                expect(superagent.post).to.be.calledOnce.calledWithExactly(`${vaultUrl}/v1/auth/token/revoke-self`);
                expect(request.set).to.be.calledOnce.calledWithExactly(authHeader, token);
            }
        },
        'getSecret': {
            'returns secret data': async () => {
                const path = '/secret/path';
                const data = {url: 'https://hostname:8080/path', username: 'site user', password: 'site password'};
                const request = agentRequest('get');
                request.set.resolves(secretResponse(data));

                const result = await vaultApi.getSecret(vaultUrl, token, path);

                expect(result.url).to.equal(data.url);
                expect(result.siteHost).to.equal('hostname:8080');
                expect(result.username).to.equal(data.username);
                expect(result.password).to.equal(data.password);
                expect(superagent.get).to.be.calledOnce.calledWithExactly(`${vaultUrl}/v1/secret/data/${path}`);
                expect(request.set).to.be.calledOnce.calledWithExactly(authHeader, token);
            }
        },
        'getUrlPaths': {
            'returns empty object for no secrets': async () => {
                const request = agentRequest();
                request.set.resolves({body: {data: {keys: []}}});

                const result = await vaultApi.getUrlPaths(vaultUrl, token);

                expect(result).to.deep.equal({});
                expect(superagent).to.be.calledOnce.calledWithExactly('LIST', `${vaultUrl}/v1/secret/metadata/`);
                expect(request.set).to.be.calledOnce.calledWithExactly(authHeader, token);
            },
            'returns secret path, username flag and password flag for each URL': async () => {
                agentRequest().set.resolves({body: {data: {keys: ['secret1', 'secret2', 'secret3', 'secret4', 'secret5']}}});
                const getRequest = agentRequest('get');
                getRequest.set.onCall(0).resolves(secretResponse({url: 'url1', username: 'url1 user'}));
                getRequest.set.onCall(1).resolves(secretResponse({url: 'url2', password: 'url2 password'}));
                getRequest.set.onCall(2).resolves(secretResponse({url: 'url3', note: 'skipped: no username or password'}));
                getRequest.set.onCall(3).resolves(secretResponse({url: 'url4', username: 'url3 user', password: 'url3 password'}));
                getRequest.set.onCall(4).resolves(secretResponse({username: 'url3 user', password: 'url3 password', note: 'skipped: no url'}));

                const result = await vaultApi.getUrlPaths(vaultUrl, token);

                expect(result).to.deep.equal({
                    url1: [{path: 'secret1', url: 'url1', username: true, password: false}],
                    url2: [{path: 'secret2', url: 'url2', username: false, password: true}],
                    url4: [{path: 'secret4', url: 'url4', username: true, password: true}],
                });
                expect(superagent.get).to.have.callCount(5)
                    .calledWithExactly(`${vaultUrl}/v1/secret/data/secret1`)
                    .calledWithExactly(`${vaultUrl}/v1/secret/data/secret2`)
                    .calledWithExactly(`${vaultUrl}/v1/secret/data/secret3`);
                expect(getRequest.set).to.have.callCount(5).calledWithExactly(authHeader, token);
            },
            'groups data by hostname and port': async () => {
                agentRequest().set.resolves({body: {data: {keys: ['secret1', 'secret2', 'secret3', 'secret4']}}});
                const getRequest = agentRequest('get');
                getRequest.set.onCall(0).resolves(secretResponse({url: 'https://host1/path1', username: 'host1 user'}));
                getRequest.set.onCall(1).resolves(secretResponse({url: 'host2', password: 'host2 password'}));
                getRequest.set.onCall(2).resolves(secretResponse({url: 'http://host1/path2', username: 'host1 user2', password: 'host1 password2'}));
                getRequest.set.onCall(3).resolves(secretResponse({url: 'http://host1:8080/path3', username: 'host1 user3', password: 'host1 password3'}));

                const result = await vaultApi.getUrlPaths(vaultUrl, token);

                expect(result).to.deep.equal({
                    host1: [
                        {path: 'secret1', url: 'https://host1/path1', username: true, password: false},
                        {path: 'secret3', url: 'http://host1/path2', username: true, password: true}],
                    'host1:8080': [{path: 'secret4', url: 'http://host1:8080/path3', username: true, password: true}],
                    host2: [{path: 'secret2', url: 'host2', username: false, password: true}],
                });
                expect(superagent.get).to.have.callCount(4)
                    .calledWithExactly(`${vaultUrl}/v1/secret/data/secret1`)
                    .calledWithExactly(`${vaultUrl}/v1/secret/data/secret2`)
                    .calledWithExactly(`${vaultUrl}/v1/secret/data/secret3`)
                    .calledWithExactly(`${vaultUrl}/v1/secret/data/secret4`);
                expect(getRequest.set).to.have.callCount(4).calledWithExactly(authHeader, token);
            },
            'returns data for nested secret paths': async () => {
                const listRequest = agentRequest().set;
                listRequest.onCall(0).resolves({body: {data: {keys: ['nested/', 'secret1']}}});
                listRequest.onCall(1).resolves({body: {data: {keys: ['secret2', 'secret3']}}});
                getPathRequest('/v1/secret/data/secret1').set.resolves(secretResponse({url: 'url1', username: 'url1 user'}));
                getPathRequest('/v1/secret/data/nested/secret2').set.resolves(secretResponse({url: 'url2', password: 'url2 password'}));
                getPathRequest('/v1/secret/data/nested/secret3').set.resolves(secretResponse({url: 'url3', username: 'url3 user', password: 'url3 password'}));

                const result = await vaultApi.getUrlPaths(vaultUrl, token);

                expect(result).to.deep.equal({
                    url1: [{path: 'secret1', url: 'url1', username: true, password: false}],
                    url2: [{path: 'nested/secret2', url: 'url2', username: false, password: true}],
                    url3: [{path: 'nested/secret3', url: 'url3', username: true, password: true}],
                });
                expect(superagent).to.be.calledTwice
                    .calledWithExactly('LIST', `${vaultUrl}/v1/secret/metadata/`)
                    .calledWithExactly('LIST', `${vaultUrl}/v1/secret/metadata/nested/`);
                expect(superagent.get).to.have.callCount(3)
                    .calledWithExactly(`${vaultUrl}/v1/secret/data/secret1`)
                    .calledWithExactly(`${vaultUrl}/v1/secret/data/nested/secret2`)
                    .calledWithExactly(`${vaultUrl}/v1/secret/data/nested/secret3`);
            }
        }
    }
}