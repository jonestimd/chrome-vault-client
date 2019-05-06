const html = (href, url, vaultPaths) =>
`<div class="mcd-card__primary-action">
    <div class="mdc-typography--headline6"><a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a></div>
    <div class="mdc-typography--body2"><ul>
        ${vaultPaths.map(path => `<li>${path}</li>`).join('')}
    </ul></div>
</div>`;

export default function UrlCardList(element) {
    this.removeAll = () => element.innerHTML = '';

    this.addCard = (url, vaultPaths) => {
        const href = url.match(/^https?:\/\//) ? url : 'https://' + url;
        const card = document.createElement('div');
        card.className = 'mdc-card vault-url-card mdc-elevation--z4';
        card.innerHTML = html(href, url, vaultPaths);
        element.appendChild(card);
    }
}