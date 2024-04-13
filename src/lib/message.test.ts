import * as htmlUtil from './htmlUtil';
import {InputInfo} from './message';

jest.mock('./htmlUtil');

const mockHtmlUtil = htmlUtil as jest.Mocked<typeof htmlUtil>;

function mockInput(props: {type?: string, id?: string, name?: string, placeholder?: string}, rect?: object): HTMLInputElement {
    const element = props as HTMLInputElement;
    element.getClientRects = jest.fn().mockReturnValue(rect && [rect] || []);
    return element;
}

describe('message', () => {
    describe('InputInfo', () => {
        describe('constructor', () => {
            it('copies props from input', () => {
                const element = {
                    type: 'text',
                    id: 'input id',
                    name: 'input name',
                    placeholder: 'input placeholder',
                } as HTMLInputElement;

                const input = new InputInfo(element);

                expect(input.type).toEqual(element.type);
                expect(input.id).toEqual(element.id);
                expect(input.name).toEqual(element.name);
                expect(input.placeholder).toEqual(element.placeholder);
            });
            it('populates label', () => {
                const element = {} as HTMLInputElement;
                const labelElement = ({} as HTMLLabelElement);
                const labelText = 'input label';
                mockHtmlUtil.getLabel.mockReturnValue(labelElement);
                mockHtmlUtil.getText.mockReturnValue(labelText);

                const input = new InputInfo(element);

                expect(htmlUtil.getLabel).toHaveBeenCalledTimes(1);
                expect(htmlUtil.getLabel).toHaveBeenCalledWith(element);
                expect(htmlUtil.getText).toHaveBeenCalledTimes(1);
                expect(htmlUtil.getText).toHaveBeenCalledWith(labelElement);
                expect(input.label).toEqual(labelText);
            });
        });
        describe('isValid', () => {
            const params = [
                {name: 'returns false for not visible', props: {type: 'text'}, result: false},
                {name: 'returns false for invalid type', props: {type: 'button'}, rect: {}, result: false},
                {name: 'returns true for default type', props: {}, rect: {}, result: true},
                {name: 'returns true for type = text', props: {type: 'text'}, rect: {}, result: true},
                {name: 'returns true for type = password', props: {type: 'password'}, rect: {}, result: true},
                {name: 'returns true for type = email', props: {type: 'email'}, rect: {}, result: true},
                {name: 'returns true for type = tel', props: {type: 'tel'}, rect: {}, result: true},
            ];
            params.forEach(({name, props, rect, result}) => it(name, () => {
                expect(InputInfo.isValid(mockInput(props, rect))).toEqual(result);
            }));
        });
        describe('isEmpty', () => {
            const params = [
                {name: 'returns true for only default type', props: {}, result: true},
                {name: 'returns true for only type', props: {type: 'text'}, result: true},
                {name: 'returns false for password type', props: {type: 'password'}, result: false},
                {name: 'returns false for id', props: {id: 'id'}, result: false},
                {name: 'returns false for name', props: {name: 'name'}, result: false},
                {name: 'returns false for placeholder', props: {placeholder: 'placeholder'}, result: false},
            ];
            params.forEach(({name, props, result}) => it(name, () => {
                mockHtmlUtil.getLabel.mockReturnValue(undefined);

                expect(new InputInfo(mockInput(props)).isEmpty).toEqual(result);
            }));

            it('returns false for label', () => {
                mockHtmlUtil.getLabel.mockReturnValue({} as HTMLLabelElement);
                mockHtmlUtil.getText.mockReturnValue('label');

                expect(new InputInfo(mockInput({})).isEmpty).toEqual(false);
            });
        });
    });
});

