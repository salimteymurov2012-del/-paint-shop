// Admin Panel
const API = '/api';
let adminKey = localStorage.getItem('admin_key') || '';
let allAdminProducts = [];
let allAdminCategories = [];
let allSettings = {};

// =========== INIT ===========
document.addEventListener('DOMContentLoaded', async () => {
  if (adminKey) {
    const check = await fetch(`${API}/admin/check`, { headers: { 'x-admin-key': adminKey } });
    const data = await check.json();
    if (data.authenticated) {
      showPanel();
      return;
    }
  }
  document.getElementById('login-screen').style.display = 'flex';
});

async function adminLogin() {
  const key = document.getElementById('admin-key-input').value;
  try {
    const res = await fetch(`${API}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    const data = await res.json();
    if (data.success) {
      adminKey = key;
      localStorage.setItem('admin_key', key);
      showPanel();
    } else {
      document.getElementById('login-error').textContent = 'Неверный ключ доступа';
    }
  } catch(e) {
    document.getElementById('login-error').textContent = 'Ошибка подключения';
  }
}

function adminLogout() {
  localStorage.removeItem('admin_key');
  adminKey = '';
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

async function showPanel() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'flex';
  // Update clock
  setInterval(() => {
    document.getElementById('admin-header-time').textContent = new Date().toLocaleString('ru-RU');
  }, 1000);
  await loadDashboard();
  await loadAdminCategories();
  // Set site name in sidebar
  const nameEl = document.getElementById('admin-site-name');
  if (nameEl && allSettings.site_name) nameEl.textContent = allSettings.site_name;
}

function apiHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-admin-key': adminKey
  };
}

// =========== NAVIGATION ===========
function showAdminSection(name) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(s => s.classList.remove('active'));
  document.querySelector(`[data-section="${name}"]`).classList.add('active');
  document.getElementById(`section-${name}`).classList.add('active');

  const titles = {
    dashboard: 'Дашборд', products: 'Товары', categories: 'Категории',
    orders: 'Заказы', banners: 'Баннеры', reviews: 'Отзывы',
    promocodes: 'Промокоды', settings: 'Настройки'
  };
  document.getElementById('admin-section-title').textContent = titles[name] || name;

  if (name === 'products') loadAdminProducts();
  if (name === 'categories') renderAdminCategories();
  if (name === 'orders') loadOrders();
  if (name === 'banners') loadBanners();
  if (name === 'reviews') loadReviews();
  if (name === 'promocodes') loadPromocodes();
  if (name === 'settings') loadSettings();
  if (name === 'dashboard') loadDashboard();
  updateNewOrdersBadge();
}

async function updateNewOrdersBadge() {
  try {
    const res = await fetch(`${API}/admin/orders?status=new`, { headers: apiHeaders() });
    const orders = await res.json();
    const badge = document.getElementById('new-orders-badge');
    if (badge) {
      badge.textContent = orders.length;
      badge.style.display = orders.length > 0 ? 'inline' : 'none';
    }
  } catch(e) {}
}

// =========== DASHBOARD ===========
async function loadDashboard() {
  try {
    const res = await fetch(`${API}/admin/stats`, { headers: apiHeaders() });
    const stats = await res.json();
    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card"><div class="stat-value">${stats.totalProducts}</div><div class="stat-label">Товаров</div></div>
      <div class="stat-card"><div class="stat-value">${stats.totalOrders}</div><div class="stat-label">Заказов</div></div>
      <div class="stat-card"><div class="stat-value">${stats.newOrders}</div><div class="stat-label">Новых заказов</div></div>
      <div class="stat-card"><div class="stat-value">${formatPrice(stats.totalRevenue)} ₼</div><div class="stat-label">Выручка</div></div>
      <div class="stat-card"><div class="stat-value">${stats.totalCustomers}</div><div class="stat-label">Клиентов</div></div>
    `;
    if (stats.popular && stats.popular.length) {
      document.getElementById('popular-products').innerHTML = `<ul style="list-style:none;padding:0">${stats.popular.map(p => `<li style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between"><span>${p.name}</span><span style="color:var(--gold-light)">${p.total} шт.</span></li>`).join('')}</ul>`;
    }

    // Show phone access
    const ip = await fetch('/api/my-ip').then(r => r.json()).then(d => d.ip).catch(() => '');
    if (ip) {
      const url = `http://${ip}:3000`;
      const phoneBlock = document.getElementById('phone-access-block');
      if (phoneBlock) {
        phoneBlock.innerHTML = `
          <div style="text-align:center;padding:20px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius)">
            <h3 style="margin-bottom:12px">📱 Доступ с телефона</h3>
            <p style="margin-bottom:8px;font-size:14px;color:var(--text-secondary)">Отсканируй QR-код или открой в браузере телефона:</p>
            <div style="margin-bottom:8px">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}" style="border-radius:8px;background:white;padding:8px" alt="QR">
            </div>
            <a href="${url}" style="color:var(--gold-light);font-size:18px;font-weight:600;text-decoration:none" target="_blank">${url}</a>
            <p style="margin-top:8px;font-size:12px;color:var(--text-secondary)">Телефон и компьютер должны быть в одной Wi-Fi сети</p>
          </div>`;
      }
    }
  } catch(e) { console.error(e); }
}

// =========== CATEGORIES ===========
async function loadAdminCategories() {
  try {
    const res = await fetch(`${API}/admin/categories`, { headers: apiHeaders() });
    allAdminCategories = await res.json();
  } catch(e) { console.error(e); }
}

function renderAdminCategories() {
  const tbody = document.getElementById('categories-tbody');
  tbody.innerHTML = allAdminCategories.map(c => `<tr>
    <td>${c.name} ${c.parent_id ? '<span style="color:var(--text-secondary);font-size:12px">(подкатегория)</span>' : ''}</td>
    <td>${c.product_count || 0}</td>
    <td><input type="number" value="${c.order_index}" style="width:60px;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:4px;border-radius:4px" onchange="updateCategorySort('${c.id}', this.value)"></td>
    <td class="actions">
      <button class="btn btn-sm btn-outline" onclick="openCategoryModal('${c.id}')">✏️</button>
      <button class="btn btn-sm btn-danger" onclick="deleteCategory('${c.id}')">🗑️</button>
    </td>
  </tr>`).join('');
}

function openCategoryModal(id) {
  const cat = id ? allAdminCategories.find(c => c.id === id) : null;
  const parentOpts = allAdminCategories.filter(c => !c.parent_id && c.id !== id).map(c => `<option value="${c.id}" ${cat && cat.parent_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
  document.getElementById('admin-modal-body').innerHTML = `<h2>${id ? 'Редактировать' : 'Новая'} категория</h2>
    <div class="modal-field"><label>Название</label><input type="text" id="cat-name" value="${cat ? cat.name : ''}"></div>
    <div class="modal-field"><label>Родительская категория</label><select id="cat-parent"><option value="">Нет</option>${parentOpts}</select></div>
    <div class="modal-field"><label>Порядок</label><input type="number" id="cat-order" value="${cat ? cat.order_index : 0}"></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-primary" onclick="saveCategory('${id || ''}')">Сохранить</button>
      <button class="btn btn-outline" onclick="closeAdminModal()">Отмена</button>
    </div>`;
  document.getElementById('admin-modal').classList.add('open');
}

async function saveCategory(id) {
  const data = {
    name: document.getElementById('cat-name').value,
    parent_id: document.getElementById('cat-parent').value || null,
    order_index: parseInt(document.getElementById('cat-order').value) || 0
  };
  try {
    if (id) {
      await fetch(`${API}/admin/categories/${id}`, { method: 'PUT', headers: apiHeaders(), body: JSON.stringify(data) });
    } else {
      await fetch(`${API}/admin/categories`, { method: 'POST', headers: apiHeaders(), body: JSON.stringify(data) });
    }
    closeAdminModal();
    await loadAdminCategories();
    renderAdminCategories();
  } catch(e) { alert('Ошибка'); }
}

async function deleteCategory(id) {
  if (!confirm('Удалить категорию?')) return;
  await fetch(`${API}/admin/categories/${id}`, { method: 'DELETE', headers: apiHeaders() });
  await loadAdminCategories();
  renderAdminCategories();
}

async function updateCategorySort(id, idx) {
  await fetch(`${API}/admin/categories/${id}`, { method: 'PUT', headers: apiHeaders(), body: JSON.stringify({ name: allAdminCategories.find(c=>c.id===id).name, order_index: parseInt(idx) || 0, parent_id: null }) });
}

// =========== PRODUCTS ===========
async function loadAdminProducts() {
  try {
    const res = await fetch(`${API}/admin/products`, { headers: apiHeaders() });
    allAdminProducts = await res.json();
    renderAdminProducts();
  } catch(e) { console.error(e); }
}

function filterAdminProducts(query) {
  const filtered = allAdminProducts.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
  renderAdminProducts(filtered);
}

function renderAdminProducts(products) {
  const list = products || allAdminProducts;
  const tbody = document.getElementById('products-tbody');
  tbody.innerHTML = list.map(p => {
    const mainImg = p.images && p.images.length ? p.images.find(i => i.is_main) || p.images[0] : null;
    return `<tr>
      <td>${mainImg ? `<img src="/uploads/${mainImg.filename}" class="table-img">` : '🎨'}</td>
      <td><strong>${p.name}</strong><br><span style="font-size:12px;color:var(--text-secondary)">${p.difficulty}</span></td>
      <td>${p.category_name || '—'}</td>
      <td>${formatPrice(p.price)} ₼${p.discount ? ` <span style="color:var(--success);font-size:12px">-${p.discount_percent}%</span>` : ''}</td>
      <td>${p.stock}</td>
      <td><span class="status-badge ${p.visible ? 'status-active' : 'status-hidden'}">${p.visible ? 'Активен' : 'Скрыт'}</span></td>
      <td class="actions">
        <button class="btn btn-sm btn-outline" onclick="openProductModal('${p.id}')">✏️</button>
        <button class="btn btn-sm btn-outline" onclick="toggleVisibility('${p.id}', ${p.visible})">${p.visible ? '🙈' : '👁️'}</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function openProductModal(id) {
  const p = id ? allAdminProducts.find(x => x.id === id) : null;
  const catOpts = allAdminCategories.map(c => `<option value="${c.id}" ${p && p.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
  const imagesHtml = p && p.images && p.images.length ? p.images.map(img => `
    <div style="display:inline-block;margin:4px;position:relative">
      <img src="/uploads/${img.filename}" style="width:80px;height:60px;object-fit:cover;border-radius:4px;${img.is_main ? 'border:2px solid var(--gold)' : ''}">
      <div style="display:flex;gap:4px;margin-top:4px">
        ${!img.is_main ? `<button class="btn btn-sm btn-outline" onclick="setMainImage('${id}','${img.id}')">⭐</button>` : '<span style="font-size:12px;color:var(--gold)">Главная</span>'}
        <button class="btn btn-sm btn-danger" onclick="deleteImage('${id}','${img.id}')">✕</button>
      </div>
    </div>`).join('') : '';

  document.getElementById('admin-modal-body').innerHTML = `<h2>${id ? 'Редактировать' : 'Новый'} товар</h2>
    <form id="product-form" onsubmit="saveProduct(event, '${id || ''}')">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px" class="product-form-grid">
        <div class="modal-field"><label>Название *</label><input type="text" name="name" value="${p ? p.name : ''}" required></div>
        <div class="modal-field"><label>Категория</label><select name="category_id"><option value="">Без категории</option>${catOpts}</select></div>
        <div class="modal-field"><label>Цена *</label><input type="number" name="price" step="0.01" value="${p ? p.price : ''}" required></div>
        <div class="modal-field"><label>Старая цена</label><input type="number" name="old_price" step="0.01" value="${p && p.old_price ? p.old_price : ''}"></div>
        <div class="modal-field"><label>Процент скидки</label><input type="number" name="discount_percent" value="${p ? p.discount_percent : 0}"></div>
        <div class="modal-field"><label>Сложность</label><select name="difficulty">
          <option value="Лёгкий" ${p && p.difficulty === 'Лёгкий' ? 'selected' : ''}>Лёгкий</option>
          <option value="Средний" ${p && p.difficulty === 'Средний' || !p ? 'selected' : ''}>Средний</option>
          <option value="Сложный" ${p && p.difficulty === 'Сложный' ? 'selected' : ''}>Сложный</option>
        </select></div>
        <div class="modal-field"><label>Количество цветов</label><input type="number" name="colors_count" value="${p ? p.colors_count : 24}"></div>
        <div class="modal-field"><label>Производитель</label><input type="text" name="manufacturer" value="${p ? p.manufacturer : allSettings.manufacturer || ''}"></div>
        <div class="modal-field"><label>Количество на складе</label><input type="number" name="stock" value="${p ? p.stock : 0}"></div>
        <div class="modal-field"><label>Размеры (через запятую)</label><input type="text" name="sizes" value="${p && p.sizes ? JSON.parse(p.sizes).join(', ') : ''}"></div>
        <div class="modal-field" style="grid-column:1/-1"><label>Комплектация</label><input type="text" name="includes" value="${p ? p.includes : ''}"></div>
        <div class="modal-field" style="grid-column:1/-1"><label>Описание</label><textarea name="description" rows="4">${p ? p.description : ''}</textarea></div>
        <div class="modal-field" style="grid-column:1/-1">
          <label>Метки</label>
          <div class="checkbox-row">
            <label><input type="checkbox" name="is_new" ${p && p.is_new ? 'checked' : ''}> Новинка</label>
            <label><input type="checkbox" name="is_bestseller" ${p && p.is_bestseller ? 'checked' : ''}> Хит продаж</label>
            <label><input type="checkbox" name="is_recommended" ${p && p.is_recommended ? 'checked' : ''}> Рекомендуем</label>
            <label><input type="checkbox" name="is_limited" ${p && p.is_limited ? 'checked' : ''}> Лимитированная</label>
          </div>
        </div>
        <div class="modal-field" style="grid-column:1/-1"><label>Изображения</label><input type="file" name="images" multiple accept="image/*"></div>
      </div>
      ${imagesHtml ? `<div style="margin:12px 0"><label style="font-size:13px;color:var(--text-secondary)">Текущие изображения</label><div>${imagesHtml}</div></div>` : ''}
      <div class="modal-field" style="grid-column:1/-1"><label>SEO заголовок</label><input type="text" name="seo_title" value="${p ? p.seo_title || '' : ''}"></div>
      <div class="modal-field" style="grid-column:1/-1"><label>SEO описание</label><textarea name="seo_description" rows="2">${p ? p.seo_description || '' : ''}</textarea></div>
      <input type="hidden" name="visible" value="${p ? p.visible : 1}">
      <div style="display:flex;gap:8px;margin-top:12px">
        <button type="submit" class="btn btn-primary">${id ? 'Сохранить' : 'Создать'}</button>
        <button type="button" class="btn btn-outline" onclick="closeAdminModal()">Отмена</button>
      </div>
    </form>`;
  document.getElementById('admin-modal').classList.add('open');
}

async function saveProduct(e, id) {
  e.preventDefault();
  const form = document.getElementById('product-form');
  const formData = new FormData(form);
  // Parse sizes
  const sizesStr = formData.get('sizes');
  formData.set('sizes', JSON.stringify(sizesStr ? sizesStr.split(',').map(s => s.trim()).filter(Boolean) : []));

  try {
    let url = `${API}/admin/products`;
    let method = 'POST';
    if (id) { url += `/${id}`; method = 'PUT'; }
    const res = await fetch(url, {
      method,
      headers: { 'x-admin-key': adminKey },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      closeAdminModal();
      await loadAdminProducts();
    } else {
      alert('Ошибка сохранения');
    }
  } catch(e) { alert('Ошибка: ' + e.message); }
}

async function toggleVisibility(id, current) {
  await fetch(`${API}/admin/products/${id}/visibility`, {
    method: 'PUT',
    headers: apiHeaders(),
    body: JSON.stringify({ visible: current ? 0 : 1 })
  });
  await loadAdminProducts();
}

async function deleteProduct(id) {
  if (!confirm('Удалить товар?')) return;
  await fetch(`${API}/admin/products/${id}`, { method: 'DELETE', headers: apiHeaders() });
  await loadAdminProducts();
}

async function setMainImage(productId, imageId) {
  await fetch(`${API}/admin/products/${productId}/main-image/${imageId}`, { method: 'PUT', headers: apiHeaders() });
  await loadAdminProducts();
  openProductModal(productId);
}

async function deleteImage(productId, imageId) {
  if (!confirm('Удалить изображение?')) return;
  await fetch(`${API}/admin/products/${productId}/image/${imageId}`, { method: 'DELETE', headers: apiHeaders() });
  await loadAdminProducts();
  openProductModal(productId);
}

// =========== ORDERS ===========
async function loadOrders(status) {
  try {
    let url = `${API}/admin/orders`;
    if (status && status !== 'all') url += `?status=${status}`;
    const res = await fetch(url, { headers: apiHeaders() });
    const orders = await res.json();
    const tbody = document.getElementById('orders-tbody');
    tbody.innerHTML = orders.map(o => `<tr>
      <td style="font-size:12px;color:var(--text-secondary)">#${o.id.slice(-8)}</td>
      <td>
        <strong>${o.customer_name}</strong><br>
        <span style="font-size:12px;color:var(--text-secondary)">${o.customer_phone}</span>
      </td>
      <td><strong>${formatPrice(o.total)} ₼</strong></td>
      <td>
        <select class="search-input" style="width:auto;padding:4px 8px;font-size:12px" onchange="updateOrderStatus('${o.id}', this.value)">
          <option value="new" ${o.status === 'new' ? 'selected' : ''}>Новый</option>
          <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>В обработке</option>
          <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>Отправлен</option>
          <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Доставлен</option>
          <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Отменён</option>
        </select>
      </td>
      <td style="font-size:12px;color:var(--text-secondary)">${new Date(o.created_at).toLocaleString('ru-RU')}</td>
      <td class="actions">
        <button class="btn btn-sm btn-outline" onclick="viewOrder('${o.id}')">👁️</button>
        <button class="btn btn-sm btn-danger" onclick="deleteOrder('${o.id}')">🗑️</button>
      </td>
    </tr>`).join('');
  } catch(e) { console.error(e); }
}

async function updateOrderStatus(id, status) {
  await fetch(`${API}/admin/orders/${id}/status`, {
    method: 'PUT',
    headers: apiHeaders(),
    body: JSON.stringify({ status })
  });
  updateNewOrdersBadge();
}

async function viewOrder(id) {
  try {
    const res = await fetch(`${API}/admin/orders`, { headers: apiHeaders() });
    const orders = await res.json();
    const o = orders.find(x => x.id === id);
    if (!o) return;
    let items = [];
    try { items = JSON.parse(o.items); } catch(e) {}
    document.getElementById('admin-modal-title').textContent = `Заказ #${id.slice(-8)}`;
    document.getElementById('admin-modal-body').innerHTML = `
      <div style="margin-bottom:16px">
        <p><strong>Клиент:</strong> ${o.customer_name}</p>
        <p><strong>Телефон:</strong> <a href="tel:${o.customer_phone}" style="color:var(--light-gold)">${o.customer_phone}</a></p>
        ${o.customer_email ? `<p><strong>Email:</strong> ${o.customer_email}</p>` : ''}
        ${o.address ? `<p><strong>Адрес:</strong> ${o.address}</p>` : ''}
        ${o.comment ? `<p><strong>Комментарий:</strong> ${o.comment}</p>` : ''}
        <p><strong>Статус:</strong> ${o.status}</p>
        <p><strong>Дата:</strong> ${new Date(o.created_at).toLocaleString('ru-RU')}</p>
        <p><strong>Сумма:</strong> ${formatPrice(o.total)} ₼</p>
      </div>
      <hr style="border-color:var(--border);margin:12px 0">
      <h4 style="margin-bottom:8px">Товары:</h4>
      ${items.length ? `<table style="width:100%;border-collapse:collapse">
        <thead><tr><th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">Товар</th><th style="text-align:center;padding:6px 8px;border-bottom:1px solid var(--border)">Кол-во</th><th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)">Цена</th></tr></thead>
        <tbody>${items.map(i => `<tr><td style="padding:6px 8px;border-bottom:1px solid var(--border)">${i.name || i.id}</td><td style="text-align:center;padding:6px 8px;border-bottom:1px solid var(--border)">${i.quantity}</td><td style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)">${formatPrice(i.price * i.quantity)} ₼</td></tr>`).join('')}</tbody>
      </table>` : '<p>Нет данных о товарах</p>'}
    `;
    document.getElementById('admin-modal').style.display = 'flex';
  } catch(e) { console.error(e); }
}

async function deleteOrder(id) {
  if (!confirm('Удалить заказ?')) return;
  await fetch(`${API}/admin/orders/${id}`, { method: 'DELETE', headers: apiHeaders() });
  loadOrders();
  updateNewOrdersBadge();
}

// =========== BANNERS ===========
async function loadBanners() {
  try {
    const res = await fetch(`${API}/admin/banners`, { headers: apiHeaders() });
    const banners = await res.json();
    const tbody = document.getElementById('banners-tbody');
    tbody.innerHTML = banners.map(b => `<tr>
      <td><strong>${b.title || '—'}</strong></td>
      <td style="font-size:13px;color:var(--text-secondary)">${b.subtitle || '—'}</td>
      <td><span class="status-badge ${b.is_active ? 'status-active' : 'status-hidden'}">${b.is_active ? 'Активен' : 'Отключён'}</span></td>
      <td>${b.order_index}</td>
      <td class="actions">
        <button class="btn btn-sm btn-outline" onclick="openBannerModal('${b.id}')">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="deleteBanner('${b.id}')">🗑️</button>
      </td>
    </tr>`).join('');
  } catch(e) { console.error(e); }
}

function openBannerModal(id) {
  document.getElementById('admin-modal-body').innerHTML = `<h2>${id ? 'Редактировать' : 'Новый'} баннер</h2>
    <form id="banner-form" onsubmit="saveBanner(event, '${id || ''}')" enctype="multipart/form-data">
      <div class="modal-field"><label>Заголовок</label><input type="text" name="title" id="b-title"></div>
      <div class="modal-field"><label>Подзаголовок</label><input type="text" name="subtitle" id="b-subtitle"></div>
      <div class="modal-field"><label>Текст кнопки</label><input type="text" name="button_text" id="b-btn-text"></div>
      <div class="modal-field"><label>Ссылка кнопки</label><input type="text" name="button_link" id="b-btn-link"></div>
      <div class="modal-field"><label>Изображение</label><input type="file" name="image" accept="image/*"></div>
      <div class="modal-field"><label>Порядок</label><input type="number" name="order_index" id="b-order" value="0"></div>
      <div class="modal-field"><label><input type="checkbox" name="is_active" id="b-active" checked> Активен</label></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button type="submit" class="btn btn-primary">${id ? 'Сохранить' : 'Создать'}</button>
        <button type="button" class="btn btn-outline" onclick="closeAdminModal()">Отмена</button>
      </div>
    </form>`;
  if (id) {
    // Load banner data
    fetch(`${API}/admin/banners`, { headers: apiHeaders() }).then(r => r.json()).then(banners => {
      const b = banners.find(x => x.id === id);
      if (b) {
        document.getElementById('b-title').value = b.title || '';
        document.getElementById('b-subtitle').value = b.subtitle || '';
        document.getElementById('b-btn-text').value = b.button_text || '';
        document.getElementById('b-btn-link').value = b.button_link || '';
        document.getElementById('b-order').value = b.order_index || 0;
        document.getElementById('b-active').checked = !!b.is_active;
      }
    });
  }
  document.getElementById('admin-modal').classList.add('open');
}

async function saveBanner(e, id) {
  e.preventDefault();
  const form = document.getElementById('banner-form');
  const formData = new FormData(form);
  try {
    const url = `${API}/admin/banners${id ? '/' + id : ''}`;
    await fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'x-admin-key': adminKey }, body: formData });
    closeAdminModal();
    loadBanners();
  } catch(e) { alert('Ошибка'); }
}

