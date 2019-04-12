import * as permissions from '../lib/permissions';
import chai, {expect} from 'chai';
chai.use(require('sinon-chai'));

const baseUrl = 'https://my.vault.host';

module.exports = {
    'permissions': {
        'requestOrigin': {
            'requests access if not already granted': async () => {
                chrome.permissions.getAll.yields({origins: []});
                chrome.permissions.request.yields(true);

                expect(await permissions.requestOrigin(baseUrl)).to.be.true;

                expect(chrome.permissions.request).to.be.calledOnce;
                expect(chrome.permissions.request.args[0][0]).to.deep.equal({origins: [baseUrl + '/*']});
            },
            'allows trailing / on url': async () => {
                chrome.permissions.getAll.yields({origins: []});
                chrome.permissions.request.yields(true);

                expect(await permissions.requestOrigin(baseUrl + '/')).to.be.true;

                expect(chrome.permissions.request).to.be.calledOnce;
                expect(chrome.permissions.request.args[0][0]).to.deep.equal({origins: [baseUrl + '/*']});
            },
            'returns granted flag': async () => {
                chrome.permissions.getAll.yields({origins: []});
                chrome.permissions.request.yields(false);

                expect(await permissions.requestOrigin(baseUrl + '/')).to.be.false;
            },
            'does not request access if already granted': async () => {
                chrome.permissions.getAll.yields({origins: [baseUrl + '/*']});

                expect(await permissions.requestOrigin(baseUrl + '/')).to.be.true;

                expect(chrome.permissions.request).to.not.be.called;
            },
            'does not request access for child URL': async () => {
                chrome.permissions.getAll.yields({origins: [baseUrl + '/*']});

                expect(await permissions.requestOrigin(baseUrl + '/custom/path')).to.be.true;

                expect(chrome.permissions.request).to.not.be.called;
            }
        }
    }
};