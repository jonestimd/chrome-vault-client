import * as settings from '../settings';
import {refreshTokenAlarm} from '../alarms';

chrome.alarms.onAlarm.addListener(async function (alarm) {
    if (alarm.name === refreshTokenAlarm) {
        await settings.refreshToken();
    }
});
