import { MENU_CATEGORIES, MENU_ITEMS, formatMYR } from './shared/menu.js';

const state = {
  category: 'All',
  search: '',
  cart: JSON.parse(localStorage.getItem('hadhramawt-cart') || '[]')
};

const el = {
  tabs: document.querySelector('#categoryTabs'),
  grid: document.querySelector('#menuGrid'),
  search: document.querySelector('#menuSearch'),
  empty: document.querySelector('#emptyState'),
  cartButton: document.querySelector('#cartButton'),
  cartCount: document.querySelector('#cartCount'),
  drawer: document.querySelector('#cartDrawer'),
  backdrop: document.querySelector('#cartBackdrop'),
  closeCart: document.querySelector('#closeCart'),
  cartItems: document.querySelector('#cartItems'),
  cartEmpty: document.querySelector('#cartEmpty'),
  cartFooter: document.querySelector('#cartFooter'),
  cartTotal: document.querySelector('#cartTotal'),
  checkoutButton: document.querySelector('#checkoutButton'),
  dialog: document.querySelector('#checkoutDialog'),
  checkoutForm: document.querySelector('#checkoutForm'),
  checkoutTotal: document.querySelector('#checkoutTotal'),
  pickupAt: document.querySelector('#pickupAt'),
  payButton: document.querySelector('#payButton'),
  checkoutError: document.querySelector('#checkoutError'),
  toast: document.querySelector('#toast')
};

const itemById = new Map(MENU_ITEMS.map(item => [item.id, item]));

function saveCart(){
  localStorage.setItem('hadhramawt-cart', JSON.stringify(state.cart));
  renderCart();
}

function cartTotal(){
  return state.cart.reduce((sum, line) => sum + line.price * line.qty, 0);
}

function showToast(message){
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => el.toast.classList.remove('show'), 1800);
}

function renderTabs(){
  el.tabs.innerHTML = ['All', ...MENU_CATEGORIES].map(category =>
    `<button class="category-tab ${state.category === category ? 'active' : ''}" data-category="${category}">${category}</button>`
  ).join('');
  el.tabs.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      state.category = button.dataset.category;
      renderTabs();
      renderMenu();
    });
  });
}

function renderMenu(){
  const q = state.search.trim().toLowerCase();
  const filtered = MENU_ITEMS.filter(item => {
    const categoryMatch = state.category === 'All' || item.category === state.category;
    const text = `${item.name} ${item.description} ${item.category}`.toLowerCase();
    return categoryMatch && (!q || text.includes(q));
  });
  el.empty.hidden = filtered.length > 0;
  el.grid.innerHTML = filtered.map(item => {
    const optionMarkup = item.options.length > 1
      ? `<div class="variant-wrap"><label>Choose option</label><select class="variant-select" data-option-for="${item.id}">${item.options.map(o => `<option value="${o.label}" data-price="${o.price}">${o.label} · ${formatMYR(o.price)}</option>`).join('')}</select><strong class="price" data-price-for="${item.id}">${formatMYR(item.options[0].price)}</strong></div>`
      : `<div class="variant-wrap"><label>${item.category}</label><strong class="price">${formatMYR(item.options[0].price)}</strong></div>`;
    return `<article class="menu-card">
      <div class="menu-card-top"><h3>${item.name}</h3>${item.badge ? `<span class="badge">${item.badge}</span>` : ''}</div>
      ${item.serves ? `<span class="serves">Serves ${item.serves}</span>` : ''}
      <p>${item.description}</p>
      <div class="menu-card-bottom">${optionMarkup}<button class="add-button" data-add="${item.id}" type="button" aria-label="Add ${item.name} to cart">+</button></div>
    </article>`;
  }).join('');

  el.grid.querySelectorAll('.variant-select').forEach(select => {
    select.addEventListener('change', () => {
      const option = select.selectedOptions[0];
      el.grid.querySelector(`[data-price-for="${select.dataset.optionFor}"]`).textContent = formatMYR(Number(option.dataset.price));
    });
  });
  el.grid.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => addItem(button.dataset.add)));
}

function addItem(id){
  const item = itemById.get(id);
  if (!item) return;
  const select = el.grid.querySelector(`[data-option-for="${id}"]`);
  const optionLabel = select ? select.value : item.options[0].label;
  const option = item.options.find(o => o.label === optionLabel) || item.options[0];
  const key = `${item.id}::${option.label}`;
  const existing = state.cart.find(line => line.key === key);
  if (existing) existing.qty += 1;
  else state.cart.push({ key, id: item.id, name: item.name, option: option.label, price: option.price, qty: 1 });
  saveCart();
  showToast(`${item.name} added`);
}

