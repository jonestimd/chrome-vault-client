import sinon from 'sinon';

export function MockList(element) {
    MockList.byId[element.id] = this;

    Object.defineProperties(this, {
        removeAll: {value: sinon.stub()},
        addItem: {value: sinon.stub()}
    });
}
MockList.byId = {};