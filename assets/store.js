import { normalizeBasket, addItem, setQuantity, basketSummary, removeSubmitted, MAX_QUANTITY } from './store-core.js';

const money = cents => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const button = (text, action, className) => {
  const node = el('button', text, className);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
};

export async function setupStore(root, requestTools) {
  const css = el('link');
  css.rel = 'stylesheet'; css.href = new URL('assets/store.css', root);
  document.head.append(css);
  const response = await fetch(new URL('assets/store-data.json', root));
  if (!response.ok) throw new Error('Store catalog unavailable');
  const { products } = await response.json();
  const url = path => new URL(path.replace(/^\//, ''), root).href;
  const key = `recepton-basket:v1:${root.pathname}`;
  let memory = [];
  let storage = null;
  let storageName = '';
  let storageChoices = ['localStorage', 'sessionStorage'];
  try { if (sessionStorage.getItem(key) !== null) storageChoices = ['sessionStorage', 'localStorage']; } catch {}
  for (const name of storageChoices) {
    try {
      const candidate = window[name]; candidate.setItem(key + ':probe', '1'); candidate.removeItem(key + ':probe');
      storage = candidate; storageName = name; break;
    } catch {}
  }
  let storageAvailable = Boolean(storage);
  const read = () => {
    try { return normalizeBasket(JSON.parse(storage?.getItem(key) || '[]'), products); }
    catch { return memory; }
  };
  let items = read();
  const toast = el('div', '', 'store-toast');
  toast.hidden = true; toast.setAttribute('role', 'status');
  const basketLink = el('a', '', 'store-basket-link');
  basketLink.href = url('basket/');
  document.body.append(basketLink, toast);
  const updateCount = () => { basketLink.textContent = `Basket (${basketSummary(items, products).units})`; };
  updateCount();
  let refreshPage = () => {};
  function write(next, notify = true) {
    const normalized = normalizeBasket(next, products);
    try { if (!storage) throw new Error(); storage.setItem(key, JSON.stringify(normalized)); }
    catch {
      try {
        if (storageName === 'sessionStorage') throw new Error();
        storage = sessionStorage; storage.setItem(key, JSON.stringify(normalized)); storageName = 'sessionStorage';
      } catch { storageAvailable = false; throw new Error('Your browser cannot save a basket. Allow site storage or contact us to request products.'); }
    }
    items = normalized; memory = items;
    updateCount();
    if (notify) refreshPage();
  }
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    items = read(); updateCount(); refreshPage();
  });
  const note = 'Prices are estimates from published order options. Availability, shipping, taxes and final pricing will be confirmed before an order is accepted. No payment is taken here.';
  const estimateText = summary => summary.quoteLines ?
    `${summary.lines.some(line => line.totalCents !== null) ? money(summary.estimateCents) + ' + ' : ''}quote required` : money(summary.estimateCents);
  function summaryBox(summary) {
    const box = el('aside', undefined, 'store-summary store-card');
    box.append(el('h2', 'Order summary'), el('p', `${summary.lines.length} selection${summary.lines.length === 1 ? '' : 's'} · ${summary.units} unit${summary.units === 1 ? '' : 's'}`),
      el('p', `Products estimate: ${estimateText(summary)}`, 'store-price'), el('p', note, 'store-note'));
    if (storageName === 'sessionStorage') box.append(el('p', 'Basket is saved for this browser tab only.', 'store-status'));
    return box;
  }
  function basketText(summary) {
    return summary.lines.map((line, index) => [
      `Product ${index + 1}: ${line.product.sku} — ${line.product.name}`,
      `Size: ${line.option.size}; formulation: ${line.option.formulation}`,
      `Quantity: ${line.quantity}`,
      line.totalCents === null ? 'Price: quote required' : `Unit estimate: ${money(line.option.priceCents)}; line estimate: ${money(line.totalCents)}`
    ].join('\n')).join('\n\n') + `\n\nProducts estimate: ${estimateText(summary)}\n${note}`;
  }

  const picker = el('dialog', undefined, 'store-picker');
  document.body.append(picker);
  function choose(choices) {
    if (!choices.length) return;
    picker.replaceChildren();
    const heading = el('h2', 'Add protein to basket'); heading.id = 'store-picker-title';
    picker.setAttribute('aria-labelledby', heading.id);
    const close = button('Close', () => picker.close());
    const form = el('form');
    const variant = el('select'); variant.required = true;
    choices.forEach(product => variant.add(new Option(`${product.sku} — ${product.name}`, product.id)));
    const size = el('select'); size.required = true;
    const quantity = el('input'); quantity.type = 'number'; quantity.min = '1'; quantity.max = String(MAX_QUANTITY); quantity.step = '1'; quantity.value = '1'; quantity.required = true;
    const status = el('p', '', 'store-status'); status.setAttribute('role', 'status');
    const field = (label, input) => { const wrap = el('label', label, 'store-field'); wrap.append(input); return wrap; };
    function sizes() {
      size.replaceChildren();
      const product = choices.find(product => product.id === variant.value);
      product.options.forEach(option => size.add(new Option(`${option.size} · ${option.formulation} · ${option.priceCents === null ? 'Quote required' : money(option.priceCents)}`, option.id)));
    }
    variant.addEventListener('change', sizes); sizes();
    const add = el('button', 'Add to basket', 'store-primary'); add.type = 'submit';
    if (!storageAvailable) {
      add.disabled = true;
      status.textContent = 'Your browser blocks basket storage. Allow site storage or contact us to request products.';
      const contact = el('a', 'Contact us'); contact.href = url('contact/'); form.append(contact);
    }
    form.append(field('Protein / construct', variant), field('Size and estimated unit price', size), field('Quantity', quantity), el('p', 'For quote-only products, describe your required size in checkout notes.', 'store-note'), add, status);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      try {
        write(addItem(read(), products, variant.value, size.value, Number(quantity.value)));
        picker.close();
        toast.replaceChildren(el('span', 'Added to basket. '));
        const view = el('a', 'View basket'); view.href = url('basket/'); toast.append(view); toast.hidden = false;
      } catch (error) { status.textContent = error.message; }
    });
    picker.append(close, heading, form); picker.showModal();
  }

  function addControl(container, choices) {
    if (!choices.length) return;
    const wrap = el('div', undefined, 'store-product-action');
    const priced = choices.flatMap(product => product.options).filter(option => option.priceCents !== null);
    wrap.append(el('p', priced.length ? `From ${money(Math.min(...priced.map(option => option.priceCents)))} · estimated` : 'Price and availability on request', 'store-note'),
      button(choices.length > 1 ? 'Choose protein / size' : 'Add to basket', () => choose(choices), 'store-primary'));
    container.append(wrap);
  }
  document.querySelectorAll('.single-search-result').forEach(card => {
    const link = card.querySelector('.single-result-title a') || card.querySelector('a');
    if (!link) return;
    const pathname = new URL(link.href).pathname;
    addControl(card, products.filter(product => new URL(url(product.path)).pathname === pathname));
  });
  const pageProducts = products.filter(product => new URL(url(product.path)).pathname === location.pathname);
  if (pageProducts.length) {
    const container = document.querySelector('.single-product-attributes-table')?.parentElement || document.querySelector('#main .post-content');
    if (container) {
      document.querySelectorAll('#main table').forEach(table => {
        let added = false;
        for (const row of table.querySelectorAll('tr')) {
          const sku = row.cells[0]?.textContent.trim().replace(/\*$/, '');
          const product = pageProducts.find(product => product.sku.toLowerCase() === sku?.toLowerCase());
          if (!product) continue;
          if (row.querySelector('td.btnOrder a')) continue;
          const cell = el('td'); cell.append(button('Add to basket', () => choose([product]), 'store-primary')); row.append(cell);
          added = true;
        }
        if (added) table.querySelector('tr')?.append(el('th', 'Basket'));
      });
      addControl(container, pageProducts);
    }
  }
  document.querySelectorAll('td.btnOrder a').forEach(link => {
    const sku = link.closest('tr')?.cells[0]?.textContent.trim();
    const product = products.find(product => product.sku === sku);
    if (!product) return;
    link.textContent = 'Add to basket';
    link.addEventListener('click', event => { event.preventDefault(); choose([product]); });
  });

  let mount = document.querySelector('[data-store-page]');
  const oldOrder = document.querySelector('.quform-form');
  if (oldOrder && /\/order\/$/.test(location.pathname)) {
    mount = el('section', undefined, 'store-container'); mount.dataset.storePage = 'checkout';
    document.querySelector('#main .post-content').replaceChildren(mount);
  }
  if (!mount) return;
  const isCheckout = mount.dataset.storePage === 'checkout';
  const heading = el('h1', isCheckout ? 'Checkout' : 'Your basket', 'store-heading');
  const content = el('div'); mount.replaceChildren(heading, content);
  const productQuery = new URLSearchParams(location.search).get('product');

  function empty() {
    const box = el('div', undefined, 'store-empty store-card');
    const browse = el('a', 'Browse proteins', 'store-primary'); browse.href = url('proteins/');
    box.append(el('h2', 'Your basket is empty'), el('p', 'Choose a protein and pack size to start your order request.'), browse);
    if (!storageAvailable) box.append(el('p', 'Your browser blocks basket storage. Allow site storage to use checkout, or contact us to request products.', 'store-status'));
    content.replaceChildren(box);
  }
  function renderBasket() {
    const summary = basketSummary(items, products);
    if (!summary.lines.length) { empty(); return; }
    const grid = el('div', undefined, 'store-grid');
    const list = el('div');
    summary.lines.forEach(line => {
      const card = el('article', undefined, 'store-line store-card');
      const name = el('a', `${line.product.sku} — ${line.product.name}`); name.href = url(line.product.path);
      const detail = el('div'); detail.append(name, el('p', `${line.option.size} · ${line.option.formulation}`),
        el('p', line.totalCents === null ? 'Quote required' : `${money(line.option.priceCents)} each · ${money(line.totalCents)} estimated`, 'store-price'));
      const quantity = el('input'); quantity.type = 'number'; quantity.min = '1'; quantity.max = String(MAX_QUANTITY); quantity.step = '1'; quantity.required = true; quantity.value = String(line.quantity);
      quantity.setAttribute('aria-label', `Quantity for ${line.product.sku}, ${line.option.size}`);
      const feedback = el('p', '', 'store-status'); feedback.setAttribute('role', 'status');
      quantity.addEventListener('change', () => {
        if (!quantity.reportValidity()) return;
        try { write(setQuantity(read(), products, line.productId, line.optionId, Number(quantity.value))); }
        catch (error) { feedback.textContent = error.message; }
      });
      const edit = el('div'); edit.append(el('label', 'Quantity'), quantity,
        button('Remove', () => write(setQuantity(read(), products, line.productId, line.optionId, 0)), 'store-remove'), feedback);
      card.append(detail, edit); list.append(card);
    });
    const aside = summaryBox(summary);
    const checkout = el('a', 'Checkout', 'store-primary'); checkout.href = url('checkout/');
    const browse = el('a', 'Continue browsing'); browse.href = url('proteins/');
    const actions = el('div', undefined, 'store-actions'); actions.append(checkout, browse);
    aside.append(actions); grid.append(list, aside); content.replaceChildren(grid);
  }

  function renderCheckout() {
    refreshPage = renderCheckout;
    let summary = basketSummary(items, products);
    if (!summary.lines.length) { empty(); return; }
    const grid = el('div', undefined, 'store-grid');
    const form = el('form', undefined, 'store-card'); form.action = '#'; form.noValidate = true; form.dataset.storeCheckout = '';
    const fields = el('div', undefined, 'store-fields');
    const input = (label, name, type = 'text', required = true, autocomplete = '') => {
      const wrap = el('label', `${label}${required ? ' *' : ''}`, 'store-field');
      const field = el(type === 'textarea' ? 'textarea' : 'input');
      if (type !== 'textarea') field.type = type;
      field.name = name; field.required = required; if (autocomplete) field.autocomplete = autocomplete;
      wrap.append(field); return wrap;
    };
    fields.append(input('First name', 'quform_1_58', 'text', true, 'given-name'), input('Last name', 'quform_1_62', 'text', true, 'family-name'),
      input('Email', 'customer-email', 'email', true, 'email'), input('Phone', 'customer-phone', 'tel', false, 'tel'),
      input('Institution / company', 'institution', 'text', false, 'organization'), input('Address', 'shipping-address', 'text', true, 'street-address'),
      input('Postal code', 'postal-code', 'text', true, 'postal-code'), input('City', 'city', 'text', true, 'address-level2'),
      input('Country', 'country', 'text', true, 'country-name'), input('Order notes / requested size for quote items', 'order-notes', 'textarea', false));
    const basket = input('Basket items and estimate', 'basket-items', 'textarea', false);
    basket.classList.add('store-basket-details'); const basketField = basket.querySelector('textarea'); basketField.readOnly = true; basketField.rows = 12; basketField.value = basketText(summary);
    const consent = input('I agree to be contacted about this order request and have read the privacy policy', 'order-consent', 'checkbox');
    const privacy = el('a', 'Privacy policy'); privacy.href = url('privacy-policy/'); consent.append(privacy);
    const review = el('button', 'Review order request', 'store-primary'); review.type = 'submit';
    form.append(el('h2', 'Contact and delivery details'), fields, basket, consent, review);
    const request = requestTools(form, true);
    let submittedItems = [];
    let completed = false;
    let pending = false;
    form.addEventListener('submit', event => {
      event.preventDefault();
      items = read(); refreshPage();
      if (!items.length) return;
      if (request.preview()) submittedItems = items.map(item => ({ ...item }));
    });
    form.addEventListener('recepton:request-started', () => { pending = true; });
    form.addEventListener('recepton:request-finished', () => { pending = false; refreshPage(); });
    form.addEventListener('recepton:request-submitted', () => {
      completed = true;
      try { write(removeSubmitted(read(), submittedItems, products), false); }
      catch { form.append(el('p', 'Request was sent, but this browser could not update the saved basket. Do not submit it again.', 'store-status')); }
      review.disabled = true;
      form.querySelector('.static-form-intro').textContent = 'Order request submitted. We will contact you to confirm availability, delivery and final pricing. No payment has been taken.';
      form.querySelectorAll('input, select, textarea, .static-actions button').forEach(field => { if (field.closest('.static-request-preview')) return; field.disabled = true; });
      const next = el('a', 'Continue browsing', 'store-primary'); next.href = url('proteins/'); form.append(next);
    });
    let aside = summaryBox(summary);
    const edit = el('a', 'Edit basket'); edit.href = url('basket/'); aside.append(edit);
    grid.append(form, aside); content.replaceChildren(grid);
    refreshPage = () => {
      if (completed || pending) return;
      const nextSummary = basketSummary(items, products);
      if (JSON.stringify(nextSummary.lines.map(line => [line.productId, line.optionId, line.quantity])) ===
          JSON.stringify(summary.lines.map(line => [line.productId, line.optionId, line.quantity]))) return;
      summary = nextSummary; basketField.value = basketText(summary); form.dispatchEvent(new Event('input', { bubbles: true }));
      const replacement = summaryBox(summary); const link = el('a', 'Edit basket'); link.href = url('basket/'); replacement.append(link); aside.replaceWith(replacement); aside = replacement;
      review.disabled = !summary.lines.length;
    };
  }
  if (isCheckout) renderCheckout();
  else { refreshPage = renderBasket; renderBasket(); }
  if (productQuery) {
    const choices = products.filter(product => product.sku === productQuery || product.sku.startsWith(productQuery + '-') || product.id === productQuery.toLowerCase());
    if (choices.length) choose(choices);
  }
}
