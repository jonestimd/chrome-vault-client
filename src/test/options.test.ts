import './types/global';
import * as chai from 'chai';
chai.use(require('sinon-chai'));
const {expect} = chai;
import * as sinon from 'sinon';
import {JSDOM} from 'jsdom';
import * as settings from '../lib/settings';
import * as permissions from '../lib/permissions';
import * as vaultApi from '../lib/vaultApi';
import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import {MockTextField} from './mock/MockTextField';
import {MockUrlCardList} from './mock/MockUrlCardList';
import {MockSnackbar} from './mock/MockSnackbar';
import * as proxyquire from 'proxyquire';
proxyquire.noCallThru();

const nextTick = promisify(setImmediate);

const html = fs.readFileSync(path.join(__dirname, '../views/options.html'));

const sandbox = sinon.createSandbox();

const vaultUrl = 'https://my.vault';
const vaultPath = 'web/';
const vaultUser = 'my vault id';
const password = 'passw0rd';
const token = 'vault token';

const secretInfo = (path: string, url: string): vaultApi.SecretInfo => ({path, url, username: true, password: true, email: false});
const urlPaths = {
    'my.bank.com': [secretInfo('/secret/my-bank', 'https://my.bank.com')],
    'my.utility.com': [
        secretInfo('/secret/my-utility/user1', 'https://my.utility.com/path1'),
        secretInfo('/secret/my-utility/user2', 'https://my.utility.com/path2')],
};

const loadPage = async () => {
    global.window = new JSDOM(html).window;
    global.document = window.document;
    proxyquire('../lib/options', {
        '@material/ripple/index': {MDCRipple: sandbox.stub()},
        '@material/textfield/index': {MDCTextField: MockTextField},
        '@material/snackbar': {MDCSnackbar: MockSnackbar},
        './components/UrlCardList': {default: MockUrlCardList}
    });
    await nextTick();
};

let settingsStub: sinon.SinonStubbedInstance<typeof settings>;
let permissionsStub: sinon.SinonStubbedInstance<typeof permissions>;
let vaultApiStub: sinon.SinonStubbedInstance<typeof vaultApi>;

const getInput = (id: string) => (document.getElementById(id) as HTMLInputElement);

