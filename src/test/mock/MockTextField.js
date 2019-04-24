import sinon from 'sinon';

export function MockTextField(element) {
    const input = element.querySelector('input');
    const foundation = {
        adapter_: {addClass: sinon.stub()}
    };
    MockTextField.byId[input.id] = this;

    Object.defineProperties(this, {
        value: {
            enumerable: true,
            get: () => input.value,
            set: (v) => input.value = v
        },
        _element: {value: element},
        listen: {value: sinon.stub()},
        focus: {value: sinon.stub()},
        valid: {get: () => !input.required || input.value.length > 0},
        getDefaultFoundation: {value: () => foundation}
    });
}
MockTextField.byId = {};