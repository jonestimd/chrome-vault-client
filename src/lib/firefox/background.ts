import * as settings from '../settings';
import * as vaultApi from '../vaultApi';
import {refreshTokenAlarm} from '../alarms';

chrome.alarms.onAlarm.addListener(async function (alarm) {
    if (alarm.name === refreshTokenAlarm) {
        const {vaultUrl, token} = await settings.load();
        if (!vaultUrl || !token || !await vaultApi.refreshToken(vaultUrl, token)) {
            await settings.clearToken();
        }
    }
});
