import {JSDOM} from 'jsdom';
import TotpList from './TotpList';
import {MDCLinearProgress as MockProgress} from '../../__mocks__/@material/linear-progress';
import {MDCLinearProgress} from '@material/linear-progress';
import * as vaultApi from '../vaultApi';

let element: HTMLElement;
const vaultUrl = 'https://my.vault';
const auth = {token: 'token1', expiresAt: Infinity};

const getText = (query: string) => Array.from(element.querySelectorAll(query)).map((e) => e.textContent);

const getPasscodes = (keys: string[], suffix = '') => keys.map((key) => ({key, code: `${key}.code${suffix}`}));

describe('TotpList', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        global.window = new JSDOM('<html><body><div id="totp-codes"></body></html>').window as any;
        global.requestAnimationFrame = jest.fn();
        global.document = window.document;
        global.DOMParser = window.DOMParser;
        element = document.querySelector('#totp-codes')!;
    });
    afterEach(() => {
        global.window = {} as any;
        global.document = {} as any;
    });
    describe('setItems', () => {
        it('displays message for no token', async () => {
            jest.spyOn(vaultApi, 'getPasscodes').mockResolvedValue([]);
            const countdownBar = new MockProgress();
            const showStatus = jest.fn();
            const list = new TotpList(element, countdownBar as unknown as MDCLinearProgress, showStatus);

            await list.setItems({vaultUrl, auth: {token: '', expiresAt: 0}, totpSettings: [
                {key: 'key1', account_name: 'account1', issuer: 'issuer1'},
            ]});

            expect(getText('li .mdc-list-item__primary-text')).toEqual(['key1']);
            expect(getText('li .mdc-list-item__secondary-text')).toEqual(['issuer1 (account1)']);
            expect(vaultApi.getPasscodes).not.toHaveBeenCalled();
            expect(list['passcodeInterval']).toBeUndefined();
            expect(showStatus).toHaveBeenCalledWith('Need a token');
        });
        it('displays key, issuer and account name', async () => {
            jest.spyOn(vaultApi, 'getPasscodes').mockResolvedValue([]);
            const countdownBar = new MockProgress();
            const showStatus = jest.fn();
            const list = new TotpList(element, countdownBar as unknown as MDCLinearProgress, showStatus);

            await list.setItems({vaultUrl, auth, totpSettings: [
                {key: 'key1', account_name: 'account1', issuer: 'issuer1'},
                {key: 'key2', account_name: 'account2'},
            ]});

            expect(getText('li .mdc-list-item__primary-text')).toEqual(['key1', 'key2']);
            expect(getText('li .mdc-list-item__secondary-text')).toEqual(['issuer1 (account1)', ' (account2)']);
            expect(vaultApi.getPasscodes).toHaveBeenCalledWith(['key1', 'key2'], vaultUrl, auth.token);
            expect(countdownBar.setProgress).toHaveBeenCalledWith(0);
            expect(list['passcodeInterval']).toBeUndefined();
        });
        it('displays passcodes', async () => {
            jest.spyOn(vaultApi, 'getPasscodes').mockResolvedValue(getPasscodes(['key1', 'key2']));
            const countdownBar = new MockProgress();
            const showStatus = jest.fn();
            const list = new TotpList(element, countdownBar as unknown as MDCLinearProgress, showStatus);

            await list.setItems({vaultUrl, auth, totpSettings: [
                {key: 'key1', account_name: 'account1', issuer: 'issuer1'},
                {key: 'key2', account_name: 'account2'},
            ]});

            expect(getText('li .mdc-deprecated-list-item__meta span.passcode')).toEqual(['key1.code', 'key2.code']);
            expect(countdownBar.setProgress).toHaveBeenCalled();
            expect(countdownBar.setProgress).not.toHaveBeenCalledWith(0);
            expect(list['passcodeInterval']).toBeDefined();
        });
        it('updates countdown every second', async () => {
            jest.spyOn(vaultApi, 'getPasscodes').mockResolvedValue(getPasscodes(['key1', 'key2']));
            const countdownBar = new MockProgress();
            const showStatus = jest.fn();
            const list = new TotpList(element, countdownBar as unknown as MDCLinearProgress, showStatus);
            jest.setSystemTime(1000);
            await list.setItems({vaultUrl, auth, totpSettings: [
                {key: 'key1', account_name: 'account1', issuer: 'issuer1'},
                {key: 'key2', account_name: 'account2'},
            ]});

            await jest.advanceTimersByTimeAsync(1000);
            await jest.advanceTimersByTimeAsync(1000);

            expect(getText('li .mdc-deprecated-list-item__meta span.passcode')).toEqual(['key1.code', 'key2.code']);
            expect(countdownBar.setProgress).toHaveBeenCalledTimes(3);
            expect(countdownBar.setProgress).toHaveBeenCalledWith(28/29);
            expect(countdownBar.setProgress).toHaveBeenCalledWith(27/29);
            expect(countdownBar.setProgress).toHaveBeenCalledWith(26/29);
        });
        it('it updates passcodes when countdown restarts', async () => {
            jest.spyOn(vaultApi, 'getPasscodes')
                .mockResolvedValueOnce(getPasscodes(['key1', 'key2']))
                .mockResolvedValueOnce(getPasscodes(['key1', 'key2'], '.1'));
            const countdownBar = new MockProgress();
            countdownBar.root.getAttribute.mockReturnValueOnce('1');
            const showStatus = jest.fn();
            const list = new TotpList(element, countdownBar as unknown as MDCLinearProgress, showStatus);
            await list.setItems({vaultUrl, auth, totpSettings: [
                {key: 'key1', account_name: 'account1', issuer: 'issuer1'},
                {key: 'key2', account_name: 'account2'},
            ]});

            await jest.advanceTimersByTimeAsync(1000);

            expect(getText('li .mdc-deprecated-list-item__meta span.passcode')).toEqual(['key1.code.1', 'key2.code.1']);
        });
        it('stops countdown when getPasscodes fails', async () => {
            jest.spyOn(vaultApi, 'getPasscodes')
                .mockResolvedValueOnce(getPasscodes(['key1', 'key2']))
                .mockResolvedValueOnce([{key: 'key1', code: ''}, {key: 'key2', code: ''}]);
            const countdownBar = new MockProgress();
            countdownBar.root.getAttribute.mockReturnValueOnce('1');
            const showStatus = jest.fn();
            const list = new TotpList(element, countdownBar as unknown as MDCLinearProgress, showStatus);
            await list.setItems({vaultUrl, auth, totpSettings: [
                {key: 'key1', account_name: 'account1', issuer: 'issuer1'},
                {key: 'key2', account_name: 'account2'},
            ]});

            await jest.advanceTimersByTimeAsync(1000);

            expect(getText('li .mdc-deprecated-list-item__meta span.passcode')).toEqual(['', '']);
            expect(countdownBar.setProgress).toHaveBeenCalledWith(0);
            expect(list['passcodeInterval']).toBeUndefined();
        });
    });
});