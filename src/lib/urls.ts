
export function getHostname(hostOrUrl: string) {
    try {
        return new URL(hostOrUrl).hostname;
    } catch (error) {
        return hostOrUrl;
    }
}

export function getDomain(url: string) {
    const hostname = getHostname(url);
    const parts = hostname.split('.');
    return parts.length > 2 ? parts.slice(-2).join('.') : hostname;
}
