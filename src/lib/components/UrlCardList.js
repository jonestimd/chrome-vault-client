const html = (href, url, vaultPaths) =>
`<div class="mcd-card__primary-action">
    <div class="mdc-typography--headline6"><a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a></div>
    <div class="mdc-typography--body2"><ul>
        ${vaultPaths.map(path => `<li>${path}</li>`).join('')}
    </ul></div>
</div>`;

function removeClass(element, toRemove) {
    element.className = element.className.split(/ +/).filter(name => name !== toRemove).join(' ');
}

function addClass(element, toAdd) {
    const classList = element.className.split(/ +/);
    element.className = classList.includes(toAdd) ? element.className : `${element.className} ${toAdd}`;
}

function emphasize(element, value, search) {
    element.innerHTML = value.replace(RegExp(search, 'gi'), (match) => `<em>${match}</em>`);
}

function Card(parent, url, vaultPaths) {
    const href = url.match(/^https?:\/\//) ? url : 'https://' + url;
    const card = document.createElement('div');
    card.className = 'mdc-card vault-url-card mdc-elevation--z4';
    card.innerHTML = html(href, url, vaultPaths);
    parent.appendChild(card);

    function addEmphasis(search) {
        emphasize(card.querySelector('a'), url, search);
        card.querySelectorAll('li').forEach((li, i) => emphasize(li, vaultPaths[i], search));
    }

    function removeEmphasis() {
        card.querySelector('a').innerHTML = url;
        card.querySelectorAll('li').forEach((li, i) => li.innerHTML = vaultPaths[i]);
    }
    
    this.remove = () => parent.removeChild(card);

    this.applyFilter = (search) => {
        if (vaultPaths.concat(url).some(value => value.toLowerCase().includes(search))) removeClass(card, 'hidden');
        else addClass(card, 'hidden');
        addEmphasis(search);
    };

    this.show = () => {
        removeClass(card, 'hidden');
        removeEmphasis();
    };
}

export default function UrlCardList(element) {
    const cards = [];
    
    this.removeAll = () => cards.splice(0, cards.length).forEach(card => card.remove());

    this.addCard = (url, vaultPaths) => cards.push(new Card(element, url, vaultPaths));

    this.filterCards = (text) => {
        const search = text.toLowerCase();
        cards.forEach(card => card.applyFilter(search));
    }

    this.showAll = () => cards.forEach(card => card.show());
}