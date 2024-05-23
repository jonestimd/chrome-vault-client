import '../../test/types/global';
import type * as settings from '../settings';

interface AlarmStub extends Record<string, any> {
    onAlarm: {
        addListener: jest.MockedFunction<any>;
    }
}

let settingsStub: typeof settings;

const alarms = chrome.alarms as AlarmStub;
const getAlarmListener = () => alarms.onAlarm.addListener.mock.calls[0][0];

const load = () => {
    jest.isolateModules(() => {
        settingsStub = jest.requireActual<typeof settings>('../settings');
        jest.spyOn(settingsStub, 'refreshToken').mockResolvedValue(undefined);
        require('./background');
    });
};

describe('firefox/background', () => {
    describe('onAlarm', () => {
        it('ignores unknown alarm', async () => {
            load();

            await getAlarmListener()({name: 'unknown alamm'});

            expect(settingsStub.refreshToken).not.toHaveBeenCalled();
        });
        it('renews token', async () => {
            load();

            await getAlarmListener()({name: 'refresh-token'});

            expect(settingsStub.refreshToken).toHaveBeenCalledTimes(1);
        });
    });
});