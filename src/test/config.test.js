import * as config from '../lib/config';
import chai, {expect} from 'chai';
import { chmod } from 'fs';
chai.use(require('sinon-chai'));

const baseUrl = 'https://my.vault.host';
const username = 'username';

module.exports = {
    'config': {
        'load': {
            'returns empty object for no configuration': async () => {
                chrome.storage.local.get.yields({});

                const {vaultUrl, vaultUser} = await config.load();

                expect(vaultUrl).to.be.undefined;
                expect(vaultUser).to.be.undefined;
                expect(chrome.storage.local.get).to.be.calledOnce;
            },
            'returns vault Url and username from local storage': async () => {
                chrome.storage.local.get.yields({'vault-url': baseUrl, 'vault-user': username});

                const {vaultUrl, vaultUser} = await config.load();

                expect(vaultUrl).to.equal(baseUrl);
                expect(vaultUser).to.equal(username);
                expect(chrome.storage.local.get).to.be.calledOnce;
            }
        },
        'save': {
            'saves vault Url and username to local storage': async () => {
                chrome.storage.local.set.yields();

                await config.save(baseUrl, username);

                expect(chrome.storage.local.set).to.be.calledOnce;
                expect(chrome.storage.local.set.args[0][0]).to.deep.equal({'vault-url': baseUrl, 'vault-user': username});
            }
        }
    }
};