async function deleteBanner(id) {
  if (!confirm('Удалить баннер?')) return;
  await fetch(`${API}/admin/banners/${id}`, { method: 'DELETE', headers: apiHeaders() });
  loadBanners();
}

// =========== REVIEWS ===========
async function loadReviews() {
  try {
    const res = await fetch(`${API}/admin/reviews`, { headers: apiHeaders() });
    const reviews = await res.json();
    const tbody = document.getElementById('reviews-tbody');
    tbody.innerHTML = reviews.map(r => `<tr>
      <td>${r.author}</td>
      <td style="color:var(--text-secondary)">${r.product_name || '—'}</td>
      <td>${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</td>
      <td style="font-size:13px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.text || '—'}</td>
      <td><span class="status-badge ${r.is_approved ? 'status-active' : 'status-hidden'}">${r.is_approved ? 'Одобрен' : 'На модерации'}</span></td>
      <td class="actions">
        <button class="btn btn-sm btn-outline" onclick="toggleReview('${r.id}', ${r.is_approved ? 0 : 1})">${r.is_approved ? '🙈' : '✅'}</button>
        <button class="btn btn-sm btn-danger" onclick="deleteReview('${r.id}')">🗑️</button>
      </td>
    </tr>`).join('');
  } catch(e) { console.error(e); }
}

