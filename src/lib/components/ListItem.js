export function newListItem(text) {
    const li = document.createElement('li');
    li.className = 'mdc-list-item';
    li.innerHTML = `<span class="mdc-list-item__text">${text}</span>`;
    return li;
}