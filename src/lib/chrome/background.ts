'use strict';
import * as settings from '../settings';
import {refreshTokenAlarm} from '../alarms';

const {PageStateMatcher} = chrome.declarativeContent;
const schemes = ['https'];

function getDomainRule(domains: string[]): chrome.events.Rule {
    const conditions = domains.flatMap((domain) => {
        const rules = [new PageStateMatcher({pageUrl: {hostEquals: domain, schemes}})];
        if (domain.includes('.')) {
            rules.push(new PageStateMatcher({pageUrl: {hostSuffix: `.${domain}`, schemes}}));
        }
        return rules;
    });
    return {conditions, actions: [new chrome.declarativeContent.ShowPageAction()]};
}

function setPageRules(domains: string[]) {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
        if (domains.length) chrome.declarativeContent.onPageChanged.addRules([getDomainRule(domains)]);
    });
}

function isRequestError(err: unknown): err is {status: number, message: string} {
    return typeof err === 'object' && 'status' in err! && typeof err.status === 'number';
}

chrome.runtime.onInstalled.addListener(async function () {
    try {
        const domains = await settings.getDomains();
        setPageRules(domains);
    } catch (err) {
        if (isRequestError(err) && err.status !== 403) console.log(err.message);
    }
});

chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' && changes.secretPaths) {
        setPageRules(await settings.getDomains());
    }
});

chrome.alarms.onAlarm.addListener(async function (alarm) {
    if (alarm.name === refreshTokenAlarm) {
        await settings.refreshToken();
    }
});