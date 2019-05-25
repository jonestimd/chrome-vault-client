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
import {MockTextField} from './mock/MockTextField';
import {MockUrlCardList} from './mock/MockUrlCardList';
import {MockSnackbar} from './mock/MockSnackbar';
import * as proxyquire from 'proxyquire';
proxyquire.noCallThru();

const html = fs.readFileSync(path.join(__dirname, '../views/options.html'));

const sandbox = sinon.createSandbox();

const vaultUrl = 'https://my.vault';
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

const loadPage = () => {
    global.window = new JSDOM(html).window;
    global.document = window.document;
    return proxyquire('../lib/options', {
        '@material/ripple/index': {MDCRipple: sandbox.stub()},
        '@material/textfield/index': {MDCTextField: MockTextField},
        '@material/snackbar': {MDCSnackbar: MockSnackbar},
        './components/UrlCardList': {default: MockUrlCardList}
    });
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
        'displays saved URL and username': (done: Mocha.Done) => {
            settingsStub.load.resolves({vaultUrl, vaultUser, token});

            loadPage();

            setImmediate(() => {
                expect(getInput('vault-url').value).to.equal(vaultUrl);
                expect(getInput('username').value).to.equal(vaultUser);
                expect(document.getElementById('status').innerText).to.equal('Logged in');
                expect(MockUrlCardList.byId['saved-urls'].removeAll).to.not.be.called;
                expect(MockUrlCardList.byId['saved-urls'].addCard).to.not.be.called;
                expect(MockTextField.byId.password.required).to.not.be.true;
                expect(getInput('login').disabled).to.be.true;
                done();
            });
        },
        'moves focus to password when URL and username are in settings': (done: Mocha.Done) => {
            settingsStub.load.resolves({vaultUrl, vaultUser});

            loadPage();

            setImmediate(() => {
                expect(MockTextField.byId.username.focus).to.be.calledOnce;
                expect(MockTextField.byId.password.focus).to.be.calledOnce;
                done();
            });
        },
        'marks URL, username and password invalid when settings are empty': (done: Mocha.Done) => {
            settingsStub.load.resolves({});

            loadPage();

            setImmediate(() => {
                expect(MockTextField.byId['vault-url'].getDefaultFoundation().setValid)
                    .to.be.calledOnce.calledWithExactly(false);
                expect(MockTextField.byId.username.getDefaultFoundation().setValid)
                    .to.be.calledOnce.calledWithExactly(false);
                expect(MockTextField.byId.password.getDefaultFoundation().setValid)
                    .to.be.calledOnce.calledWithExactly(false);
                expect(MockTextField.byId.password.required).to.be.true;
                done();
            });
        },
        'displays saved URLs': (done: Mocha.Done) => {
            settingsStub.load.resolves({urlPaths});

            loadPage();

            setImmediate(() => {
                expect(MockUrlCardList.byId['saved-urls'].removeAll).to.be.calledOnce;
                expect(MockUrlCardList.byId['saved-urls'].addCard).to.be.calledTwice
                    .calledWithExactly('my.bank.com', ['https://my.bank.com'], ['/secret/my-bank'])
                    .calledWithExactly('my.utility.com',
                        ['https://my.utility.com/path1', 'https://my.utility.com/path2'],
                        ["/secret/my-utility/user1", "/secret/my-utility/user2"]);
                done();
            });
        },
        'login button': {
            'is enabled when URL, username and password have values': (done: Mocha.Done) => {
                settingsStub.load.resolves({vaultUrl, vaultUser});
                loadPage();

                MockTextField.byId.password.value = 'passw0rd';

                setImmediate(() => {
                    expect(getInput('login').disabled).to.be.false;
                    done();
                });
            },
            'displays message when permission for Vault URL is denied': (done: Mocha.Done) => {
                settingsStub.load.resolves({vaultUrl, vaultUser});
                permissionsStub.requestOrigin.resolves(false);
                loadPage();
                MockTextField.byId.password.value = password;

                document.getElementById('login').click();

                setImmediate(() => {
                    expect(MockSnackbar.instance.labelText).to.equal(`Need permission to access ${vaultUrl}`);
                    expect(MockSnackbar.instance.open).to.be.calledOnce;
                    done();
                });
            },
            'gets token from Vault when clicked': (done: Mocha.Done) => {
                settingsStub.load.resolves({vaultUrl, vaultUser});
                settingsStub.save.resolves();
                permissionsStub.requestOrigin.resolves(true);
                vaultApiStub.login.resolves({client_token: token, lease_duration: 1800});
                loadPage();
                MockTextField.byId.password.value = password;

                document.getElementById('login').click();

                setImmediate(() => {
                    expect(vaultApi.login).to.be.calledOnce.calledWithExactly(vaultUrl, vaultUser, password);
                    expect(settings.save).to.be.calledOnce.calledWithExactly(vaultUrl, vaultUser, token);
                    expect(document.getElementById('status').innerText).to.equal('Logged in');
                    expect(MockSnackbar.instance.open).to.not.be.called;
                    done();
                });
            },
            'displays error from vault': (done: Mocha.Done) => {
                settingsStub.load.resolves({vaultUrl, vaultUser});
                permissionsStub.requestOrigin.resolves(true);
                vaultApiStub.login.rejects({message: 'invalid user or password'});
                loadPage();
                MockTextField.byId.password.value = password;

                document.getElementById('login').click();

                setImmediate(() => {
                    expect(vaultApi.login).to.be.calledOnce.calledWithExactly(vaultUrl, vaultUser, password);
                    expect(settings.save).to.be.not.called;
                    expect(document.getElementById('status').innerText).to.equal('Not logged in');
                    expect(MockSnackbar.instance.labelText).to.equal('Error getting token: invalid user or password');
                    expect(MockSnackbar.instance.open).to.be.calledOnce;
                    done();
                });
            },
            'displays message for empty response': (done: Mocha.Done) => {
                settingsStub.load.resolves({vaultUrl, vaultUser});
                permissionsStub.requestOrigin.resolves(true);
                vaultApiStub.login.resolves();
                loadPage();
                MockTextField.byId.password.value = password;

                document.getElementById('login').click();

                setImmediate(() => {
                    expect(vaultApi.login).to.be.calledOnce.calledWithExactly(vaultUrl, vaultUser, password);
                    expect(settings.save).to.be.not.called;
                    expect(document.getElementById('status').innerText).to.equal('Not logged in');
                    expect(MockSnackbar.instance.labelText).to.equal('Did not get a token, please verify the base URL');
                    expect(MockSnackbar.instance.open).to.be.calledOnce;
                    done();
                });
            },
            'displays message for response which does not contain a token': (done: Mocha.Done) => {
                settingsStub.load.resolves({vaultUrl, vaultUser});
                permissionsStub.requestOrigin.resolves(true);
                vaultApiStub.login.resolves({});
                loadPage();
                MockTextField.byId.password.value = password;

                document.getElementById('login').click();

                setImmediate(() => {
                    expect(vaultApi.login).to.be.calledOnce.calledWithExactly(vaultUrl, vaultUser, password);
                    expect(settings.save).to.be.not.called;
                    expect(document.getElementById('status').innerText).to.equal('Not logged in');
                    expect(MockSnackbar.instance.labelText).to.equal('Did not get a token, please verify the base URL');
                    expect(MockSnackbar.instance.open).to.be.calledOnce;
                    done();
                });
            }
        },
        'logout button': {
            'revokes vault token': (done: Mocha.Done) => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token});
                vaultApiStub.logout.resolves();
                settingsStub.clearToken.resolves();
                loadPage();
                setImmediate(() => {

                    document.getElementById('logout').click();

                    setImmediate(() => {
                        expect(vaultApi.logout).to.be.calledOnce.calledWithExactly(vaultUrl, token);
                        expect(settings.clearToken).to.be.calledOnce;
                        expect(document.getElementById('status').innerText).to.equal('Not logged in');
                        done();
                    });
                });
            },
            'clears token when vault returns 403': (done: Mocha.Done) => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token});
                vaultApiStub.logout.rejects({status: 403});
                settingsStub.clearToken.resolves();
                loadPage();
                setImmediate(() => {

                    document.getElementById('logout').click();

                    setImmediate(() => {
                        expect(vaultApi.logout).to.be.calledOnce.calledWithExactly(vaultUrl, token);
                        expect(settings.clearToken).to.be.calledOnce;
                        expect(MockSnackbar.instance.open).to.not.be.called;
                        expect(document.getElementById('status').innerText).to.equal('Not logged in');
                        done();
                    });
                });
            },
            'displays error from Vault': (done: Mocha.Done) => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token});
                vaultApiStub.logout.rejects({message: 'bad request'});
                settingsStub.clearToken.resolves();
                loadPage();
                setImmediate(() => {

                    document.getElementById('logout').click();

                    setImmediate(() => {
                        expect(vaultApi.logout).to.be.calledOnce.calledWithExactly(vaultUrl, token);
                        expect(settings.clearToken).to.be.calledOnce;
                        expect(MockSnackbar.instance.labelText).to.equal('Error revoking token: bad request');
                        expect(MockSnackbar.instance.open).to.be.calledOnce;
                        expect(document.getElementById('status').innerText).to.equal('Logged in');
                        done();
                    });
                });
            }
        },
        'reload button': {
            'updates saved URL list': (done: Mocha.Done) => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token});
                settingsStub.cacheUrlPaths.resolves(urlPaths);
                loadPage();

                document.getElementById('reload').click();

                setImmediate(() => {
                    expect(document.getElementById('status').innerText).to.equal('Logged in');
                    expect(MockUrlCardList.byId['saved-urls'].removeAll).to.be.calledOnce;
                    expect(MockUrlCardList.byId['saved-urls'].addCard).to.be.calledTwice
                        .calledWithExactly('my.bank.com', ['https://my.bank.com'], ["/secret/my-bank"])
                        .calledWithExactly('my.utility.com',
                            ['https://my.utility.com/path1', 'https://my.utility.com/path2'],
                            ["/secret/my-utility/user1", "/secret/my-utility/user2"]);
                    done();
                });
            },
            'displays message for expired token': (done: Mocha.Done) => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token});
                settingsStub.cacheUrlPaths.rejects({status: 403});
                loadPage();

                document.getElementById('reload').click();

                setImmediate(() => {
                    expect(document.getElementById('status').innerText).to.equal('Not logged in');
                    expect(MockUrlCardList.byId['saved-urls'].removeAll).to.not.be.called;
                    expect(MockUrlCardList.byId['saved-urls'].addCard).to.not.be.called;
                    expect(MockSnackbar.instance.labelText).to.equal('Need a token');
                    expect(MockSnackbar.instance.open).to.be.calledOnce;
                    done();
                });
            },
            'displays error from Vault': (done: Mocha.Done) => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token});
                settingsStub.cacheUrlPaths.rejects({message: 'bad request'});
                loadPage();

                document.getElementById('reload').click();

                setImmediate(() => {
                    expect(document.getElementById('status').innerText).to.equal('Logged in');
                    expect(MockUrlCardList.byId['saved-urls'].removeAll).to.not.be.called;
                    expect(MockUrlCardList.byId['saved-urls'].addCard).to.not.be.called;
                    expect(MockSnackbar.instance.labelText).to.equal('bad request');
                    expect(MockSnackbar.instance.open).to.be.calledOnce;
                    done();
                });
            }
        },
        'filter input': {
            'filters cards when input is not empty': () => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token, urlPaths});
                loadPage();
                MockTextField.byId['vault-filter'].value = 'search';

                MockTextField.byId['vault-filter'].listen.args[0][1]();

                expect(MockUrlCardList.byId['saved-urls'].filterCards).to.be.calledOnce.calledWithExactly('search');
            },
            'resets cards when input is empty': () => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token, urlPaths});
                loadPage();
                MockTextField.byId['vault-filter'].value = '';

                MockTextField.byId['vault-filter'].listen.args[0][1]();

                expect(MockUrlCardList.byId['saved-urls'].showAll).to.be.calledOnce.calledWithExactly();
            }
        }
    }
};