function renderCart(){
  const count = state.cart.reduce((n, line) => n + line.qty, 0);
  el.cartCount.textContent = count;
  el.cartEmpty.hidden = count > 0;
  el.cartFooter.hidden = count === 0;
  el.cartItems.innerHTML = state.cart.map(line => `<div class="cart-line" data-line="${line.key}">
    <div><h4>${line.name}</h4><small>${line.option}</small><div class="qty-row"><button type="button" data-dec="${line.key}">−</button><span>${line.qty}</span><button type="button" data-inc="${line.key}">+</button><button type="button" class="remove-link" data-remove="${line.key}">Remove</button></div></div>
    <div class="cart-line-price">${formatMYR(line.price * line.qty)}</div>
  </div>`).join('');
  const total = cartTotal();
  el.cartTotal.textContent = formatMYR(total);
  el.checkoutTotal.textContent = formatMYR(total);
  el.cartItems.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', () => changeQty(b.dataset.inc, 1)));
  el.cartItems.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => changeQty(b.dataset.dec, -1)));
  el.cartItems.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => removeLine(b.dataset.remove)));
}

function changeQty(key, delta){
  const line = state.cart.find(l => l.key === key);
  if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) state.cart = state.cart.filter(l => l.key !== key);
  saveCart();
}
function removeLine(key){ state.cart = state.cart.filter(l => l.key !== key); saveCart(); }

function toggleCart(open){
  el.drawer.classList.toggle('open', open);
  el.drawer.setAttribute('aria-hidden', String(!open));
  document.body.style.overflow = open ? 'hidden' : '';
}

function populatePickupSlots(){
  const now = new Date();
  const slots = [];
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const day = new Date(now);
    day.setDate(now.getDate() + dayOffset);
    for (let h = 11; h <= 23; h++) {
      for (const m of [0, 30]) {
        const slot = new Date(day);
        slot.setHours(h, m, 0, 0);
        if (slot.getTime() < now.getTime() + 30 * 60 * 1000) continue;
        const dateLabel = dayOffset === 0 ? 'Today' : dayOffset === 1 ? 'Tomorrow' : slot.toLocaleDateString('en-MY', { weekday:'short', day:'numeric', month:'short' });
        const timeLabel = slot.toLocaleTimeString('en-MY', { hour:'numeric', minute:'2-digit' });
        slots.push(`<option value="${slot.toISOString()}">${dateLabel} · ${timeLabel}</option>`);
      }
    }
  }
  el.pickupAt.innerHTML = `<option value="">Select pickup time</option>${slots.join('')}`;
}

async function checkout(){
  if (!state.cart.length) return;
  if (!el.checkoutForm.reportValidity()) return;
  el.checkoutError.hidden = true;
  el.payButton.disabled = true;
  el.payButton.textContent = 'Creating secure payment…';
  const form = new FormData(el.checkoutForm);
  const payload = {
    customer: { name: String(form.get('name') || '').trim(), mobile: String(form.get('mobile') || '').trim(), email: String(form.get('email') || '').trim() },
    pickupAt: String(form.get('pickupAt') || ''),
    notes: String(form.get('notes') || '').trim(),
    items: state.cart.map(({id, option, qty}) => ({ id, option, qty }))
  };
  try {
    const response = await fetch('./api/create-order', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.billUrl) throw new Error(data.message || 'Online payment is not available yet. Please try again or call the restaurant.');
    sessionStorage.setItem('hadhramawt-last-order', JSON.stringify({ orderId:data.orderId, pickupAt:payload.pickupAt }));
    window.location.assign(data.billUrl);
  } catch (error) {
    el.checkoutError.textContent = error.message;
    el.checkoutError.hidden = false;
    el.payButton.disabled = false;
    el.payButton.textContent = 'Pay securely with Billplz';
  }
}

el.search.addEventListener('input', () => { state.search = el.search.value; renderMenu(); });
el.cartButton.addEventListener('click', () => toggleCart(true));
el.closeCart.addEventListener('click', () => toggleCart(false));
el.backdrop.addEventListener('click', () => toggleCart(false));
el.checkoutButton.addEventListener('click', () => { toggleCart(false); populatePickupSlots(); el.dialog.showModal(); });
el.payButton.addEventListener('click', checkout);
el.checkoutForm.addEventListener('submit', e => { if (e.submitter?.value === 'cancel') return; e.preventDefault(); });

document.querySelectorAll('[data-category-jump]').forEach(link => link.addEventListener('click', () => {
  state.category = link.dataset.categoryJump;
  setTimeout(() => { renderTabs(); renderMenu(); }, 20);
}));

renderTabs();
renderMenu();
renderCart();
