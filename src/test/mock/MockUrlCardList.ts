import * as sinon from 'sinon';

export class MockUrlCardList {
    static readonly byId: {[id: string]: MockUrlCardList} = {};

    readonly removeAll = sinon.stub();
    readonly addCard = sinon.stub();
    readonly filterCards = sinon.stub();
    readonly showAll = sinon.stub();
    readonly element: HTMLElement;

    constructor(element: HTMLElement) {
        this.element = element;
        MockUrlCardList.byId[element.id] = this;
    }
}