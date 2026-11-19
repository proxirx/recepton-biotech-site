/* Restore browser-only controls while keeping server submissions disabled. */
(() => {
  const root = new URL('../', document.currentScript.src);
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = new URL('assets/static.css', root);
  document.head.appendChild(css);
  const handlers = new WeakMap();
  const normalize = value => value.toLowerCase().replace(/\s+/g, ' ').trim();
  const matches = (text, query) => normalize(query).split(' ').every(word => text.includes(word));

  function notice(container, text) {
    let status = container.querySelector('[data-static-status]');
    if (!status) {
      status = document.createElement('p');
      status.dataset.staticStatus = '';
      status.setAttribute('role', 'status');
      container.appendChild(status);
    }
    status.textContent = text;
    return status;
  }

  document.addEventListener('submit', event => {
    const form = event.target.closest('form[data-static-form]');
    if (!form) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (handlers.has(form)) handlers.get(form)(event);
    else notice(form, 'This form is not connected yet. No message has been sent.');
  }, true);

  function catalog(form) {
    const cards = [...document.querySelectorAll('.single-search-result')];
    if (!cards.length) return;
    const container = cards[0].parentElement;
    const products = cards.map(card => {
      const attributes = {};
      card.querySelectorAll('tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 2) attributes[normalize(cells[0].textContent)] = normalize(cells[1].textContent);
      });
      return { card, attributes, title: normalize(card.querySelector('.single-result-title').textContent),
        text: normalize(card.textContent) };
    });
    const groups = { 'cell-tag[]': 'tag', 'expression-host[]': 'expression host', 'origins[]': 'origin' };
    const aliases = { his: 'histag', strep: 'streptag', ecoli: 'e-coli', hek: 'hek293', 'homo-sapiens': 'homo sapiens' };
    const status = notice(container, '');
    container.prepend(status);
    form.elements.namedItem('full_product_name').setAttribute('aria-label', 'Search products');
    form.elements.namedItem('sortBy').setAttribute('aria-label', 'Sort products');
    const clear = document.createElement('button');
    clear.type = 'reset';
    clear.textContent = 'Clear filters';
    clear.style.marginLeft = '10px';
    form.appendChild(clear);

    function apply() {
      const data = new FormData(form);
      const sort = data.get('sortBy') || 'cnAsc';
      const key = sort.startsWith('alph') ? 'title' : 'catalog number';
      let count = 0;
      products.sort((a, b) => {
        const left = key === 'title' ? a.title : a.attributes[key];
        const right = key === 'title' ? b.title : b.attributes[key];
        return left.localeCompare(right, 'en', { numeric: true }) * (sort.endsWith('Desc') ? -1 : 1);
      }).forEach(product => {
        const visible = matches(product.text, data.get('full_product_name') || '') &&
          Object.entries(groups).every(([name, attribute]) => {
            const selected = data.getAll(name);
            const values = (product.attributes[attribute] || '').split(',').map(normalize);
            return !selected.length || selected.some(value => values.includes(aliases[value] || value));
          });
        product.card.hidden = !visible;
        container.appendChild(product.card);
        if (visible) count++;
      });
      status.textContent = count ? `${count} product${count === 1 ? '' : 's'} found.` : 'No products match these filters.';
      const query = new URLSearchParams(data);
      history.replaceState(null, '', `${location.pathname}?${query}${location.hash}`);
    }
    const params = new URLSearchParams(location.search);
    for (const field of form.elements) {
      if (!field.name) continue;
      if (field.type === 'checkbox') field.checked = params.getAll(field.name).includes(field.value);
      else if (params.has(field.name)) field.value = params.get(field.name);
    }
    handlers.set(form, apply);
    form.addEventListener('input', apply);
    form.addEventListener('change', apply);
    form.addEventListener('reset', () => queueMicrotask(apply));
    apply();
  }

  function orderWizard(form, requestTools) {
    const pages = [...form.querySelectorAll('.quform-element-page')];
    if (!pages.length) return;
    let current = 0;
    const options = JSON.parse(form.dataset.options);
    const logic = options.logic.logic;
    const selected = new URLSearchParams(location.search).get('product');
    const productField = form.elements.namedItem('quform_1_22');
    if (selected) {
      const option = [...productField.options].find(option => option.value === selected || option.value.startsWith(selected + ' '));
      if (option) productField.value = option.value;
      else {
        productField.add(new Option(selected + ' (please confirm availability)', selected));
        productField.value = selected;
        notice(form, 'Selected catalog entry is not in the original order list. It will be included as a request for confirmation.');
      }
    }
    const request = requestTools(form, true);
    form.querySelector('.quform-submit').textContent = 'Review request';
    for (const id of [32, 42, 50]) form.elements.namedItem(`quform_1_${id}`).type = 'checkbox';
    form.querySelectorAll('.quform-element-required .quform-field').forEach(field => { field.required = true; });
    for (const id of [30, 39, 49, 57]) {
      const quantity = form.elements.namedItem(`quform_1_${id}`);
      quantity.type = 'number';
      quantity.min = '1';
      quantity.step = '1';
    }

    function conditions() {
      // The captured order form uses equality rules for its three extra product groups.
      Object.entries(logic).forEach(([id, condition]) => {
        const visible = condition.rules.every(rule => {
          const control = form.querySelector(`[name="quform_1_${rule.elementId}"]:checked`);
          return control && !control.disabled && control.value === rule.value;
        });
        const element = form.querySelector(`.quform-element-1_${id}`);
        element.hidden = !visible;
        element.querySelectorAll('input, select').forEach(field => {
          field.disabled = !visible;
          if (!['radio', 'checkbox'].includes(field.type)) field.required = visible;
        });
      });
    }

    function show() {
      pages.forEach((page, index) => {
        page.hidden = index !== current;
        page.classList.toggle('quform-current-page', index === current);
        page.style.display = index === current ? 'block' : 'none';
      });
      const percentage = Math.round((current + 1) / pages.length * 100);
      form.querySelector('.quform-page-progress-bar').style.width = `${percentage}%`;
      form.querySelector('.quform-page-progress-percentage').textContent = percentage;
    }

    handlers.set(form, event => {
      if (event.submitter?.classList.contains('quform-back')) {
        current = Math.max(0, current - 1);
      } else {
        const invalid = [...pages[current].querySelectorAll('input, select, textarea')]
          .find(field => !field.disabled && !field.checkValidity());
        if (invalid) { invalid.reportValidity(); return; }
        if (current === pages.length - 1) {
          request.preview();
          return;
        }
        current++;
      }
      show();
      pages[current].querySelector('input:not([type=hidden]), select, textarea')?.focus();
    });
    form.addEventListener('change', conditions);
    form.addEventListener('recepton:draft-loaded', () => { current = 0; show(); });
    conditions();
    show();
  }

  async function init() {
    const [{ requestTools }, search] = await Promise.all([
      import(new URL('assets/requests.js', root)), import(new URL('assets/search.js', root))
    ]);
    document.querySelectorAll('form[data-static-form]').forEach(form => {
      if (form.elements.namedItem('full_product_name')) catalog(form);
      else if (form.elements.namedItem('s')) handlers.set(form, search.setupArticleSearch(form));
      else if (form.classList.contains('quform-form')) orderWizard(form, requestTools);
      else {
        const request = requestTools(form);
        handlers.set(form, request.preview);
        form.querySelectorAll('input[type=submit]').forEach(button => { button.value = 'Review message'; });
      }
    });
    document.querySelectorAll('td.btnOrder a').forEach(link => {
      const row = link.closest('tr');
      const product = row?.cells[0]?.textContent.trim();
      if (!product) return;
      const target = new URL('order/', root);
      target.searchParams.set('product', product);
      link.href = target;
    });
    search.setupSiteSearch();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
