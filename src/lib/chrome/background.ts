'use strict';
import * as settings from '../settings';
import * as vaultApi from '../vaultApi';
import {refreshTokenAlarm} from '../alarms';
import PageStateUrlDetails = chrome.declarativeContent.PageStateUrlDetails;

function getUrlRule(urls: URL[]): chrome.events.Rule {
    const conditions = urls.map(url => {
        const pageUrl: PageStateUrlDetails = {hostEquals: url.hostname, schemes: [url.protocol.replace(':', '')]};
        if (url.port) pageUrl.ports = [parseInt(url.port)];
        if (url.pathname.length > 1) pageUrl.pathPrefix = url.pathname;
        if (url.search) pageUrl.queryContains = url.search.substr(1);
        return new chrome.declarativeContent.PageStateMatcher({pageUrl});
    });
    return {conditions, actions: [new chrome.declarativeContent.ShowPageAction()]};
}

function setPageRules(urls?: URL[]) {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
        if (urls) chrome.declarativeContent.onPageChanged.addRules([getUrlRule(urls)]);
    });
}

chrome.runtime.onInstalled.addListener(async function () {
    try {
        const urls = await settings.uniqueUrls();
        setPageRules(urls);
    } catch (err) {
        if (err.status !== 403) console.log(err.message);
    }
});

chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' && changes.urlPaths) {
        setPageRules(settings.toUniqueUrls(changes.urlPaths.newValue));
    }
});

chrome.alarms.onAlarm.addListener(async function (alarm) {
    if (alarm.name === refreshTokenAlarm) {
        const {vaultUrl, token} = await settings.load();
        if (!await vaultApi.refreshToken(vaultUrl, token)) {
            await settings.clearToken();
        }
    }
});