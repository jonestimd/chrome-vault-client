const normalizeUrl = (url: string) => url.replace(/\/$/, '') + '/';

export async function requestOrigin(baseUrl: string): Promise<boolean> {
    const normalizedUrl = normalizeUrl(baseUrl) + '*';
    return new Promise(resolve => {
        chrome.permissions.request({origins: [normalizedUrl]}, resolve);
    });
}