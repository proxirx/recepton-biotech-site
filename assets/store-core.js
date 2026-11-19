export const MAX_QUANTITY = 9999;
const same = (a, b) => a.productId === b.productId && a.optionId === b.optionId;
const validQuantity = quantity => Number.isInteger(quantity) && quantity > 0 && quantity <= MAX_QUANTITY;

function selection(products, productId, optionId) {
  const product = products.find(product => product.id === productId);
  const option = product?.options.find(option => option.id === optionId);
  return option ? { product, option } : null;
}

export function normalizeBasket(value, products) {
  const items = [];
  if (!Array.isArray(value)) return items;
  for (const item of value) {
    if (!item || !selection(products, item.productId, item.optionId) || !validQuantity(item.quantity)) continue;
    const existing = items.find(line => same(line, item));
    if (existing) {
      if (validQuantity(existing.quantity + item.quantity)) existing.quantity += item.quantity;
    } else items.push({ productId: item.productId, optionId: item.optionId, quantity: item.quantity });
  }
  return items;
}

export function addItem(items, products, productId, optionId, quantity) {
  if (!selection(products, productId, optionId)) throw new Error('Choose an available product and size.');
  if (!validQuantity(quantity)) throw new Error(`Quantity must be a whole number from 1 to ${MAX_QUANTITY}.`);
  const current = normalizeBasket(items, products);
  const existing = current.find(item => same(item, { productId, optionId }));
  if (existing) {
    if (!validQuantity(existing.quantity + quantity)) throw new Error(`Basket quantity cannot exceed ${MAX_QUANTITY} per size.`);
    existing.quantity += quantity;
  } else current.push({ productId, optionId, quantity });
  return current;
}

export function setQuantity(items, products, productId, optionId, quantity) {
  if (quantity !== 0 && !validQuantity(quantity)) throw new Error(`Quantity must be a whole number from 1 to ${MAX_QUANTITY}.`);
  return normalizeBasket(items, products).flatMap(item => same(item, { productId, optionId }) ?
    quantity ? [{ ...item, quantity }] : [] : [item]);
}

export function basketSummary(items, products) {
  const lines = normalizeBasket(items, products).map(item => {
    const { product, option } = selection(products, item.productId, item.optionId);
    return { ...item, product, option, totalCents: option.priceCents === null ? null : option.priceCents * item.quantity };
  });
  return {
    lines,
    units: lines.reduce((sum, line) => sum + line.quantity, 0),
    estimateCents: lines.reduce((sum, line) => sum + (line.totalCents ?? 0), 0),
    quoteLines: lines.filter(line => line.totalCents === null).length
  };
}

export function removeSubmitted(items, submitted, products) {
  const accepted = normalizeBasket(submitted, products);
  return normalizeBasket(items, products).flatMap(item => {
    const sent = accepted.find(line => same(line, item));
    const quantity = Math.max(0, item.quantity - (sent?.quantity || 0));
    return quantity ? [{ ...item, quantity }] : [];
  });
}
