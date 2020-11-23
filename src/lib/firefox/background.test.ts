import '../../test/types/global';
import * as settings from '../settings';
import * as vaultApi from '../vaultApi';

interface AlarmStub extends Record<string, any> {
    onAlarm: {
        addListener: jest.MockedFunction<any>;
    }
}

const alarms = chrome.alarms as AlarmStub;
const getAlarmListener = () => alarms.onAlarm.addListener.mock.calls[0][0];

const vaultUrl = 'https://my.vault';
const token = 'the token';

describe('firefox/background', () => {
    beforeEach(() => {
        jest.isolateModules(() => {
            require('./background');
        });
    });
    describe('onAlarm', () => {
        beforeEach(() => {
            jest.spyOn(settings, 'clearToken').mockResolvedValue(undefined);
            jest.spyOn(settings, 'load').mockResolvedValue(undefined);
            jest.spyOn(vaultApi, 'refreshToken').mockResolvedValue(undefined);
        });
        it('ignores unknown alarm', async () => {
            await getAlarmListener()({name: 'unknown alamm'});

            expect(settings.load).not.toBeCalled();
            expect(vaultApi.refreshToken).not.toBeCalled();
            expect(settings.clearToken).not.toBeCalled();
        });
        it('renews token', async () => {
            jest.spyOn(settings, 'load').mockResolvedValue({vaultUrl, token});
            jest.spyOn(vaultApi, 'refreshToken').mockResolvedValue(true);

            await getAlarmListener()({name: 'refresh-token'});

            expect(settings.load).toBeCalledTimes(1);
            expect(vaultApi.refreshToken).toBeCalledTimes(1);
            expect(vaultApi.refreshToken).toBeCalledWith(vaultUrl, token);
            expect(settings.clearToken).not.toBeCalled();
        });
        it('clears token if renewal fails', async () => {
            jest.spyOn(settings, 'load').mockResolvedValue({vaultUrl, token});
            jest.spyOn(vaultApi, 'refreshToken').mockResolvedValue(false);

            await getAlarmListener()({name: 'refresh-token'});

            expect(settings.load).toBeCalledTimes(1);
            expect(vaultApi.refreshToken).toBeCalledTimes(1);
            expect(vaultApi.refreshToken).toBeCalledWith(vaultUrl, token);
            expect(settings.clearToken).toBeCalledTimes(1);
        });
    });
});