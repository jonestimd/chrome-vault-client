import '../../test/types/global';
import type * as settings from '../settings';
import type * as vaultApi from '../vaultApi';

interface AlarmStub extends Record<string, any> {
    onAlarm: {
        addListener: jest.MockedFunction<any>;
    }
}

let settingsStub: typeof settings;
let vaultStub: typeof vaultApi;

const alarms = chrome.alarms as AlarmStub;
const getAlarmListener = () => alarms.onAlarm.addListener.mock.calls[0][0];

const vaultUrl = 'https://my.vault';
const token = 'the token';

const load = (settingsResult?: settings.Settings, refresh = true) => {
    jest.isolateModules(() => {
        settingsStub = jest.requireActual<typeof settings>('../settings');
        vaultStub = jest.requireActual<typeof vaultApi>('../vaultApi');
        jest.spyOn(settingsStub, 'clearToken').mockResolvedValue(undefined);
        if (settingsResult) jest.spyOn(settingsStub, 'load').mockResolvedValue(settingsResult);
        else jest.spyOn(settingsStub, 'load').mockRejectedValue(new Error());
        jest.spyOn(vaultStub, 'refreshToken').mockResolvedValue(refresh);
        require('./background');
    });
};

describe('firefox/background', () => {
    describe('onAlarm', () => {
        it('ignores unknown alarm', async () => {
            load();

            await getAlarmListener()({name: 'unknown alamm'});

            expect(settingsStub.load).not.toHaveBeenCalled();
            expect(vaultStub.refreshToken).not.toHaveBeenCalled();
            expect(settingsStub.clearToken).not.toHaveBeenCalled();
        });
        it('renews token', async () => {
            load({vaultUrl, token});

            await getAlarmListener()({name: 'refresh-token'});

            expect(settingsStub.load).toHaveBeenCalledTimes(1);
            expect(vaultStub.refreshToken).toHaveBeenCalledTimes(1);
            expect(vaultStub.refreshToken).toHaveBeenCalledWith(vaultUrl, token);
            expect(settingsStub.clearToken).not.toHaveBeenCalled();
        });
        it('clears token if renewal fails', async () => {
            load({vaultUrl, token}, false);

            await getAlarmListener()({name: 'refresh-token'});

            expect(settingsStub.load).toHaveBeenCalledTimes(1);
            expect(vaultStub.refreshToken).toHaveBeenCalledTimes(1);
            expect(vaultStub.refreshToken).toHaveBeenCalledWith(vaultUrl, token);
            expect(settingsStub.clearToken).toHaveBeenCalledTimes(1);
        });
    });
});