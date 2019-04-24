import chai, {expect} from 'chai';
chai.use(require('sinon-chai'));
import sinon from 'sinon';
import {JSDOM} from 'jsdom';
import * as settings from '../lib/settings';
import * as permissions from '../lib/permissions';
import * as vaultApi from '../lib/vaultApi';
import fs from 'fs';
import path from 'path';
import {MockTextField} from './mock/MockTextField';
import {MockList} from './mock/MockList';
import {MockSnackbar} from './mock/MockSnackbar';
import proxyquire from 'proxyquire';
proxyquire.noCallThru();

const html = fs.readFileSync(path.join(__dirname, '../views/options.html'));

const sandbox = sinon.createSandbox();

const vaultUrl = 'https://my.vault';
const vaultUser = 'my vault id';
const password = 'passw0rd';
const token = 'vault token';

const urlPaths = {
    'https://my.bank.com': {path: '/secret/my-bank', username: true, password: true},
    'https://my.utility.com': {path: '/secret/my-utility'},
};

const loadPage = () => {
    global.window = new JSDOM(html).window;
    global.document = window.document;
    return proxyquire('../lib/options', {
        '@material/ripple/index': {MDCRipple: sandbox.stub()},
        '@material/textfield/index': {MDCTextField: MockTextField},
        '@material/snackbar': {MDCSnackbar: MockSnackbar},
        './components/List': MockList
    });
};

