import chai, {expect} from 'chai';
chai.use(require('sinon-chai'));
import sinon from 'sinon';
import proxyquire from 'proxyquire';

let background, settings, vaultApi;

const vaultUrl = 'https://my.vault';
const token = 'the token';

const getAlarmListener = () => chrome.alarms.onAlarm.addListener.args[0][0];

module.exports = {
    'background': {
        beforeEach() {
            settings = {
                load: sinon.stub(),
                clearToken: sinon.stub()
            };
            vaultApi = {
                refreshToken: sinon.stub()
            };
            background = proxyquire('../lib/background', {
                './settings': settings,
                './vaultApi': vaultApi
            })
        },
        'onAlarm': {
            'ignores unknown alarm': async () => {
                await getAlarmListener()({name: 'unknown alamm'});

                expect(settings.load).to.not.be.called;
                expect(vaultApi.refreshToken).to.not.be.called;
                expect(settings.clearToken).to.not.be.called;
            },
            'renews token': async () => {
                settings.load.resolves({vaultUrl, token});
                vaultApi.refreshToken.resolves(true);

                await getAlarmListener()({name: 'refresh-token'})

                expect(settings.load).to.be.calledOnce;
                expect(vaultApi.refreshToken).to.be.calledOnce.calledWithExactly(vaultUrl, token);
                expect(settings.clearToken).to.not.be.called;
            },
            'clears token if renewal fails': async () => {
                settings.load.resolves({vaultUrl, token});
                vaultApi.refreshToken.resolves(false);

                await getAlarmListener()({name: 'refresh-token'})

                expect(settings.load).to.be.calledOnce;
                expect(vaultApi.refreshToken).to.be.calledOnce.calledWithExactly(vaultUrl, token);
                expect(settings.clearToken).to.be.calledOnce;
            }
        }
    }
};