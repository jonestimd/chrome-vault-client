export interface LoginMessage {
    username?: string
    password?: string
    email?: string
}

export interface InputInfo {
    id?: string;
    name?: string;
    label?: string;
    visible: boolean;
}

export interface PageInfoMessage {
    username: boolean
    password: boolean
    email: boolean
    url: string
    inputs: InputInfo[];
}