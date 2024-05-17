import {MDCSelect} from '@material/select';
import {html} from './html';
import type {InputInfoProps} from '../message';
import {userProps} from '../constants';

const createRoot = (label: string) => html`
<div class="mdc-select mdc-select--filled">
    <div class="mdc-select__anchor" role="button" aria-haspopup="listbox">
        <span class="mdc-floating-label"><b>${label}</b> input</span>
        <span class="mdc-select__selected-text"></span>
        <i class="mdc-select__dropdown-icon material-icons">arrow_drop_down</i>
        <span class="mdc-line-ripple"></span>
    </div>
    <div class="mdc-select__menu mdc-menu mdc-menu-surface mdc-menu-surface--fullwidth">
        <ul class="mdc-deprecated-list" role="listbox"></ul>
    </div>
</div>`;

const createMenuItem = (value: string) => html`
<li class="mdc-deprecated-list-item" role="option" data-value="${value}">
    <span class="mdc-deprecated-list-item__ripple"></span>
    <span class="mdc-deprecated-list-item__text">${value}</span>
</li>`;

const isMatch = (propNames: string[], inputInfo: InputInfoProps) => {
    return inputInfo.id && propNames.includes(inputInfo.id.toLowerCase())
        || inputInfo.name && propNames.includes(inputInfo.name.toLowerCase())
        || inputInfo.label && propNames.includes(inputInfo.label.toLowerCase())
        || inputInfo.placeholder && propNames.includes(inputInfo.placeholder.toLowerCase());
};

type SavedSelection = Omit<InputInfoProps, 'refId'>;
const compareKeys: (keyof SavedSelection)[] = ['type', 'id', 'label', 'name', 'placeholder'];

const isSelection = (input: InputInfoProps, selection?: SavedSelection) => {
    if (input.frameId === selection?.frameId) {
        return compareKeys.every((key) => input[key] === selection[key]);
    }
};

const coalesce = (...values: (string | false | undefined)[]) => values.find((v) => v) as string | undefined;

export function getInputName(inputInfo: InputInfoProps) {
    return coalesce(inputInfo.label, inputInfo.placeholder, inputInfo.id, inputInfo.name, inputInfo.type === 'password' && 'password');
}

export type SelectionListener = (propName: string, selected?: InputInfoProps) => unknown;

export default class PropSelect {
    private root: HTMLElement;
    private optionsUl: HTMLUListElement;
    private readonly inputInfos: InputInfoProps[] = [];
    private mdcSelect: MDCSelect;
    private skipNotify = false;

    constructor(parent: HTMLElement, readonly propName: string, listener?: SelectionListener) {
        this.root = createRoot(propName);
        parent.appendChild(this.root);
        this.optionsUl = this.root.querySelector('ul')!;
        this.optionsUl.appendChild(createMenuItem(''));
        this.mdcSelect = new MDCSelect(this.root);
        if (listener) this.mdcSelect.listen('MDCSelect:change', () => !this.skipNotify && listener(this.propName, this.selectedInputInfo));
    }

    private setSelectedIndex(index: number) {
        this.skipNotify = true;
        this.mdcSelect.selectedIndex = index;
        this.skipNotify = false;
    }

    addOptions(inputInfos: InputInfoProps[], selection?: SavedSelection | 'none') {
        for (const inputInfo of inputInfos) {
            const inputName = getInputName(inputInfo);
            if (inputName) {
                this.inputInfos.push(inputInfo);
                this.optionsUl.appendChild(createMenuItem(inputName));
            }
        }
        this.mdcSelect.layoutOptions();
        if (selection !== 'none') {
            const selectedIndex = this.inputInfos.findIndex((input) => isSelection(input, selection));
            if (selectedIndex > 0) this.setSelectedIndex(selectedIndex + 1);
            else this.selectDefault();
        }
    }

    private selectDefault() {
        if (this.mdcSelect.selectedIndex === 0) {
            if (this.propName === 'password') {
                const index = this.inputInfos.findIndex((i) => i.type === 'password');
                if (index >= 0) this.setSelectedIndex(index + 1);
            }
            else {
                const lowerName = this.propName.toLowerCase();
                const altNames = userProps.includes(lowerName) ? userProps : [lowerName];
                const index = this.inputInfos.findIndex((i) => isMatch(altNames, i));
                if (index >= 0) this.setSelectedIndex(index + 1);
            }
        }
    }

    get selectedInputInfo() {
        if (this.mdcSelect.selectedIndex > 0) return this.inputInfos[this.mdcSelect.selectedIndex - 1];
    }
}
