/* Keep original forms visible while their server endpoints are deferred. */
document.addEventListener('submit', function (event) {
  const form = event.target.closest('form[data-static-form]');
  if (!form) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  let status = form.querySelector('[data-static-status]');
  if (!status) {
    status = document.createElement('p');
    status.dataset.staticStatus = '';
    status.setAttribute('role', 'status');
    form.appendChild(status);
  }
  status.textContent = 'This form is not connected yet. Please contact Recepton directly.';
}, true);
