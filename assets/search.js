const root = new URL('../', import.meta.url);
const urlFor = path => new URL(path.replace(/^\//, ''), root).href;
const normalize = text => text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const slug = text => normalize(text).trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const match = (text, query) => normalize(query).trim().split(/\s+/).every(word => normalize(text).includes(word));
let indexPromise;
function index() {
  if (!indexPromise) indexPromise = fetch(new URL('assets/search-data.json', root))
    .then(response => { if (!response.ok) throw new Error('Search index unavailable'); return response.json(); })
    .then(data => data.entries).catch(error => { indexPromise = null; throw error; });
  return indexPromise;
}
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function setupSiteSearch() {
  const open = el('button', 'Search site', 'static-search-toggle');
  open.type = 'button';
  open.dataset.siteSearch = '';
  open.setAttribute('aria-haspopup', 'dialog');
  const dialog = el('dialog', '', 'static-search-dialog');
  dialog.setAttribute('aria-labelledby', 'static-search-title');
  const heading = el('h2', 'Search this site');
  heading.id = 'static-search-title';
  const close = el('button', 'Close', 'static-search-close');
  close.type = 'button';
  close.addEventListener('click', () => dialog.close());
  const form = el('form');
  form.setAttribute('role', 'search');
  const input = el('input');
  input.type = 'search';
  input.placeholder = 'Products, catalog numbers, services, articles…';
  input.setAttribute('aria-label', 'Search all pages');
  const scope = el('select');
  scope.setAttribute('aria-label', 'Search category');
  for (const [value, title] of [['', 'All content'], ['product', 'Products'], ['article', 'Articles'], ['page', 'Pages']]) {
    scope.add(new Option(title, value));
  }
  const status = el('p');
  status.setAttribute('role', 'status');
  const results = el('div', '', 'static-search-results');
  form.append(input, scope);
  dialog.append(close, heading, form, status, results);
  document.body.append(open, dialog);
  let request = 0;
  async function search() {
    const current = ++request;
    results.replaceChildren();
    if (!input.value.trim()) { status.textContent = 'Enter a name, catalog number, or keyword.'; return; }
    status.textContent = 'Searching…';
    try {
      const entries = await index();
      if (current !== request) return;
      const found = entries.filter(entry => (!scope.value || entry.type === scope.value) &&
        match(`${entry.title} ${entry.body} ${(entry.tags || []).join(' ')}`, input.value));
      found.sort((a, b) => Number(match(b.title, input.value)) - Number(match(a.title, input.value)));
      status.textContent = `${found.length} result${found.length === 1 ? '' : 's'} found.`;
      found.forEach(entry => {
        const item = el('article', '', 'static-search-result');
        const link = el('a', entry.title);
        link.href = urlFor(entry.path);
        const title = el('h3');
        title.append(link);
        item.append(title, el('small', entry.type), el('p', entry.excerpt));
        results.append(item);
      });
    } catch { if (current === request) status.textContent = 'Search could not load. Check your connection and try again.'; }
  }
  open.addEventListener('click', () => { dialog.showModal(); input.focus(); search(); });
  form.addEventListener('submit', event => { event.preventDefault(); search(); });
  input.addEventListener('input', search);
  scope.addEventListener('change', search);
  dialog.addEventListener('close', () => open.focus());

  // Keep existing tag controls and article tags inside the static site.
  document.querySelectorAll('a[href*="/tag/"], .post-tags .single-tag').forEach(node => {
    const tag = node.tagName === 'A' ? new URL(node.href).pathname.split('/tag/')[1]?.split('/')[0] : slug(node.textContent);
    if (!tag) return;
    const link = node.tagName === 'A' ? node : el('a', node.textContent);
    link.href = urlFor(`articles/?tag=${encodeURIComponent(tag)}`);
    if (node !== link) node.replaceChildren(link);
  });
  if (new URLSearchParams(location.search).has('s') && location.pathname === root.pathname) {
    location.replace(urlFor(`articles/${location.search}`));
  }
}

export function setupArticleSearch(form) {
  const cards = [...document.querySelectorAll('.post-container')];
  const input = form.elements.namedItem('s');
  if (!input) return () => {};
  const container = document.querySelector('.results-container') || cards[0]?.parentElement;
  if (!container) return () => {};
  const status = el('p');
  status.setAttribute('role', 'status');
  container.prepend(status);
  const params = new URLSearchParams(location.search);
  input.value = params.get('s') || '';
  input.setAttribute('aria-label', 'Search article text');
  const tag = params.get('tag') || location.pathname.match(/\/tag\/([^/]+)/)?.[1] || '';
  const clear = el('a', 'Clear search and tag');
  clear.href = urlFor('articles/');
  form.append(clear);
  let sequence = 0;
  async function apply() {
    const current = ++sequence;
    const query = new URLSearchParams(location.search);
    if (input.value) query.set('s', input.value); else query.delete('s');
    history.replaceState(null, '', `${location.pathname}${query.size ? '?' + query : ''}${location.hash}`);
    status.textContent = 'Searching…';
    try {
      const entries = await index();
      if (current !== sequence) return;
      let count = 0;
      cards.forEach(card => {
        const link = card.querySelector('.post-title a');
        const entry = entries.find(entry => entry.type === 'article' && urlFor(entry.path) === link?.href);
        card.hidden = !(match(entry ? `${entry.title} ${entry.body}` : card.textContent, input.value) &&
          (!tag || entry?.tags?.some(value => slug(value) === tag)));
        if (!card.hidden) count++;
      });
      status.textContent = `${count} article${count === 1 ? '' : 's'} found${tag ? ' for tag “' + tag.replaceAll('-', ' ') + '”' : ''}.`;
    } catch {
      if (current !== sequence) return;
      cards.forEach(card => { card.hidden = Boolean(tag) || !match(card.textContent, input.value); });
      status.textContent = tag ? 'Tag search could not load. Check your connection and try again.' :
        'Full-text search is unavailable. Showing matches in titles and summaries only.';
    }
  }
  input.addEventListener('input', apply);
  apply();
  return apply;
}
