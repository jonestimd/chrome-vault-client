import * as chai from 'chai';
chai.use(require('sinon-chai'));
const {expect} = chai;
import * as sinon from 'sinon';
import * as settings from '../lib/settings';
import * as vaultApi from '../lib/vaultApi';

const vaultUrl = 'https://my.vault.host';
const vaultUser = 'username';
const token = 'vault token';

let vaultApiStub: {
    getUrlPaths: sinon.SinonStub;
}

let chromeStorage: {
    local: {
        get: sinon.SinonStub,
        set: sinon.SinonStub,
        remove: sinon.SinonStub
    }
}

module.exports = {
    'settings': {
        beforeEach() {
            vaultApiStub = {
                getUrlPaths: sinon.stub(vaultApi, 'getUrlPaths')
            };
            global.chrome.storage = chromeStorage = {
                local: {
                    get: sinon.stub(),
                    set: sinon.stub(),
                    remove: sinon.stub()
                }
            }
        },
        afterEach() {
            sinon.restore();
        },
        'load': {
            'returns stored settings': async () => {
                const storedSettings = {vaultUrl, vaultUser};
                chromeStorage.local.get.yields(storedSettings);

                const result = await settings.load();

                expect(result).to.equal(storedSettings);
                expect(chromeStorage.local.get).to.be.calledOnce;
                expect(chromeStorage.local.get.args[0][0]).to.deep.equal(['vaultUrl', 'vaultUser', 'token', 'urlPaths']);
            }
        },
        'save': {
            'saves vault Url, username and token to local storage': async () => {
                chromeStorage.local.set.yields();

                await settings.save(vaultUrl, vaultUser, token);

                expect(chromeStorage.local.set).to.be.calledOnce;
                expect(chromeStorage.local.set.args[0][0]).to.deep.equal({vaultUrl, vaultUser, token});
            }
        },
        'saveToken': {
            'saves token': async () => {
                chromeStorage.local.set.yields();

                await settings.saveToken(token);

                expect(chromeStorage.local.set).to.be.calledOnce;
                expect(chromeStorage.local.set.args[0][0]).to.deep.equal({token});
            }
        },
        'clearToken': {
            'removes token from stored settings': async () => {
                chromeStorage.local.remove.yields();

                await settings.clearToken();

                expect(chromeStorage.local.remove).to.be.calledOnce;
                expect(chromeStorage.local.remove.args[0][0]).to.deep.equal(['token']);
            }
        },
        'cacheUrlPaths': {
            'does nothing if URL is not saved': async () => {
                chromeStorage.local.get.yields({});

                await settings.cacheUrlPaths();

                expect(chromeStorage.local.get).to.be.calledOnce;
                expect(chromeStorage.local.set).to.not.be.called;
            },
            'saves result from vaultApi.getUrlPaths': async () => {
                const urlPaths = {'https://some.web.site': '/vault/secret/path'};
                chromeStorage.local.get.yields({vaultUrl, token});
                chromeStorage.local.set.yields();
                vaultApiStub.getUrlPaths.resolves(urlPaths);

                const result = await settings.cacheUrlPaths();

                expect(result).to.equal(urlPaths);
                expect(chromeStorage.local.set).to.be.calledOnce;
                expect(chromeStorage.local.set.args[0][0]).to.deep.equal({urlPaths});
            }
        }
    }
};