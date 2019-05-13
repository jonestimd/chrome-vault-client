import * as sinon from 'sinon';

export function MockSnackbar(element) {
    let labelText;
    MockSnackbar.instance = this;

    Object.defineProperties(this, {
        labelText: {
            enumerable: true,
            get: () => labelText,
            set: (v) => labelText = v
        },
        open: {value: sinon.stub()}
    })
}