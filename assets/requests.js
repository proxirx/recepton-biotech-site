/* Local request preparation. Email delivery stays under the visitor's control. */
const recipient = 'office@receptonbiotech.com';
const controls = form => [...form.querySelectorAll('input, select, textarea')]
  .filter(field => field.name && !['hidden', 'submit', 'button', 'file'].includes(field.type) && !field.classList.contains('quform-field-tree'));

function label(field) {
  if (field.closest('.wpcf7-acceptance')) return 'Privacy consent';
  if (field.name === 'quform_1_80') return 'Preferred contact method';
  return (field.labels?.[0]?.textContent || field.closest('.quform-element')?.querySelector('.quform-label')?.textContent ||
    field.closest('p')?.childNodes[0]?.textContent || field.name).replace(/\s*\*\s*$/, '').trim();
}

function button(text, action) {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = text;
  node.addEventListener('click', action);
  return node;
}

export function requestTools(form, order = false) {
  const intro = document.createElement('p');
  intro.className = 'static-form-intro';
  intro.textContent = 'Prepare your request below, then send it using your email app. You can also copy or download it.';
  form.prepend(intro);
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.dataset.requestStatus = '';
  const draftBar = document.createElement('div');
  draftBar.className = 'static-actions';
  form.append(draftBar, status);
  const key = `recepton-draft:${location.pathname}:${form.querySelector('[name="_wpcf7"]')?.value || 'order'}`;
  const fields = controls(form);
  fields.forEach(field => {
    if (field.getAttribute('aria-required') === 'true' || field.closest('.wpcf7-acceptance:not(.optional)')) field.required = true;
    if (!field.labels?.length) field.setAttribute('aria-label', label(field));
  });

  let panel;
  function invalidate() {
    if (panel) panel.hidden = true;
  }
  form.addEventListener('input', invalidate);
  form.addEventListener('change', invalidate);
  form.addEventListener('reset', () => { invalidate(); status.textContent = ''; });
  draftBar.append(
    button('Save draft on this device', () => {
      try {
        const data = fields.filter(field => !field.disabled).map(field => ({ name: field.name, value: field.value, checked: field.checked }));
        localStorage.setItem(key, JSON.stringify(data));
        status.textContent = 'Draft saved on this device. Personal details remain here until you delete the saved draft.';
      } catch { status.textContent = 'This browser cannot save a draft. You can still copy or download your request.'; }
    }),
    button('Load saved draft', () => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) { status.textContent = 'No saved draft on this device.'; return; }
        const data = JSON.parse(raw);
        fields.forEach(field => {
          const item = data.find(item => item.name === field.name &&
            (!['checkbox', 'radio'].includes(field.type) || item.value === field.value));
          if (['checkbox', 'radio'].includes(field.type)) field.checked = item?.checked || false;
          else {
            if (order && field.tagName === 'SELECT' && label(field) === 'Choose product' && item?.value &&
                ![...field.options].some(option => option.value === item.value)) {
              field.add(new Option(item.value + ' (please confirm availability)', item.value));
            }
            field.value = item?.value || '';
          }
        });
        form.dispatchEvent(new Event('change', { bubbles: true }));
        form.dispatchEvent(new Event('recepton:draft-loaded'));
        status.textContent = 'Saved draft loaded. Review details before preparing your request.';
      } catch { status.textContent = 'Saved draft could not be loaded.'; }
    }),
    button('Delete saved draft', () => {
      try { localStorage.removeItem(key); status.textContent = 'Saved draft deleted. Current form values remain available.'; }
      catch { status.textContent = 'This browser cannot access saved drafts.'; }
    })
  );

  function preview() {
    const invalid = fields.find(field => !field.disabled && !field.checkValidity());
    if (invalid) { invalid.reportValidity(); return false; }
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'static-request-preview';
      panel.dataset.requestPreview = '';
      panel.tabIndex = -1;
      form.append(panel);
    }
    panel.replaceChildren();
    panel.hidden = false;
    const title = document.createElement('h3');
    title.textContent = order ? 'Review your order request' : 'Review your message';
    const help = document.createElement('p');
    help.textContent = `Nothing has been sent. Email your request to ${recipient}. ${order ? 'Recepton will confirm availability and final pricing.' : ''}`;
    const subject = order ? 'Recepton product order request' : 'Recepton contact enquiry';
    const lines = [subject, ''];
    let product = 0;
    fields.filter(field => !field.disabled && (!['radio', 'checkbox'].includes(field.type) || field.checked))
      .forEach(field => {
        if (!field.value || field.value === 'Add another product') return;
        const name = label(field);
        if (name === 'Choose product') lines.push('', `Product ${++product}`);
        lines.push(`${name}: ${field.type === 'checkbox' ? 'Accepted' : field.value}`);
      });
    lines.push('', `Prepared from: ${location.origin}${location.pathname}`);
    const body = lines.join('\n');
    const text = document.createElement('textarea');
    text.className = 'static-request-text';
    text.readOnly = true;
    text.rows = Math.min(22, lines.length + 1);
    text.value = body;
    text.setAttribute('aria-label', 'Prepared request');
    const actions = document.createElement('div');
    actions.className = 'static-actions';
    const email = document.createElement('a');
    email.className = 'static-primary';
    email.textContent = 'Open email draft';
    email.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const feedback = document.createElement('p');
    feedback.setAttribute('role', 'status');
    email.addEventListener('click', () => {
      feedback.textContent = 'Send from your email app to finish. If it does not open or omits text, copy or download the request and email it manually.';
    });
    actions.append(email, button('Copy request', async () => {
      try { await navigator.clipboard.writeText(body); feedback.textContent = 'Request copied. Paste it into your email.'; }
      catch { text.focus(); text.select(); feedback.textContent = 'Select and copy the request text, then paste it into your email.'; }
    }), button('Download request', () => {
      const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = order ? 'recepton-order-request.txt' : 'recepton-message.txt';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      feedback.textContent = 'Request downloaded. Attach it to an email to finish.';
    }));
    panel.append(title, help, text, actions, feedback);
    panel.focus();
    panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    return true;
  }
  return { preview };
}
