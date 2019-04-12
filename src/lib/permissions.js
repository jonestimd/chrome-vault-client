const normalizeUrl = (url) => url.replace(/\/*$/, '') + '/';

async function isUrlAllowed(url) {
    const normalizedUrl = normalizeUrl(url);
    return new Promise(resolve => {
        chrome.permissions.getAll(({origins}) => {
            resolve(origins && origins.some(origin => normalizedUrl.startsWith(origin.replace(/\*$/, ''))));
        })
    });
}

export async function requestOrigin(baseUrl) {
    if (await isUrlAllowed(baseUrl)) return true;
    const normalizedUrl = normalizeUrl(baseUrl) + '*';
    return new Promise(resolve => {
        chrome.permissions.request({origins: [normalizedUrl]}, (granted) => resolve(granted));
    });
}