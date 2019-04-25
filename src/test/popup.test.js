import chai, {expect} from 'chai';
chai.use(require('sinon-chai'));
import sinon from 'sinon';
import {JSDOM} from 'jsdom';
import {MockTextField} from './mock/MockTextField';
import * as settings from '../lib/settings';
import * as vaultApi from '../lib/vaultApi';
import fs from 'fs';
import path from 'path';
import proxyquire from 'proxyquire';
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
const vaultPath = '/secret/path';
const sender = {tab: {id: 'active tab id'}};

const messageCallback = () => chrome.runtime.onMessage.addListener.args[0][0];

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

            expect(chrome.tabs.executeScript).to.be.calledOnce.calledWithExactly({file: 'contentScript.js'});
        },
        'displays Vault username': async () => {
            settings.load.resolves({vaultUser, urlPaths: {[pageUrl]: {}}});
            loadPage();

            await messageCallback()({url: pageUrl});

            expect(document.getElementById('username').innerText).to.equal(vaultUser);
        },
        'messageCallback': {
            'enables fill user button when page and Vault secret include username': async () => {
                settings.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: {username: true, path: vaultPath}}});
                loadPage();

                await messageCallback()({url: pageUrl, username: true});

                expect(document.getElementById('fill-user').disabled).to.be.false;
                expect(document.getElementById('fill-password').disabled).to.be.true;
                expect(document.getElementById('fill-both').disabled).to.be.true;
            },
            'enables fill password button when page and Vault secret includes password': async () => {
                settings.load.resolves({vaultUser, token, urlPaths: {[pageUrl]: {password: true}}});
                loadPage();

                await messageCallback()({url: pageUrl, password: true});

                expect(document.getElementById('fill-user').disabled).to.be.true;
                expect(document.getElementById('fill-password').disabled).to.be.false;
                expect(document.getElementById('fill-both').disabled).to.be.true;
            },
            'enables fill both button when page and Vault secret includes username and password': async () => {
                settings.load.resolves({vaultUser, token, urlPaths: {[pageUrl]: {username: true, password: true}}});
                loadPage();

                await messageCallback()({url: pageUrl, username: true, password: true});

                expect(document.getElementById('fill-user').disabled).to.be.false;
                expect(document.getElementById('fill-password').disabled).to.be.false;
                expect(document.getElementById('fill-both').disabled).to.be.false;
            },
            'disables fill buttons when not logged in and password is empty': async () => {
                settings.load.resolves({vaultUser, urlPaths: {[pageUrl]: {username: true, password: true}}});
                loadPage();

                await messageCallback()({url: pageUrl, user: true, password: true});

                expect(document.getElementById('fill-user').disabled).to.be.true;
                expect(document.getElementById('fill-password').disabled).to.be.true;
                expect(document.getElementById('fill-both').disabled).to.be.true;
            },
            'enables fill buttons when not logged in and password is not empty': async () => {
                settings.load.resolves({vaultUser, urlPaths: {[pageUrl]: {username: true, password: true}}});
                loadPage();
                document.getElementById('password').value = password;

                await messageCallback()({url: pageUrl, username: true, password: true});

                expect(document.getElementById('fill-user').disabled).to.be.false;
                expect(document.getElementById('fill-password').disabled).to.be.false;
                expect(document.getElementById('fill-both').disabled).to.be.false;
            },
            'gets secret from Vault when page includes username': async () => {
                settings.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: {path: vaultPath}}});
                vaultApi.getSecret.resolves({});
                loadPage();

                await messageCallback()({url: pageUrl, username: true});

                expect(vaultApi.getSecret).to.be.calledOnce.calledWithExactly(vaultUrl, token, vaultPath)
            },
            'displays Vault error': async () => {
                settings.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: {username: true, password: true, path: vaultPath}}});
                vaultApi.getSecret.rejects({message: 'bad request'});
                vaultApi.getErrorMessage.returns('formatted errors');
                loadPage();

                await messageCallback()({url: pageUrl, username: true, password: true});

                expect(vaultApi.getSecret).to.be.calledOnce.calledWithExactly(vaultUrl, token, vaultPath)
                expect(document.getElementById('status').innerText).to.equal('Error: formatted errors');
                expect(document.getElementById('fill-user').disabled).to.be.false;
                expect(document.getElementById('fill-password').disabled).to.be.false;
                expect(document.getElementById('fill-both').disabled).to.be.false;
            },
            'displays message for invalid Vault token': async () => {
                settings.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: {username: true, password: true, path: vaultPath}}});
                vaultApi.getSecret.rejects({status: 403});
                loadPage();

                await messageCallback()({url: pageUrl, username: true, password: true}, sender);

                expect(vaultApi.getSecret).to.be.calledOnce.calledWithExactly(vaultUrl, token, vaultPath)
                expect(document.getElementById('status').innerText).to.equal('Need a Vault token');
                expect(document.getElementById('fill-user').disabled).to.be.true;
                expect(document.getElementById('fill-password').disabled).to.be.true;
                expect(document.getElementById('fill-both').disabled).to.be.true;
            }
        },
        'fill user button': {
            'sends message to fill in user field': async () => {
                settings.load.resolves({vaultUser, token, urlPaths: {[pageUrl]: {username: true, password: true}}});
                vaultApi.getSecret.resolves({username: 'site user', password: 'site password'});
                loadPage();
                await messageCallback()({url: pageUrl, username: true, password: true}, sender);

                document.getElementById('fill-user').click();

                expect(chrome.tabs.sendMessage).to.be.calledOnce.calledWithExactly(sender.tab.id, {username: 'site user'});
            },
            'gets new Vault token when password is not empty': async () => {
                settings.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: {username: true, password: true, path: vaultPath}}});
                vaultApi.getSecret.onCall(0).rejects({status: 403});
                vaultApi.getSecret.onCall(1).resolves({username: 'site user', password: 'site password'});
                vaultApi.login.resolves({client_token: 'new token'});
                loadPage();
                document.getElementById('password').value = password;
                await messageCallback()({url: pageUrl, username: true, password: true}, sender);

                document.getElementById('fill-user').click();

                expect(vaultApi.getSecret).to.be.calledTwice
                    .calledWithExactly(vaultUrl, token, vaultPath)
                    .calledWithExactly(vaultUrl, 'new token', vaultPath);
                expect(vaultApi.login).to.be.calledOnce.calledWithExactly(vaultUrl, vaultUser, password);
                expect(chrome.tabs.sendMessage).to.be.calledOnce.calledWithExactly(sender.tab.id, {username: 'site user'});
                expect(document.getElementById('status').innerText).to.equal('');
            }
        },
        'fill password button': {
            'sends message to fill in password field': async () => {
                settings.load.resolves({vaultUser, token, urlPaths: {[pageUrl]: {username: true, password: true}}});
                vaultApi.getSecret.resolves({username: 'site user', password: 'site password'});
                loadPage();
                await messageCallback()({url: pageUrl, username: true, password: true}, sender);

                document.getElementById('fill-password').click();

                expect(chrome.tabs.sendMessage).to.be.calledOnce.calledWithExactly(sender.tab.id, {password: 'site password'});
            }
        },
        'fill both button': {
            'sends message to fill in user and password fields': async () => {
                settings.load.resolves({vaultUser, token, urlPaths: {[pageUrl]: {username: true, password: true}}});
                vaultApi.getSecret.resolves({username: 'site user', password: 'site password'});
                loadPage();
                await messageCallback()({url: pageUrl, username: true, password: true}, sender);

                document.getElementById('fill-both').click();

                expect(chrome.tabs.sendMessage).to.be.calledOnce.calledWithExactly(sender.tab.id, {username: 'site user', password: 'site password'});
            }
        }
    }
};