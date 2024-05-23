import List, {ListItem} from './List';
import type {Settings} from '../settings';
import * as vaultApi from '../vaultApi';
import {MDCLinearProgress} from '@material/linear-progress';

const countdown = () => (29 - (Math.floor(Date.now() / 1000) % 30)) / 29;

export default class TotpList extends List<ListItem> {
    private passcodeInterval: NodeJS.Timeout | undefined;

    constructor(
        element: HTMLElement,
        private readonly countdownBar: MDCLinearProgress,
        private readonly showStatus: (status: string) => void,
    ) {
        super(element);
    }

    private async updatePasscodes(keys: string[], vaultUrl: string, auth: Required<Settings>['auth']) {
        const passcodes = await vaultApi.getPasscodes(keys, vaultUrl, auth.token);
        for (const {key, code} of passcodes) {
            this.element.querySelector(`span.passcode[name="${key}"]`)?.replaceChildren(code);
        }
        return passcodes.some((p) => p.code);
    }

    async setItems({vaultUrl, auth, totpSettings}: Pick<Settings, 'vaultUrl' | 'auth' | 'totpSettings'> = {}) {
        if (totpSettings?.length) {
            this.removeAll();
            for (const {key, issuer, account_name} of totpSettings) {
                const item = new ListItem(`${key}`, `${issuer ?? ''} (${account_name})`,
                    `<span class="passcode" name="${key}"></span>
                    <button class="mdc-icon-button small">
                        <div class="mdc-icon-button__ripple"></div>
                        <span class="mdc-icon-button__focus-ring"></span>
                        <i class="material-icons">content_copy</i>
                    </button>`
                );
                this.addListItem(item);
                item.listItem.querySelector('button')?.addEventListener('click', () => {
                    const code = item.listItem.querySelector('span.passcode')?.textContent;
                    if (code) navigator.clipboard.writeText(code);
                });
            }
            if (vaultUrl && auth?.token) {
                const keys = totpSettings.map((p) => p.key);
                if (await this.updatePasscodes(keys, vaultUrl, auth)) {
                    this.countdownBar.progress = countdown();
                    if (!this.passcodeInterval) {
                        this.passcodeInterval = setInterval(async () => {
                            this.countdownBar.progress = countdown();
                            if (this.countdownBar.root.getAttribute('aria-valuenow') === '1') {
                                if (!await this.updatePasscodes(keys, vaultUrl, auth)) {
                                    this.countdownBar.progress = 0;
                                    clearInterval(this.passcodeInterval);
                                    this.passcodeInterval = undefined;
                                }
                            }
                        }, 1000);
                    }
                }
                else this.countdownBar.progress = 0;
            }
            else this.showStatus('Need a token');
        }
    }
}
