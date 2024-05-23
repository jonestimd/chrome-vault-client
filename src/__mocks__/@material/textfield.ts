class MockTextField {
    static instances: MockTextField[] = [];
    readonly listen = jest.fn();
    readonly focus = jest.fn();
    readonly foundation = {
        setValid: jest.fn(),
    };

    constructor(readonly element: HTMLElement) {
        MockTextField.instances.push(this);
    }

    get input() {
        return this.element.querySelector('input')!;
    }

    get value() {
        return this.input.value;
    }

    set value(value: string) {
        this.input!.value = value;
    }
    get valid() {
        return !this.input.required || this.input.value.length > 0;
    }

    get required() {
        return this.input.required;
    }

    set required(required: boolean) {
        this.input.required = required;
    }

    getDefaultFoundation() {
        return this.foundation;
    }

    triggerChange(value: string) {
        this.value = value;
        this.listen.mock.calls.forEach(([, handler]: [unknown, Function]) => handler({target: this}));
    }
}

export const MDCTextField = MockTextField;