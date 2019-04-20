// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';
import * as settings from './settings';

const cssMatchers = ['input[type="password"]', 'input[type="text"][id*="user" i]'];

function newRule(pageUrl) {
    // return {pageUrl, css: cssMatchers};
    return { pageUrl };
}

function getUrlRule(urlPaths) {
    const conditions = Object.keys(urlPaths).map(urlString => {
        try {
            const url = new URL(urlString);
            const pageUrl = { hostEquals: url.hostname, schemes: [url.protocol.replace(':', '')] };
            if (url.port) pageUrl.ports = [parseInt(url.port)];
            if (url.pathname.length > 1) pageUrl.pathPrefix = url.pathname;
            if (url.search) pageUrl.queryContains = url.search.substr(1);
            return new chrome.declarativeContent.PageStateMatcher(newRule(pageUrl));
        } catch (err) { // just the hostname
            return new chrome.declarativeContent.PageStateMatcher(newRule({ hostEquals: urlString, schemes: ['https'] }));
        }
    });
    return { conditions, actions: [new chrome.declarativeContent.ShowPageAction()] };
}

function setPageRules(urlPaths) {
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