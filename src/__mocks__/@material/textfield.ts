const mock = jest.fn();
mock.mockImplementation(function (element: HTMLElement) {
    const index = mock.mock.instances.length - 1;
    return mock.mock.instances[index] = {
        element,
        input: element.querySelector('input'),
        listen: jest.fn(),
        focus: jest.fn(),
        foundation: {
            setValid: jest.fn(),
        },
        get value() {
            return this.input.value;
        },
        set value(value: string) {
            this.input.value = value;
        },
        get valid() {
            return !this.input.required || this.input.value.length > 0;
        },
        get required() {
            return this.input.required;
        },
        set required(required: boolean) {
            this.input.required = required;
        },
        getDefaultFoundation() {
            return this.foundation;
        },
        triggerChange(value: string) {
            this.value = value;
            this.listen.mock.calls.forEach(([, handler]: [any, Function]) => handler({target: this}));
        },
    };
});

export const MDCTextField = mock;