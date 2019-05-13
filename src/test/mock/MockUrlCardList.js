import * as sinon from 'sinon';

export function MockUrlCardList(element) {
    MockUrlCardList.byId[element.id] = this;

    Object.defineProperties(this, {
        removeAll: {value: sinon.stub()},
        addCard: {value: sinon.stub()},
        filterCards: {value: sinon.stub()},
        showAll: {value: sinon.stub()}
    });
}
MockUrlCardList.byId = {};