async function toggleReview(id, approved) {
  await fetch(`${API}/admin/reviews/${id}/approve`, {
    method: 'PUT', headers: apiHeaders(),
    body: JSON.stringify({ approved })
  });
  loadReviews();
}

async function deleteReview(id) {
  if (!confirm('Удалить отзыв?')) return;
  await fetch(`${API}/admin/reviews/${id}`, { method: 'DELETE', headers: apiHeaders() });
  loadReviews();
}

// =========== PROMOCODES ===========
async function loadPromocodes() {
  try {
    const res = await fetch(`${API}/admin/promocodes`, { headers: apiHeaders() });
    const codes = await res.json();
    const tbody = document.getElementById('promocodes-tbody');
    tbody.innerHTML = codes.map(c => `<tr>
      <td><strong>${c.code}</strong></td>
      <td style="color:var(--gold-light)">${c.discount_percent}%</td>
      <td>${c.used_count}</td>
      <td>${c.max_uses || '∞'}</td>
      <td><span class="status-badge ${c.is_active ? 'status-active' : 'status-hidden'}">${c.is_active ? 'Активен' : 'Неактивен'}</span></td>
      <td class="actions"><button class="btn btn-sm btn-danger" onclick="deletePromocode('${c.id}')">🗑️</button></td>
    </tr>`).join('');
  } catch(e) { console.error(e); }
}