module.exports = {
    'options': {
        beforeEach() {
            settingsStub = sandbox.stub(settings);
            permissionsStub = sandbox.stub(permissions);
            vaultApiStub = sandbox.stub(vaultApi);
        },
        afterEach() {
            sandbox.restore();
        },
        'displays saved URL, path and username': async () => {
            settingsStub.load.resolves({vaultUrl, vaultPath, vaultUser, token});

            await loadPage();

            await nextTick();
            expect(getInput('vault-url').value).to.equal(vaultUrl);
            expect(getInput('vault-path').value).to.equal(vaultPath);
            expect(getInput('username').value).to.equal(vaultUser);
            expect(document.getElementById('status').innerText).to.equal('Logged in');
            expect(MockUrlCardList.byId['saved-urls'].removeAll).to.not.be.called;
            expect(MockUrlCardList.byId['saved-urls'].addCard).to.not.be.called;
            expect(MockTextField.byId.password.required).to.not.be.true;
            expect(getInput('reload').disabled).to.be.false;
        },
        'moves focus to password when URL and username are in settings': async () => {
            settingsStub.load.resolves({vaultUrl, vaultUser});

            await loadPage();

            await nextTick();
            expect(MockTextField.byId.username.focus).to.be.calledOnce;
            expect(MockTextField.byId.password.focus).to.be.calledOnce;
        },
        'marks URL, username and password invalid when settings are empty': async () => {
            settingsStub.load.resolves({});

            await loadPage();

            await nextTick();
            expect(MockTextField.byId['vault-url'].getDefaultFoundation().setValid)
                .to.be.calledOnce.calledWithExactly(false);
            expect(MockTextField.byId.username.getDefaultFoundation().setValid)
                .to.be.calledOnce.calledWithExactly(false);
            expect(MockTextField.byId.password.getDefaultFoundation().setValid)
                .to.be.calledOnce.calledWithExactly(false);
            expect(MockTextField.byId.password.required).to.be.true;
        },
        'displays saved URLs': async () => {
            settingsStub.load.resolves({urlPaths});

            await loadPage();

            await nextTick();
            expect(MockUrlCardList.byId['saved-urls'].removeAll).to.be.calledOnce;
            expect(MockUrlCardList.byId['saved-urls'].addCard).to.be.calledTwice
                .calledWithExactly('my.bank.com', ['https://my.bank.com'], ['/secret/my-bank'])
                .calledWithExactly('my.utility.com',
                    ['https://my.utility.com/path1', 'https://my.utility.com/path2'],
                    ["/secret/my-utility/user1", "/secret/my-utility/user2"]);
        },
        'logout button': {
            'revokes vault token': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token});
                vaultApiStub.logout.resolves();
                settingsStub.clearToken.resolves();
                await loadPage();

                document.getElementById('logout').click();

                await nextTick();
                expect(vaultApi.logout).to.be.calledOnce.calledWithExactly(vaultUrl, token);
                expect(settings.clearToken).to.be.calledOnce;
                expect(document.getElementById('status').innerText).to.equal('Not logged in');
            },
            'clears token when vault returns 403': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token});
                vaultApiStub.logout.rejects({status: 403});
                settingsStub.clearToken.resolves();
                await loadPage();

                document.getElementById('logout').click();

                await nextTick();
                expect(vaultApi.logout).to.be.calledOnce.calledWithExactly(vaultUrl, token);
                expect(settings.clearToken).to.be.calledOnce;
                expect(MockSnackbar.instance.open).to.not.be.called;
                expect(document.getElementById('status').innerText).to.equal('Not logged in');
            },
            'displays error from Vault': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token});
                vaultApiStub.logout.rejects({message: 'bad request'});
                settingsStub.clearToken.resolves();
                await loadPage();

                document.getElementById('logout').click();

                await nextTick();
                expect(vaultApi.logout).to.be.calledOnce.calledWithExactly(vaultUrl, token);
                expect(settings.clearToken).to.be.calledOnce;
                expect(MockSnackbar.instance.labelText).to.equal('Error revoking token: bad request');
                expect(MockSnackbar.instance.open).to.be.calledOnce;
                expect(document.getElementById('status').innerText).to.equal('Logged in');
            }
        },
        'reload button': {
            'is enabled when URL, username and password have values': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser});
                await loadPage();

                MockTextField.byId.password.triggerChange('passw0rd');

                expect(getInput('reload').disabled).to.be.false;
            },
            'displays message when permission for Vault URL is denied': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser});
                permissionsStub.requestOrigin.resolves(false);
                await loadPage();
                MockTextField.byId.password.triggerChange(password);

                document.getElementById('reload').click();

                await nextTick();
                expect(MockSnackbar.instance.labelText).to.equal(`Need permission to access ${vaultUrl}`);
                expect(MockSnackbar.instance.open).to.be.calledOnce;
            },
            'gets token from Vault when clicked': async () => {
                settingsStub.load.resolves({vaultUrl, vaultPath, vaultUser});
                settingsStub.save.resolves();
                permissionsStub.requestOrigin.resolves(true);
                vaultApiStub.login.resolves({client_token: token, lease_duration: 1800});
                await loadPage();
                settingsStub.cacheUrlPaths.resolves({});
                MockTextField.byId.password.triggerChange(password);

                document.getElementById('reload').click();

                await nextTick();
                expect(vaultApi.login).to.be.calledOnce.calledWithExactly(vaultUrl, vaultUser, password);
                expect(settings.save).to.be.calledOnce.calledWithExactly(vaultUrl, vaultPath, vaultUser, token);
                expect(document.getElementById('status').innerText).to.equal('Logged in');
                expect(MockSnackbar.instance.open).to.not.be.called;
            },
            'displays error from vault': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser});
                permissionsStub.requestOrigin.resolves(true);
                vaultApiStub.login.rejects({message: 'invalid user or password'});
                await loadPage();
                MockTextField.byId.password.triggerChange(password);

                document.getElementById('reload').click();

                await nextTick();
                expect(vaultApi.login).to.be.calledOnce.calledWithExactly(vaultUrl, vaultUser, password);
                expect(settings.save).to.be.not.called;
                expect(document.getElementById('status').innerText).to.equal('Not logged in');
                expect(MockSnackbar.instance.labelText).to.equal('invalid user or password');
                expect(MockSnackbar.instance.open).to.be.calledOnce;
            },
            'displays message for empty response': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser});
                permissionsStub.requestOrigin.resolves(true);
                vaultApiStub.login.resolves();
                await loadPage();
                MockTextField.byId.password.triggerChange(password);

                document.getElementById('reload').click();

                await nextTick();
                expect(vaultApi.login).to.be.calledOnce.calledWithExactly(vaultUrl, vaultUser, password);
                expect(settings.save).to.be.not.called;
                expect(document.getElementById('status').innerText).to.equal('Not logged in');
                expect(MockSnackbar.instance.labelText).to.equal('Did not get a token, please verify the base URL');
                expect(MockSnackbar.instance.open).to.be.calledOnce;
            },
            'displays message for response which does not contain a token': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser});
                permissionsStub.requestOrigin.resolves(true);
                vaultApiStub.login.resolves({});
                await loadPage();
                MockTextField.byId.password.triggerChange(password);

                document.getElementById('reload').click();

                await nextTick();
                expect(vaultApi.login).to.be.calledOnce.calledWithExactly(vaultUrl, vaultUser, password);
                expect(settings.save).to.be.not.called;
                expect(document.getElementById('status').innerText).to.equal('Not logged in');
                expect(MockSnackbar.instance.labelText).to.equal('Did not get a token, please verify the base URL');
                expect(MockSnackbar.instance.open).to.be.calledOnce;
            },
            '@test updates saved URL list': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token});
                settingsStub.cacheUrlPaths.resolves(urlPaths);
                await loadPage();

                document.getElementById('reload').click();

                await nextTick();
                expect(document.getElementById('status').innerText).to.equal('Logged in');
                expect(MockUrlCardList.byId['saved-urls'].removeAll).to.be.calledOnce;
                expect(MockUrlCardList.byId['saved-urls'].addCard).to.be.calledTwice
                    .calledWithExactly('my.bank.com', ['https://my.bank.com'], ["/secret/my-bank"])
                    .calledWithExactly('my.utility.com',
                        ['https://my.utility.com/path1', 'https://my.utility.com/path2'],
                        ["/secret/my-utility/user1", "/secret/my-utility/user2"]);
            },
            'displays message for expired token': async () => {
                permissionsStub.requestOrigin.resolves(true);
                settingsStub.load.resolves({vaultUrl, vaultUser, token});
                settingsStub.cacheUrlPaths.rejects({status: 403});
                await loadPage();

                document.getElementById('reload').click();

                await nextTick();
                expect(document.getElementById('status').innerText).to.equal('Not logged in');
                expect(MockUrlCardList.byId['saved-urls'].removeAll).to.not.be.called;
                expect(MockUrlCardList.byId['saved-urls'].addCard).to.not.be.called;
                expect(MockSnackbar.instance.labelText).to.equal('Need a token');
                expect(MockSnackbar.instance.open).to.be.calledOnce;
            },
            'displays error from Vault': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token});
                settingsStub.cacheUrlPaths.rejects({message: 'bad request'});
                await loadPage();

                document.getElementById('reload').click();

                await nextTick();
                expect(document.getElementById('status').innerText).to.equal('Logged in');
                expect(MockUrlCardList.byId['saved-urls'].removeAll).to.not.be.called;
                expect(MockUrlCardList.byId['saved-urls'].addCard).to.not.be.called;
                expect(MockSnackbar.instance.labelText).to.equal('bad request');
                expect(MockSnackbar.instance.open).to.be.calledOnce;
            }
        },
        'filter input': {
            'filters cards when input is not empty': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token, urlPaths});
                await loadPage();

                MockTextField.byId['vault-filter'].triggerChange('search');

                expect(MockUrlCardList.byId['saved-urls'].filterCards).to.be.calledOnce.calledWithExactly('search');
            },
            'resets cards when input is empty': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token, urlPaths});
                await loadPage();

                MockTextField.byId['vault-filter'].triggerChange('');

                expect(MockUrlCardList.byId['saved-urls'].showAll).to.be.calledOnce.calledWithExactly();
            }
        }
    }
};