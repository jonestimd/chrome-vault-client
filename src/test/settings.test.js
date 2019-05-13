import * as chai from 'chai';
chai.use(require('sinon-chai'));
const {expect} = chai;
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

let settings, vaultApi;

const vaultUrl = 'https://my.vault.host';
const vaultUser = 'username';
const token = 'vault token';

module.exports = {
    'settings': {
        beforeEach() {
            vaultApi = {getUrlPaths: sinon.stub()};
            settings = proxyquire('../lib/settings', {'./vaultApi': vaultApi});
        },
        'load': {
            'returns stored settings': async () => {
                const storedSettings = {vaultUrl, vaultUser};
                chrome.storage.local.get.yields(storedSettings);

                const result = await settings.load();

                expect(result).to.equal(storedSettings);
                expect(chrome.storage.local.get).to.be.calledOnce;
                expect(chrome.storage.local.get.args[0][0]).to.deep.equal(['vaultUrl', 'vaultUser', 'token', 'urlPaths']);
            }
        },
        'save': {
            'saves vault Url, username and token to local storage': async () => {
                chrome.storage.local.set.yields();

                await settings.save(vaultUrl, vaultUser, token);

                expect(chrome.storage.local.set).to.be.calledOnce;
                expect(chrome.storage.local.set.args[0][0]).to.deep.equal({vaultUrl, vaultUser, token});
            }
        },
        'saveToken': {
            'saves token': async () => {
                chrome.storage.local.set.yields();

                await settings.saveToken(token);

                expect(chrome.storage.local.set).to.be.calledOnce;
                expect(chrome.storage.local.set.args[0][0]).to.deep.equal({token});
            }
        },
        'clearToken': {
            'removes token from stored settings': async () => {
                chrome.storage.local.remove.yields();

                await settings.clearToken();

                expect(chrome.storage.local.remove).to.be.calledOnce;
                expect(chrome.storage.local.remove.args[0][0]).to.deep.equal(['token']);
            }
        },
        'cacheUrlPaths': {
            'does nothing if URL is not saved': async () => {
                chrome.storage.local.get.yields({});

                await settings.cacheUrlPaths();

                expect(chrome.storage.local.get).to.be.calledOnce;
                expect(chrome.storage.local.set).to.not.be.called;
            },
            'saves result from vaultApi.getUrlPaths': async () => {
                const urlPaths = {'https://some.web.site': '/vault/secret/path'};
                chrome.storage.local.get.yields({vaultUrl, token});
                chrome.storage.local.set.yields();
                vaultApi.getUrlPaths.resolves(urlPaths);

                const result = await settings.cacheUrlPaths();

                expect(result).to.equal(urlPaths);
                expect(chrome.storage.local.set).to.be.calledOnce;
                expect(chrome.storage.local.set.args[0][0]).to.deep.equal({urlPaths});
            }
        }
    }
};