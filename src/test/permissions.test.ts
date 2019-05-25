import * as permissions from '../lib/permissions';
import * as chai from 'chai';
chai.use(require('sinon-chai'));
import * as sinon from 'sinon';
const {expect} = chai;

const baseUrl = 'https://my.vault.host';

interface PermissionsStub {
    getAll: sinon.SinonStub;
    request: sinon.SinonStub;
}

let chromePermissions: PermissionsStub;

module.exports = {
    'permissions': {
        beforeEach() {
            global.chrome.permissions = chromePermissions = {
                getAll: sinon.stub(),
                request: sinon.stub()
            };
        },
        'requestOrigin': {
            'requests access if not already granted': async () => {
                chromePermissions.getAll.yields({origins: []});
                chromePermissions.request.yields(true);

                expect(await permissions.requestOrigin(baseUrl)).to.be.true;

                expect(chromePermissions.request).to.be.calledOnce;
                expect(chromePermissions.request.args[0][0]).to.deep.equal({origins: [baseUrl + '/*']});
            },
            'allows trailing / on url': async () => {
                chromePermissions.getAll.yields({origins: []});
                chromePermissions.request.yields(true);

                expect(await permissions.requestOrigin(baseUrl + '/')).to.be.true;

                expect(chromePermissions.request).to.be.calledOnce;
                expect(chromePermissions.request.args[0][0]).to.deep.equal({origins: [baseUrl + '/*']});
            },
            'returns granted flag': async () => {
                chromePermissions.getAll.yields({origins: []});
                chromePermissions.request.yields(false);

                expect(await permissions.requestOrigin(baseUrl + '/')).to.be.false;
            },
            // 'does not request access if already granted': async () => {
            //     chromePermissions.getAll.yields({origins: [baseUrl + '/*']});

            //     expect(await permissions.requestOrigin(baseUrl + '/')).to.be.true;

            //     expect(chromePermissions.request).to.not.be.called;
            // },
            // 'does not request access for child URL': async () => {
            //     chromePermissions.getAll.yields({origins: [baseUrl + '/*']});

            //     expect(await permissions.requestOrigin(baseUrl + '/custom/path')).to.be.true;

            //     expect(chromePermissions.request).to.not.be.called;
            // }
        }
    }
};