function openPromocodeModal() {
  document.getElementById('admin-modal-body').innerHTML = `<h2>Новый промокод</h2>
    <form onsubmit="savePromocode(event)">
      <div class="modal-field"><label>Код</label><input type="text" id="pc-code" required></div>
      <div class="modal-field"><label>Скидка %</label><input type="number" id="pc-discount" required min="1" max="100"></div>
      <div class="modal-field"><label>Макс. использований (0 = без лимита)</label><input type="number" id="pc-max" value="0"></div>
      <div class="modal-field"><label>Действует до</label><input type="date" id="pc-expires"></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button type="submit" class="btn btn-primary">Создать</button>
        <button type="button" class="btn btn-outline" onclick="closeAdminModal()">Отмена</button>
      </div>
    </form>`;
  document.getElementById('admin-modal').classList.add('open');
}

async function savePromocode(e) {
  e.preventDefault();
  const data = {
    code: document.getElementById('pc-code').value,
    discount_percent: parseInt(document.getElementById('pc-discount').value),
    max_uses: parseInt(document.getElementById('pc-max').value) || 0,
    expires_at: document.getElementById('pc-expires').value || null
  };
  await fetch(`${API}/admin/promocodes`, { method: 'POST', headers: apiHeaders(), body: JSON.stringify(data) });
  closeAdminModal();
  loadPromocodes();
}

