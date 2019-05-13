import * as chai from 'chai';
chai.use(require('sinon-chai'));
const {expect} = chai;
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

let settings, vaultApi;

const vaultUrl = 'https://my.vault';
const token = 'the token';

const getInstalledListener = () => chrome.runtime.onInstalled.addListener.args[0][0];
const getStorageListener = () => chrome.storage.onChanged.addListener.args[0][0];
const getAlarmListener = () => chrome.alarms.onAlarm.addListener.args[0][0];

module.exports = {
    'background': {
        beforeEach() {
            settings = {
                load: sinon.stub(),
                clearToken: sinon.stub(),
                cacheUrlPaths: sinon.stub()
            };
            vaultApi = {
                refreshToken: sinon.stub()
            };
            proxyquire('../lib/background', {
                './settings': settings,
                './vaultApi': vaultApi
            })
        },
        'onInstalled': {
            'handles error from Vault': async () => {
                settings.cacheUrlPaths.rejects({message: 'not logged in'});

                await getInstalledListener()();

                expect(settings.cacheUrlPaths).to.be.calledOnce;
                expect(chrome.declarativeContent.onPageChanged.removeRules).to.not.be.called;
                expect(chrome.declarativeContent.onPageChanged.addRules).to.not.be.called;
            },
            'clears page rules if no cached URLs': async () => {
                settings.cacheUrlPaths.resolves();

                await getInstalledListener()();

                expect(chrome.declarativeContent.onPageChanged.removeRules).to.be.calledOnce;
                expect(chrome.declarativeContent.onPageChanged.addRules).to.not.be.calledOnce;
            },
            'adds page rule for hostname': async () => {
                const action = {name: 'show page'};
                const matcher = {name: 'url matcher'};
                settings.cacheUrlPaths.resolves({'some.site.com': [{}]});
                chrome.declarativeContent.ShowPageAction.returns(action);
                chrome.declarativeContent.PageStateMatcher.returns(matcher);

                await getInstalledListener()();

                expect(chrome.declarativeContent.onPageChanged.removeRules).to.be.calledOnce;
                expect(chrome.declarativeContent.PageStateMatcher).to.be.calledOnce
                    .calledWithExactly({pageUrl: {hostEquals: 'some.site.com', schemes: ['https']}});
                expect(chrome.declarativeContent.ShowPageAction).to.be.calledOnce;
                expect(chrome.declarativeContent.onPageChanged.addRules).to.be.calledOnce
                    .calledWithExactly([{conditions: [matcher], actions: [action]}]);
            },
            'adds page rule for scheme and hostname': async () => {
                const action = {name: 'show page'};
                const matcher = {name: 'url matcher'};
                settings.cacheUrlPaths.resolves({'http://some.site.com': [{}]});
                chrome.declarativeContent.ShowPageAction.returns(action);
                chrome.declarativeContent.PageStateMatcher.returns(matcher);

                await getInstalledListener()();

                expect(chrome.declarativeContent.onPageChanged.removeRules).to.be.calledOnce;
                expect(chrome.declarativeContent.PageStateMatcher).to.be.calledOnce
                    .calledWithExactly({pageUrl: {hostEquals: 'some.site.com', schemes: ['http']}});
                expect(chrome.declarativeContent.ShowPageAction).to.be.calledOnce;
                expect(chrome.declarativeContent.onPageChanged.addRules).to.be.calledOnce
                    .calledWithExactly([{conditions: [matcher], actions: [action]}]);
            },
            'adds page rule for scheme, hostname and port': async () => {
                const action = {name: 'show page'};
                const matcher = {name: 'url matcher'};
                settings.cacheUrlPaths.resolves({'https://some.site.com:8888': [{}]});
                chrome.declarativeContent.ShowPageAction.returns(action);
                chrome.declarativeContent.PageStateMatcher.returns(matcher);

                await getInstalledListener()();

                expect(chrome.declarativeContent.onPageChanged.removeRules).to.be.calledOnce;
                expect(chrome.declarativeContent.PageStateMatcher).to.be.calledOnce
                    .calledWithExactly({pageUrl: {hostEquals: 'some.site.com', ports: [8888], schemes: ['https']}});
                expect(chrome.declarativeContent.ShowPageAction).to.be.calledOnce;
                expect(chrome.declarativeContent.onPageChanged.addRules).to.be.calledOnce
                    .calledWithExactly([{conditions: [matcher], actions: [action]}]);
            },
            'adds page rule for scheme, hostname and path prefix': async () => {
                const action = {name: 'show page'};
                const matcher = {name: 'url matcher'};
                settings.cacheUrlPaths.resolves({'https://some.site.com/account': [{}]});
                chrome.declarativeContent.ShowPageAction.returns(action);
                chrome.declarativeContent.PageStateMatcher.returns(matcher);

                await getInstalledListener()();

                expect(chrome.declarativeContent.onPageChanged.removeRules).to.be.calledOnce;
                expect(chrome.declarativeContent.PageStateMatcher).to.be.calledOnce
                    .calledWithExactly({pageUrl: {hostEquals: 'some.site.com', pathPrefix: '/account', schemes: ['https']}});
                expect(chrome.declarativeContent.ShowPageAction).to.be.calledOnce;
                expect(chrome.declarativeContent.onPageChanged.addRules).to.be.calledOnce
                    .calledWithExactly([{conditions: [matcher], actions: [action]}]);
            },
            'adds page rule for scheme, hostname, path prefix and query': async () => {
                const action = {name: 'show page'};
                const matcher = {name: 'url matcher'};
                settings.cacheUrlPaths.resolves({'https://some.site.com/account?login=true': [{}]});
                chrome.declarativeContent.ShowPageAction.returns(action);
                chrome.declarativeContent.PageStateMatcher.returns(matcher);

                await getInstalledListener()();

                expect(chrome.declarativeContent.onPageChanged.removeRules).to.be.calledOnce;
                expect(chrome.declarativeContent.PageStateMatcher).to.be.calledOnce
                    .calledWithExactly({pageUrl: {
                        hostEquals: 'some.site.com',
                        pathPrefix: '/account',
                        queryContains: 'login=true',
                        schemes: ['https']
                    }});
                expect(chrome.declarativeContent.ShowPageAction).to.be.calledOnce;
                expect(chrome.declarativeContent.onPageChanged.addRules).to.be.calledOnce
                    .calledWithExactly([{conditions: [matcher], actions: [action]}]);
            }
        },
        'storage.onChanged': {
            'ignores message for sync storage change': async () => {
                await getStorageListener()({urlPaths: {}}, 'sync');

                expect(chrome.declarativeContent.onPageChanged.removeRules).to.not.be.called;
            },
            'ignores message if urlPaths did not change': async () => {
                await getStorageListener()({vaultUrl: 'new url'}, 'local');

                expect(chrome.declarativeContent.onPageChanged.removeRules).to.not.be.called;
            },
            'updates page rules when urlPaths changes': async () => {
                const action = {name: 'show page'};
                const matcher = {name: 'url matcher'};
                chrome.declarativeContent.ShowPageAction.returns(action);
                chrome.declarativeContent.PageStateMatcher.returns(matcher);

                await getStorageListener()({urlPaths: {newValue: {'https://some.site.com': [{}]}}}, 'local');

                expect(chrome.declarativeContent.onPageChanged.removeRules).to.be.calledOnce;
                expect(chrome.declarativeContent.PageStateMatcher).to.be.calledOnce
                    .calledWithExactly({pageUrl: {
                        hostEquals: 'some.site.com',
                        schemes: ['https']
                    }});
                expect(chrome.declarativeContent.ShowPageAction).to.be.calledOnce;
                expect(chrome.declarativeContent.onPageChanged.addRules).to.be.calledOnce
                    .calledWithExactly([{conditions: [matcher], actions: [action]}]);
            }
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