module.exports = {
    'options': {
        beforeEach() {
            sandbox.stub(settings);
            sandbox.stub(permissions);
            sandbox.stub(vaultApi);
        },
        afterEach() {
            sandbox.restore();
        },
        'displays saved URL and username': (done) => {
            settings.load.resolves({vaultUrl, vaultUser, token});

            loadPage();

            setImmediate(() => {
                expect(document.getElementById('vault-url').value).to.equal(vaultUrl);
                expect(document.getElementById('username').value).to.equal(vaultUser);
                expect(document.getElementById('status').innerText).to.equal('Logged in');
                expect(MockList.byId['saved-urls'].removeAll).to.not.be.called;
                expect(MockList.byId['saved-urls'].addItem).to.not.be.called;
                expect(MockTextField.byId.password.required).to.not.be.true;
                expect(document.getElementById('login').disabled).to.be.true;
                done();
            });
        },
        'moves focus to password when URL and username are in settings': (done) => {
            settings.load.resolves({vaultUrl, vaultUser});

            loadPage();

            setImmediate(() => {
                expect(MockTextField.byId.username.focus).to.be.calledOnce;
                expect(MockTextField.byId.password.focus).to.be.calledOnce;
                done();
            });
        },
        'marks URL, username and password invalid when settings are empty': (done) => {
            settings.load.resolves({});

            loadPage();

            setImmediate(() => {
                expect(MockTextField.byId['vault-url'].getDefaultFoundation().adapter_.addClass)
                    .to.be.calledOnce.calledWithExactly('mdc-text-field--invalid');
                expect(MockTextField.byId.username.getDefaultFoundation().adapter_.addClass)
                    .to.be.calledOnce.calledWithExactly('mdc-text-field--invalid');
                expect(MockTextField.byId.password.getDefaultFoundation().adapter_.addClass)
                    .to.be.calledOnce.calledWithExactly('mdc-text-field--invalid');
                expect(MockTextField.byId.password.required).to.be.true;
                done();
            });
        },
        'displays saved URLs': (done) => {
            settings.load.resolves({urlPaths});

            loadPage();

            setImmediate(() => {
                expect(MockList.byId['saved-urls'].removeAll).to.be.calledOnce;
                expect(MockList.byId['saved-urls'].addItem).to.be.calledTwice
                    .calledWithExactly('https://my.bank.com', 'account_circle')
                    .calledWithExactly('https://my.utility.com', undefined);
                done();
            });
        },
        'login button': {
            'is enabled when URL, username and password have values': (done) => {
                settings.load.resolves({vaultUrl, vaultUser});
                loadPage();

                MockTextField.byId.password.value = 'passw0rd';

                setImmediate(() => {
                    expect(document.getElementById('login').disabled).to.be.false;
                    done();
                });
            },
            'displays message when permission for Vault URL is denied': (done) => {
                settings.load.resolves({vaultUrl, vaultUser});
                permissions.requestOrigin.resolves(false);
                loadPage();
                MockTextField.byId.password.value = password;

                document.getElementById('login').click();

                setImmediate(() => {
                    expect(MockSnackbar.instance.labelText).to.equal(`Need permission to access ${vaultUrl}`);
                    expect(MockSnackbar.instance.open).to.be.calledOnce;
                    done();
                });
            },
            'gets token from Vault when clicked': (done) => {
                settings.load.resolves({vaultUrl, vaultUser});
                settings.save.resolves();
                permissions.requestOrigin.resolves(true);
                vaultApi.login.resolves({client_token: token, lease_duration: 1800});
                loadPage();
                MockTextField.byId.password.value = password;

                document.getElementById('login').click();

                setImmediate(() => {
                    expect(vaultApi.login).to.be.calledOnce.calledWithExactly(vaultUrl, vaultUser, password);
                    expect(settings.save).to.be.calledOnce.calledWithExactly(vaultUrl, vaultUser, token, 1800);
                    expect(document.getElementById('status').innerText).to.equal('Logged in');
                    expect(MockSnackbar.instance.open).to.not.be.called;
                    done();
                });
            },
            'displays error from vault': (done) => {
                settings.load.resolves({vaultUrl, vaultUser});
                permissions.requestOrigin.resolves(true);
                vaultApi.login.rejects({message: 'invalid user or password'});
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
            'displays message for empty response': (done) => {
                settings.load.resolves({vaultUrl, vaultUser});
                permissions.requestOrigin.resolves(true);
                vaultApi.login.resolves();
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
            'displays message for response which does not contain a token': (done) => {
                settings.load.resolves({vaultUrl, vaultUser});
                permissions.requestOrigin.resolves(true);
                vaultApi.login.resolves({});
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
            'revokes vault token': (done) => {
                settings.load.resolves({vaultUrl, vaultUser, token});
                vaultApi.logout.resolves();
                settings.clearToken.resolves();
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
            'clears token when vault returns 403': (done) => {
                settings.load.resolves({vaultUrl, vaultUser, token});
                vaultApi.logout.rejects({status: 403});
                settings.clearToken.resolves();
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
            'displays error from Vault': (done) => {
                settings.load.resolves({vaultUrl, vaultUser, token});
                vaultApi.logout.rejects({message: 'bad request'});
                settings.clearToken.resolves();
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
            'updates saved URL list': (done) => {
                settings.load.resolves({vaultUrl, vaultUser, token});
                settings.cacheUrlPaths.resolves(urlPaths);
                loadPage();

                document.getElementById('reload').click();

                setImmediate(() => {
                    expect(document.getElementById('status').innerText).to.equal('Logged in');
                    expect(MockList.byId['saved-urls'].removeAll).to.be.calledOnce;
                    expect(MockList.byId['saved-urls'].addItem).to.be.calledTwice
                        .calledWithExactly('https://my.bank.com', 'account_circle')
                        .calledWithExactly('https://my.utility.com', undefined);
                    done();
                });
            },
            'displays message for expired token': (done) => {
                settings.load.resolves({vaultUrl, vaultUser, token});
                settings.cacheUrlPaths.rejects({status: 403});
                loadPage();

                document.getElementById('reload').click();

                setImmediate(() => {
                    expect(document.getElementById('status').innerText).to.equal('Not logged in');
                    expect(MockList.byId['saved-urls'].removeAll).to.not.be.called;
                    expect(MockList.byId['saved-urls'].addItem).to.not.be.called;
                    expect(MockSnackbar.instance.labelText).to.equal('Need a token');
                    expect(MockSnackbar.instance.open).to.be.calledOnce;
                    done();
                });
            },
            'displays error from Vault': (done) => {
                settings.load.resolves({vaultUrl, vaultUser, token});
                settings.cacheUrlPaths.rejects({message: 'bad request'});
                loadPage();

                document.getElementById('reload').click();

                setImmediate(() => {
                    expect(document.getElementById('status').innerText).to.equal('Logged in');
                    expect(MockList.byId['saved-urls'].removeAll).to.not.be.called;
                    expect(MockList.byId['saved-urls'].addItem).to.not.be.called;
                    expect(MockSnackbar.instance.labelText).to.equal('bad request');
                    expect(MockSnackbar.instance.open).to.be.calledOnce;
                    done();
                });
            }
        }
    }
};