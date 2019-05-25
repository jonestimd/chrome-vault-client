import * as sinon from 'sinon';

export class MockSnackbar {
    static instance: MockSnackbar;

    private readonly element: HTMLElement;
    private _labelText: string;
    readonly open = sinon.stub();

    constructor(element: HTMLElement) {
        this.element = element;
        MockSnackbar.instance = this;
    }

    get labelText(): string {
        return this._labelText;
    }

    set labelText(text: string) {
        this._labelText = text;
    }
}