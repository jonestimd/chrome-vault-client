import sinon from 'sinon';

module.exports = {
    beforeEach() {
        global.chrome = {
            storage: {
                local: {
                    get: sinon.stub(),
                    set: sinon.stub(),
                    remove: sinon.stub()
                }
            },
            permissions: {
                getAll: sinon.stub(),
                request: sinon.stub()
            }
        };
    }
};