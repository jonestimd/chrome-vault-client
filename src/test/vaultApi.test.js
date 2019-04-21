import chai, {expect} from 'chai';
chai.use(require('sinon-chai'));
import sinon from 'sinon';
import proxyquire from 'proxyquire';

let vaultApi, superagent;

const vaultUrl = 'https://my.vault';
const token = 'vault token';
const authHeader = 'X-Vault-Token';

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
                const password = 'vault password';
                const username = 'vault user';
                const auth = {client_token: 'the token'};
                superagent.post.resolves({body: {auth}});

                const result = await vaultApi.login(vaultUrl, username, password);

                expect(result).to.equal(auth);
                expect(superagent.post).to.be.calledOnce.calledWithExactly(`${vaultUrl}/v1/auth/userpass/login/${username}`, {password});
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
                const data = {username: 'site user', password: 'site password'};
                const request = agentRequest('get');
                request.set.resolves(secretResponse(data));

                const result = await vaultApi.getSecret(vaultUrl, token, path);

                expect(result).to.equal(data);
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
                agentRequest().set.resolves({body: {data: {keys: ['secret1', 'secret2', 'secret3']}}});
                const getRequest = agentRequest('get');
                getRequest.set.onCall(0).resolves(secretResponse({url: 'url1', username: 'url1 user'}));
                getRequest.set.onCall(1).resolves(secretResponse({url: 'url2', password: 'url2 password'}));
                getRequest.set.onCall(2).resolves(secretResponse({url: 'url3', username: 'url3 user', password: 'url3 password'}));

                const result = await vaultApi.getUrlPaths(vaultUrl, token);

                expect(result).to.deep.equal({
                    url1: {path: 'secret1', username: true, password: false},
                    url2: {path: 'secret2', username: false, password: true},
                    url3: {path: 'secret3', username: true, password: true},
                });
                expect(superagent.get).to.have.callCount(3)
                    .calledWithExactly(`${vaultUrl}/v1/secret/data/secret1`)
                    .calledWithExactly(`${vaultUrl}/v1/secret/data/secret2`)
                    .calledWithExactly(`${vaultUrl}/v1/secret/data/secret3`);
                expect(getRequest.set).to.have.callCount(3).calledWithExactly(authHeader, token);
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
                    url1: {path: 'secret1', username: true, password: false},
                    url2: {path: 'nested/secret2', username: false, password: true},
                    url3: {path: 'nested/secret3', username: true, password: true},
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