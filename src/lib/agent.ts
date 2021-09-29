
export async function get<T>(url: string, query: Record<string, string> = {}, headers: Record<string, string> = {}): Promise<T> {
    const request = new URL(url);
    Object.entries(query).forEach(([key, value]) => request.searchParams.append(key, value));

    const response = await fetch(request.toString(), {headers});

    if (response.ok) return JSON.parse(await response.text());
    throw new Error(response.statusText);
}

export async function list<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
    const response = await fetch(url, {method: 'LIST', headers});

    if (response.ok) return JSON.parse(await response.text());
    throw new Error(response.statusText);
}

export async function post<T>(url: string, headers: Record<string, string> = {}, body?: Record<string, unknown>): Promise<T> {
    const response = await fetch(url, {method: 'POST', headers, body: body && JSON.stringify(body)});

    if (response.ok) {
        const body = await response.text();
        return body && JSON.parse(body);
    }
    throw new Error(response.statusText);
}
