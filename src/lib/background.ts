'use strict';
import * as settings from './settings';
import * as vaultApi from './vaultApi';
import {refreshTokenAlarm} from './alarms';
import PageStateUrlDetails = chrome.declarativeContent.PageStateUrlDetails;

function toUrl(url: string): URL {
    try {
        return new URL(url);
    } catch (err) { // just the hostname
        return new URL(`https://` + url);
    }
}

function uniqueUrls(urlPaths: vaultApi.UrlPaths): URL[] {
    const urlStrings: string[] = [];
    return Object.values(urlPaths).reduce((urls: URL[], secrets) => {
        return urls.concat(
            secrets.map(secret => toUrl(secret.url)).filter(url => !urlStrings.includes(url.toString()) && urlStrings.push(url.toString()))
        );
    }, []);
}

function getUrlRule(urlPaths: vaultApi.UrlPaths): chrome.events.Rule {
    const conditions = uniqueUrls(urlPaths).map(url => {
        const pageUrl: PageStateUrlDetails = {hostEquals: url.hostname, schemes: [url.protocol.replace(':', '')]};
        if (url.port) pageUrl.ports = [parseInt(url.port)];
        if (url.pathname.length > 1) pageUrl.pathPrefix = url.pathname;
        if (url.search) pageUrl.queryContains = url.search.substr(1);
        return new chrome.declarativeContent.PageStateMatcher({pageUrl});
    });
    return {conditions, actions: [new chrome.declarativeContent.ShowPageAction()]};
}

function setPageRules(urlPaths: vaultApi.UrlPaths) {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
        if (urlPaths) chrome.declarativeContent.onPageChanged.addRules([getUrlRule(urlPaths)]);
    });
}

chrome.runtime.onInstalled.addListener(async function () {
    try {
        const urlPaths = await settings.cacheUrlPaths();
        setPageRules(urlPaths);
    } catch (err) {
        if (err.status !== 403) console.log(err.message);
    }
});

chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' && changes.urlPaths) {
        setPageRules(changes.urlPaths.newValue);
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