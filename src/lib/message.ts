export interface LoginInput {
    frameId: string;
    refId: number;
    value: string;
}

export const inputTypes = ['text', 'email', 'password', 'tel'] as const;
export type InputType = typeof inputTypes[number];

export interface InputInfoProps {
    frameId: string;
    refId: number;
    id?: string;
    name?: string;
    label?: string;
    placeholder?: string;
    type: string;
}

export interface PageInfoMessage {
    url: string
    inputs: InputInfoProps[];
}
