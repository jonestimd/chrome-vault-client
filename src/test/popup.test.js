import * as chai from 'chai';
chai.use(require('sinon-chai'));
const {expect} = chai;
import * as sinon from 'sinon';
import {JSDOM} from 'jsdom';
import {MockTextField} from './mock/MockTextField';
import * as settings from '../lib/settings';
import * as vaultApi from '../lib/vaultApi';
import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import * as proxyquire from 'proxyquire';
proxyquire.noCallThru();

const sandbox = sinon.createSandbox();

const html = fs.readFileSync(path.join(__dirname, '../views/popup.html'));

const loadPage = () => {
    global.window = new JSDOM(html).window;
    global.document = window.document;
    return proxyquire('../lib/popup', {
        '@material/ripple/index': {MDCRipple: sandbox.stub()},
        '@material/textfield/index': {MDCTextField: MockTextField}
    });
};

const vaultUrl = 'https://my.vault';
const vaultUser = 'my vault id';
const password = 'passw0rd';
const token = 'vault token';
const pageUrl = 'https://current.page';
const vaultPath = '/secret path/secret name';
const sender = {tab: {id: 'active tab id'}};

const messageCallback = () => chrome.runtime.onMessage.addListener.args[0][0];

const nextTick = promisify(setImmediate);

async function testFillButtonEnabled(field) {
    settings.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [{username: true, path: vaultPath}]}});
    vaultApi.getSecret.resolves({password});
    loadPage();

    await messageCallback()({url: pageUrl, [field]: true});

    const button = document.querySelector('div.buttons button');
    expect(button.disabled).to.be.false;
    expect(button.querySelector('span').innerHTML).to.equal('secret name');
    expect(vaultApi.getSecret).to.be.calledOnce.calledWithExactly(vaultUrl, token, vaultPath);
    expect(document.getElementById('status').innerText).to.equal('');
}

module.exports = {
    'popup': {
        beforeEach() {
            sandbox.stub(settings);
            sandbox.stub(vaultApi);
        },
        afterEach() {
            sandbox.restore();
        },
        'executes content script': () => {
            loadPage();

            expect(chrome.tabs.executeScript).to.be.calledOnce.calledWithExactly({file: 'contentScript.js', allFrames: true});
        },
        'displays Vault username': async () => {
            settings.load.resolves({vaultUser, urlPaths: {[pageUrl]: [{path: vaultPath}]}});
            loadPage();

            await messageCallback()({url: pageUrl});

            expect(document.getElementById('username').innerText).to.equal(vaultUser);
        },
        'messageCallback': {
            'adds button for Vault secret when page has username field': async () => {
                await testFillButtonEnabled('username');
            },
            'adds button for Vault secret when page has password field': async () => {
                await testFillButtonEnabled('password');
            },
            'adds button for Vault secret when page has email field': async () => {
                await testFillButtonEnabled('email');
            },
            'disables button when page contains no fields': async () => {
                settings.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [{username: true, path: vaultPath}]}});
                vaultApi.getSecret.resolves({password});
                loadPage();

                await messageCallback()({url: pageUrl, password: false});

                const button = document.querySelector('div.buttons button');
                expect(button.disabled).to.be.true;
            },
            'disables button when not logged in and password is empty': async () => {
                settings.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [{username: true, path: vaultPath}]}});
                vaultApi.getSecret.rejects({status: 403});
                loadPage();

                await messageCallback()({url: pageUrl, user: true, password: true});

                const button = document.querySelector('div.buttons button');
                expect(button.disabled).to.be.true;
                expect(button.querySelector('span').innerHTML).to.equal('secret name');
                expect(vaultApi.getSecret).to.be.calledOnce.calledWithExactly(vaultUrl, token, vaultPath);
                expect(document.getElementById('status').innerText).to.equal('Invalid token');
            },
            'enables fill buttons when not logged in and password is not empty': async () => {
                settings.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [{username: true, path: vaultPath}]}});
                vaultApi.getSecret.rejects({status: 403});
                loadPage();
                document.getElementById('password').value = password;

                await messageCallback()({url: pageUrl, username: true, password: true});

                expect(document.querySelector('div.buttons button').disabled).to.be.false;
            },
            'displays Vault error': async () => {
                settings.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [{username: true, password: true, path: vaultPath}]}});
                vaultApi.getSecret.rejects({message: 'bad request'});
                vaultApi.getErrorMessage.returns('formatted errors');
                loadPage();

                await messageCallback()({url: pageUrl, username: true, password: true});

                expect(vaultApi.getSecret).to.be.calledOnce.calledWithExactly(vaultUrl, token, vaultPath)
                expect(document.getElementById('status').innerText).to.equal('Error: formatted errors');
                expect(document.querySelector('div.buttons button').disabled).to.be.true;
            },
            'displays message for invalid Vault token': async () => {
                settings.load.resolves({vaultUrl, vaultUser, urlPaths: {[pageUrl]: [{username: true, password: true, path: vaultPath}]}});
                loadPage();

                await messageCallback()({url: pageUrl, username: true, password: true}, sender);

                expect(vaultApi.getSecret).to.not.be.called;
                expect(document.getElementById('status').innerText).to.equal('Need a Vault token');
                expect(document.querySelector('div.buttons button').disabled).to.be.true;
            }
        },
        'fill button': {
            'sends message to fill in user field': async () => {
                const secret = {username: 'site user', password: 'site password', email: 'user@mail.host'};
                settings.load.resolves({vaultUser, token, urlPaths: {[pageUrl]: [{path: vaultPath}]}});
                vaultApi.getSecret.resolves(secret);
                loadPage();
                await messageCallback()({url: pageUrl, username: true, password: true}, sender);

                document.querySelector('div.buttons button').click();

                expect(chrome.tabs.sendMessage).to.be.calledOnce
                    .calledWithExactly(sender.tab.id, secret);
            },
            'gets new Vault token when password is not empty': async () => {
                settings.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [{path: vaultPath}]}});
                vaultApi.getSecret.onCall(0).rejects({status: 403});
                vaultApi.getSecret.onCall(1).resolves({username: 'site user', password: 'site password'});
                vaultApi.login.resolves({client_token: 'new token'});
                loadPage();
                document.getElementById('password').value = password;
                await messageCallback()({url: pageUrl, username: true, password: true}, sender);

                document.querySelector('div.buttons button').click();

                await nextTick();
                expect(vaultApi.getSecret).to.be.calledTwice
                    .calledWithExactly(vaultUrl, token, vaultPath)
                    .calledWithExactly(vaultUrl, 'new token', vaultPath);
                expect(vaultApi.login).to.be.calledOnce.calledWithExactly(vaultUrl, vaultUser, password);
                expect(chrome.tabs.sendMessage).to.be.calledOnce
                    .calledWithExactly(sender.tab.id, {username: 'site user', password: 'site password', email: undefined});
                expect(document.getElementById('status').innerText).to.equal('');
            }
        }
    }
};