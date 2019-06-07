import {getLabel, getText} from './htmlUtil';

export interface LoginInput {
    selector?: string;
    label?: string;
    value: string;
}

enum InputType {text, email, tel, password};
const inputTypes = Object.keys(InputType).filter(k => typeof InputType[k as any] === 'number');

export interface InputInfoProps {
    id?: string;
    name?: string;
    label?: string;
    placeholder?: string;
    type: string;
}

export class InputInfo implements InputInfoProps {
    private static readonly DEFAULT_TYPE = InputType[InputType.text];
    static InputType = InputType;

    static get displayProps(): Array<keyof InputInfoProps> {
        return ['type', 'id', 'name', 'label', 'placeholder'];
    }

    static isValid(input: HTMLInputElement): boolean {
        return inputTypes.includes(input.type || InputInfo.DEFAULT_TYPE) && input.getClientRects().length > 0;
    }

    readonly id?: string;
    readonly name?: string;
    readonly label?: string;
    readonly placeholder?: string;
    readonly type: string;

    constructor(input: HTMLInputElement) {
        const label = getLabel(input);
        this.id = input.id;
        this.name = input.name;
        this.placeholder = input.placeholder;
        this.label = label && getText(label);
        this.type = input.type || InputInfo.DEFAULT_TYPE;
    }

    get isEmpty(): boolean {
        return this.type !== InputType[InputType.password] && !InputInfo.displayProps.slice(1).some(prop => Boolean(this[prop]));
    }
}

export interface PageInfoMessage {
    url: string
    inputs: InputInfo[];
}