import * as chai from 'chai';
chai.use(require('sinon-chai'));
const {expect} = chai;
import * as sinon from 'sinon';
import * as htmlUtil from '../lib/htmlUtil';
import {InputInfo} from '../lib/message';

let htmlUtilStub: sinon.SinonStubbedInstance<typeof htmlUtil>;

function mockInput(props: {type?: string, id?: string, name?: string, placeholder?: string}, rect?: object): HTMLInputElement {
    const element = props as HTMLInputElement;
    element.getClientRects = sinon.stub().returns(rect && [rect] || []);
    return element;
}

module.exports = {
    message: {
        InputInfo: {
            beforeEach() {
                htmlUtilStub = sinon.stub(htmlUtil);
            },
            afterEach() {
                sinon.restore();
            },
            'constructor': {
                'copies props from input': () => {
                    const element = {
                        type: 'text',
                        id: 'input id',
                        name: 'input name',
                        placeholder: 'input placeholder'
                    } as HTMLInputElement;

                    const input = new InputInfo(element);

                    expect(input.type).to.equal(element.type);
                    expect(input.id).to.equal(element.id);
                    expect(input.name).to.equal(element.name);
                    expect(input.placeholder).to.equal(element.placeholder);
                },
                'populates label': () => {
                    const element = {} as HTMLInputElement;
                    const labelElement = ({} as HTMLLabelElement);
                    const labelText = 'input label';
                    htmlUtilStub.getLabel.returns(labelElement);
                    htmlUtilStub.getText.returns(labelText);

                    const input = new InputInfo(element);

                    expect(htmlUtil.getLabel).to.be.calledOnce.calledWithExactly(element);
                    expect(htmlUtil.getText).to.be.calledOnce.calledWithExactly(labelElement);
                    expect(input.label).to.equal(labelText);
                }
            },
            isValid: () => {
                expect(InputInfo.isValid(mockInput({type: 'text'})), 'not visible').to.be.false;
                expect(InputInfo.isValid(mockInput({type: 'button'}, {})), 'invalid type').to.be.false;
                expect(InputInfo.isValid(mockInput({}, {})), 'default type').to.be.true;
                expect(InputInfo.isValid(mockInput({type: 'text'}, {})), 'type = text').to.be.true;
                expect(InputInfo.isValid(mockInput({type: 'password'}, {})), 'type = password').to.be.true;
                expect(InputInfo.isValid(mockInput({type: 'email'}, {})), 'type = email').to.be.true;
                expect(InputInfo.isValid(mockInput({type: 'tel'}, {})), 'type = tel').to.be.true;
            },
            isNotEmpty: () => {
                expect(new InputInfo(mockInput({})).isEmpty, 'only default type').to.be.true;
                expect(new InputInfo(mockInput({type: 'text'})).isEmpty, 'only type').to.be.true;
                expect(new InputInfo(mockInput({type: 'password'})).isEmpty, 'password type').to.be.false;
                expect(new InputInfo(mockInput({id: 'id'})).isEmpty).to.be.false;
                expect(new InputInfo(mockInput({name: 'name'})).isEmpty).to.be.false;
                expect(new InputInfo(mockInput({placeholder: 'placeholder'})).isEmpty).to.be.false;

                htmlUtilStub.getLabel.returns({} as HTMLLabelElement);
                htmlUtilStub.getText.returns('label');
                expect(new InputInfo(mockInput({})).isEmpty, 'has label').to.be.false;
            }
        }
    }
};