async function deletePromocode(id) {
  if (!confirm('Удалить промокод?')) return;
  await fetch(`${API}/admin/promocodes/${id}`, { method: 'DELETE', headers: apiHeaders() });
  loadPromocodes();
}

// =========== SETTINGS ===========
let socialLinks = [];

async function loadSettings() {
  try {
    const res = await fetch(`${API}/admin/settings`, { headers: apiHeaders() });
    const s = await res.json();
    try { socialLinks = JSON.parse(s.social_links || '[]'); } catch(e) { socialLinks = []; }

    allSettings = s;
    const fields = [
      { key: 'site_name', label: 'Название магазина (логотип)', type: 'text' },
      { key: 'site_description', label: 'Описание сайта', type: 'text' },
      { key: 'manufacturer', label: 'Производитель по умолчанию', type: 'text' },
      { key: 'phone', label: 'Телефон', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'address', label: 'Адрес', type: 'text' },
      { key: 'delivery_info', label: 'Информация о доставке', type: 'textarea' },
      { key: 'payment_info', label: 'Информация об оплате', type: 'textarea' },
      { key: 'about_text', label: 'Текст "О нас"', type: 'textarea' },
      { key: 'admin_key', label: 'Секретный ключ администратора', type: 'text' }
    ];

    let html = fields.map(f => `
      <div class="modal-field">
        <label>${f.label}</label>
        ${f.type === 'textarea' ? `<textarea id="set-${f.key}" rows="3">${s[f.key] || ''}</textarea>` : `<input type="${f.type}" id="set-${f.key}" value="${(s[f.key] || '').replace(/"/g, '&quot;')}">`}
      </div>
    `).join('');

    // Social links builder
    html += `<div class="modal-field">
      <label>Социальные сети (можно добавить любые)</label>
      <div id="social-links-list">
        ${socialLinks.map((sl, i) => `
          <div class="social-link-row" style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
            <input type="text" value="${sl.icon || ''}" placeholder="Иконка" style="width:60px" class="sl-icon" onchange="updateSocialLink(${i},'icon',this.value)">
            <input type="text" value="${sl.name}" placeholder="Название" style="flex:1" class="sl-name" onchange="updateSocialLink(${i},'name',this.value)">
            <input type="text" value="${sl.url}" placeholder="Ссылка" style="flex:2" class="sl-url" onchange="updateSocialLink(${i},'url',this.value)">
            <button class="btn btn-sm btn-danger" onclick="removeSocialLink(${i})">✕</button>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-sm btn-outline" onclick="addSocialLink()" style="margin-top:8px">+ Добавить соцсеть</button>
    </div>`;

    html += `<button class="btn btn-primary" onclick="saveAllSettings()" style="margin-top:12px">Сохранить настройки</button>`;
    document.getElementById('settings-form').innerHTML = html;
  } catch(e) { console.error(e); }
}

function updateSocialLink(index, field, value) {
  if (socialLinks[index]) socialLinks[index][field] = value;
}

function addSocialLink() {
  socialLinks.push({ name: '', url: '', icon: '' });
  renderSocialLinksUI();
}

function removeSocialLink(index) {
  socialLinks.splice(index, 1);
  renderSocialLinksUI();
}

function renderSocialLinksUI() {
  const container = document.getElementById('social-links-list');
  if (!container) return;
  container.innerHTML = socialLinks.map((sl, i) => `
    <div class="social-link-row" style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
      <input type="text" value="${sl.icon || ''}" placeholder="Иконка" style="width:60px" onchange="updateSocialLink(${i},'icon',this.value)">
      <input type="text" value="${sl.name}" placeholder="Название" style="flex:1" onchange="updateSocialLink(${i},'name',this.value)">
      <input type="text" value="${sl.url}" placeholder="Ссылка" style="flex:2" onchange="updateSocialLink(${i},'url',this.value)">
      <button class="btn btn-sm btn-danger" onclick="removeSocialLink(${i})">✕</button>
    </div>
  `).join('');
}

async function saveAllSettings() {
  const inputs = document.querySelectorAll('#settings-form input:not(.sl-icon):not(.sl-name):not(.sl-url), #settings-form textarea');
  const data = {};
  inputs.forEach(el => {
    const key = el.id.replace('set-', '');
    data[key] = el.value;
  });
  data.social_links = JSON.stringify(socialLinks);
  try {
    await fetch(`${API}/admin/settings`, { method: 'PUT', headers: apiHeaders(), body: JSON.stringify(data) });
    alert('Настройки сохранены');
  } catch(e) { alert('Ошибка'); }
}

// =========== UTILS ===========
function formatPrice(n) { return Number(n).toLocaleString('ru-RU'); }

function closeAdminModal() {
  document.getElementById('admin-modal').classList.remove('open');
}

// =========== MOBILE SIDEBAR ===========
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// Close sidebar on nav click on mobile
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });
});
