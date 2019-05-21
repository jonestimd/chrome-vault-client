export interface LoginMessage {
    username?: string
    password?: string
    email?: string
}

export interface PageInfoMessage {
    username: boolean
    password: boolean
    email: boolean
    url: string
}