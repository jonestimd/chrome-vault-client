/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMessage(err: any): string | undefined {
    return typeof err.message === 'string' ? err.message : undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getStatus(err: any): number {
    return typeof err.status === 'number' ? err.status : 0;
}
