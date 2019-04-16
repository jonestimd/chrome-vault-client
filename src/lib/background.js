// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';
import * as settings from './settings';

chrome.runtime.onInstalled.addListener(async function () {
    console.log(await settings.cacheUrlPaths());
    //   chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    //     chrome.declarativeContent.onPageChanged.addRules([{
    //       conditions: [new chrome.declarativeContent.PageStateMatcher({pageUrl: {hostEquals: 'developer.chrome.com'}})],
    //       actions: [new chrome.declarativeContent.ShowPageAction()]
    //     }]);
    //   });
});

chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' && changes.urlPaths) {
        if (changes.urlPaths.newValue) {
            // TODO enable page action
        }
        else chrome.declarativeContent.onPageChanged.removeRules();
    }
});