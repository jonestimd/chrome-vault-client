import * as sinon from 'sinon';

export class MockTextField {
    static readonly byId: {[key: string]: MockTextField} = {};
    private readonly input: HTMLInputElement;
    private readonly foundation: {setValid: (valid: boolean) => void};
    private readonly element: HTMLElement;
    readonly listen = sinon.stub();
    readonly focus = sinon.stub();

    constructor(element: HTMLElement) {
        this.element = element;
        this.input = element.querySelector('input');
        this.foundation = {
            setValid: sinon.stub()
        };
        MockTextField.byId[this.input.id] = this;
    }

    get value(): string {
        return this.input.value;
    }

    set value(value: string) {
        this.input.value = value;
        this.listen.args.forEach(([, handler]) => handler({target: this}));
    }

    get valid(): boolean {
        return !this.input.required || this.input.value.length > 0;
    }

    get required(): boolean {
        return this.input.required;
    }

    set required(required: boolean) {
        this.input.required = required;
    }

    getDefaultFoundation() {
        return this.foundation;
    }
}