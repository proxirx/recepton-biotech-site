export function validEndpoint(endpoint) {
  return /^https:\/\/formspree\.io\/f\/[a-z0-9]+\/?$/i.test(endpoint);
}

export async function submitRequest(endpoint, request, signal) {
  if (!validEndpoint(endpoint)) return { ok: false, message: 'Online sending is not configured. Please use the email or download option.' };
  const data = new FormData();
  data.set('email', request.email);
  data.set('name', request.name);
  data.set('subject', request.subject);
  data.set('message', request.message);
  data.set('request_type', request.kind);
  data.set('source', request.source);
  data.set('_gotcha', request.honeypot || '');
  try {
    const response = await fetch(endpoint, {
      method: 'POST', body: data, headers: { Accept: 'application/json' }, signal
    });
    if (response.ok) return { ok: true, message: 'Request submitted successfully. Keep a copy for your records.' };
    if (response.status === 429) return { ok: false, message: 'Too many submissions. Please wait before trying again, or use the email option.' };
    const body = await response.json().catch(() => ({}));
    const errors = Array.isArray(body?.errors) ? body.errors.map(error => typeof error === 'string' ? error : error?.message).filter(Boolean).join(' ') : '';
    return { ok: false, message: errors || 'The service did not accept this request. Please try again or use the email option.' };
  } catch {
    return { ok: false, message: 'Submission could not be confirmed. Keep your request and check before retrying to avoid sending it twice. Email and download options remain available.' };
  }
}
