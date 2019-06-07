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
import {InputInfoProps} from '../lib/message';
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

let settingsStub: sinon.SinonStubbedInstance<typeof settings>;
let vaultApiStub: {
    getSecret: sinon.SinonStub;
    getErrorMessage: sinon.SinonStub;
    login: sinon.SinonStub;
}

const secretInfo = (path: string, url: string, ...keys: string[]) => ({path, url, keys});

const getInput = (selector: string) => document.querySelector(selector) as HTMLInputElement;
const getButton = (selector: string) => document.querySelector(selector) as HTMLButtonElement;

async function testFillButtonEnabled(field: string) {
    settingsStub.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, field)]}});
    vaultApiStub.getSecret.resolves(new vaultApi.Secret({password}));
    loadPage();

    await messageCallback()({url: pageUrl, inputs: [{name: field}]});

    const button = document.querySelector('div.buttons button') as HTMLButtonElement;
    expect(button.querySelector('span').innerHTML).to.equal('secret name');
    expect(button.disabled).to.be.false;
    expect(vaultApi.getSecret).to.be.calledOnce.calledWithExactly(vaultUrl, token, vaultPath);
    expect(document.getElementById('status').innerText).to.equal('');
}

module.exports = {
    'popup': {
        beforeEach() {
            settingsStub = sandbox.stub(settings);
            vaultApiStub = {
                getSecret: sandbox.stub(vaultApi, 'getSecret'),
                getErrorMessage: sandbox.stub(vaultApi, 'getErrorMessage'),
                login: sandbox.stub(vaultApi, 'login')
            };
        },
        afterEach() {
            sandbox.restore();
        },
        'executes content script': () => {
            loadPage();

            expect(chrome.tabs.executeScript).to.be.calledOnce.calledWithExactly({file: 'contentScript.js', allFrames: true});
        },
        'displays Vault username': async () => {
            settingsStub.load.resolves({vaultUser, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl)]}});
            loadPage();

            await messageCallback()({url: pageUrl, inputs: []});

            expect(document.getElementById('username').innerText).to.equal(vaultUser);
        },
        'displays message for no inputs': async () => {
            settingsStub.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
            vaultApiStub.getSecret.resolves(new vaultApi.Secret({password}));
            loadPage();

            await messageCallback()({url: pageUrl, inputs: []});

            expect(document.getElementById('page-inputs').innerHTML).to.equal('<h3>No inputs found</h3>');
        },
        'page-inputs-switch': {
            'expands page-inputs': async () => {
                const inputs: InputInfoProps[] = [{id: 'customId', label: 'Custom Label', type: 'text'}];
                settingsStub.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
                vaultApiStub.getSecret.resolves(new vaultApi.Secret({password}));
                loadPage();
                await messageCallback()({url: pageUrl, inputs});
                const pageInputs = document.getElementById('page-inputs');
                const heightStub = sinon.stub(pageInputs, 'clientHeight');
                heightStub.get(() => 123);

                document.getElementById('page-inputs-switch').click();
                expect(document.querySelector('#page-inputs-switch i').innerHTML).to.equal('arrow_drop_down');
                expect(pageInputs.parentElement.style.height).to.equal('123px');
            }
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
            'adds page inputs': async () => {
                const inputs: InputInfoProps[] = [{id: 'customId', label: 'Custom Label', type: 'text', name: 'Custom name', placeholder: 'Custom placeholder'}];
                settingsStub.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'custom')]}});
                vaultApiStub.getSecret.resolves(new vaultApi.Secret({password}));
                loadPage();

                await messageCallback()({url: pageUrl, inputs});

                const pageInputs = document.getElementById('page-inputs');
                expect(pageInputs.childNodes).to.have.length(1);
                expect(pageInputs.children[0].innerHTML).to.equal(
                    `<div class="row"><span class="label">type</span><span>${inputs[0].type}</span></div>` +
                    `<div class="row"><span class="label">id</span><span>${inputs[0].id}</span></div>` +
                    `<div class="row"><span class="label">name</span><span>${inputs[0].name}</span></div>` +
                    `<div class="row"><span class="label">label</span><span>${inputs[0].label}</span></div>` +
                    `<div class="row"><span class="label">placeholder</span><span>${inputs[0].placeholder}</span></div>`);
                expect(document.querySelector('#page-inputs-switch i').innerHTML).to.equal('arrow_right');
                expect(pageInputs.parentElement.style.height).to.equal('0px');
            },
            'disables button when page contains no fields': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
                vaultApiStub.getSecret.resolves(new vaultApi.Secret({password}));
                loadPage();

                await messageCallback()({url: pageUrl, inputs: []});

                const button = document.querySelector('div.buttons button') as HTMLButtonElement;
                expect(button.disabled).to.be.true;
            },
            'disables button when not logged in and password is empty': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
                vaultApiStub.getSecret.rejects({status: 403});
                loadPage();

                await messageCallback()({url: pageUrl, inputs: [{id: 'username'}]});

                const button = document.querySelector('div.buttons button') as HTMLButtonElement;
                expect(button.disabled).to.be.true;
                expect(button.querySelector('span').innerHTML).to.equal('secret name');
                expect(vaultApi.getSecret).to.be.calledOnce.calledWithExactly(vaultUrl, token, vaultPath);
                expect(document.getElementById('status').innerText).to.equal('Invalid token');
            },
            'enables fill buttons when not logged in and password is not empty': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
                vaultApiStub.getSecret.rejects({status: 403});
                loadPage();
                getInput('#password').value = password;

                await messageCallback()({url: pageUrl, inputs: [{id: 'username'}, {type: 'password'}]});

                expect(getButton('div.buttons button').disabled).to.be.false;
            },
            'displays Vault error': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username', 'password')]}});
                vaultApiStub.getSecret.rejects({message: 'bad request'});
                vaultApiStub.getErrorMessage.returns('formatted errors');
                loadPage();

                await messageCallback()({url: pageUrl, inputs: [{id: 'username'}, {type: 'password'}]});

                expect(vaultApi.getSecret).to.be.calledOnce.calledWithExactly(vaultUrl, token, vaultPath)
                expect(document.getElementById('status').innerText).to.equal('Error: formatted errors');
                expect(getButton('div.buttons button').disabled).to.be.true;
            },
            'displays message for invalid Vault token': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username', 'password')]}});
                loadPage();

                await messageCallback()({url: pageUrl, inputs: [{id: 'username'}]}, sender);

                expect(vaultApi.getSecret).to.not.be.called;
                expect(document.getElementById('status').innerText).to.equal('Need a Vault token');
                expect(getButton('div.buttons button').disabled).to.be.true;
            }
        },
        'fill button': {
            'sends message to fill fields matching name or label': async () => {
                const secretData = {username: 'site user', password: 'site password', email: 'user@mail.host'};
                const secret = new vaultApi.Secret(secretData);
                settingsStub.load.resolves({vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username')]}});
                vaultApiStub.getSecret.resolves(secret);
                loadPage();
                await messageCallback()({url: pageUrl, inputs: [{name: 'username'}, {label: 'password', type: 'password'}]}, sender);

                getButton('div.buttons button').click();

                expect(chrome.tabs.sendMessage).to.be.calledOnce
                    .calledWithExactly(sender.tab.id, [
                        {selector: 'input[name="username"]', value: secretData.username},
                        {label: 'password', value: secretData.password}
                    ]);
            },
            'gets new Vault token when password is not empty': async () => {
                settingsStub.load.resolves({vaultUrl, vaultUser, token, urlPaths: {[pageUrl]: [secretInfo(vaultPath, pageUrl, 'username', 'password')]}});
                vaultApiStub.getSecret.onCall(0).rejects({status: 403});
                vaultApiStub.getSecret.onCall(1).resolves(new vaultApi.Secret({username: 'site user', password: 'site password'}));
                vaultApiStub.login.resolves({client_token: 'new token'});
                loadPage();
                getInput('#password').value = password;
                await messageCallback()({url: pageUrl, inputs: [{id: 'username'}, {type: 'password'}]}, sender);

                getButton('div.buttons button').click();

                await nextTick();
                expect(vaultApi.getSecret).to.be.calledTwice
                    .calledWithExactly(vaultUrl, token, vaultPath)
                    .calledWithExactly(vaultUrl, 'new token', vaultPath);
                expect(vaultApi.login).to.be.calledOnce.calledWithExactly(vaultUrl, vaultUser, password);
                expect(chrome.tabs.sendMessage).to.be.calledOnce
                    .calledWithExactly(sender.tab.id, [
                        {selector: 'input[id="username"]', value: 'site user'},
                        {selector: 'input[type="password"]', value: 'site password'}]);
                expect(document.getElementById('status').innerText).to.equal('');
            }
        }
    }
};