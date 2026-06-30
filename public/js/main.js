// Main Client App
const API = '/api';
let cart = JSON.parse(localStorage.getItem('shop_cart') || '[]');
let allProducts = [];
let allCategories = [];
let allSettings = {};
let currentLang = localStorage.getItem('shop_lang') || 'az';

// =========== TRANSLATIONS ===========
const lang = {
  az: {
    title: 'Painting by Number',
    preloader: 'İlham yaradılır...',
    nav_catalog: 'Kataloq', nav_about: 'Haqqımızda', nav_contact: 'Əlaqə',
    hero_title: 'Yaradıcılığa ilham tap',
    hero_subtitle: 'Rəqəmlərlə rəsm dəstləri — yaradıcılığı zövqə çevirir.',
    hero_btn1: 'Rəsm seç', hero_btn2: 'Daha çox',
    f1_title: 'Premium keyfiyyət', f1_desc: 'Təbii kətan və parlaq boyalar',
    f2_title: 'Sürətli çatdırılma', f2_desc: 'Bakı üzrə 1-3 gün, ölkə üzrə 3-7 gün',
    f3_title: 'İstənilən səviyyə', f3_desc: 'Yeni başlayandan peşəkara qədər',
    f4_title: 'Hazır interyer', f4_desc: 'Bitirdikdən dərhal sonra',
    catalog_title: 'Rəsm kataloqu',
    filter_category: 'Bütün kateqoriyalar',
    filter_difficulty: 'İstənilən çətinlik',
    diff_easy: 'Asan', diff_medium: 'Orta', diff_hard: 'Çətin',
    sort_default: 'Standart', sort_asc: 'Ucuzdan bahaya', sort_desc: 'Bahadan ucuz', sort_name: 'Ada görə', sort_new: 'Yenilər',
    search_placeholder: 'Axtarış...',
    catalog_empty: 'Heç nə tapılmadı',
    back_catalog: '← Kataloqa qayıt',
    cart_title: 'Səbət',
    cart_empty: 'Səbətiniz boşdur', cart_go: 'Kataloqa keç',
    cart_total: 'Cəmi:',
    cart_remove: 'Sil',
    order_name: 'Adınız',
    order_phone: 'Telefon nömrəniz',
    order_comment: 'Şərh (istəyə bağlı)',
    order_btn: 'Sifariş ver',
    order_success_title: 'Sifariş qəbul edildi!',
    order_success_text: 'Sifarişiniz qeydə alındı. Ən qısa zamanda sizinlə əlaqə saxlanılacaq.',
    order_error: 'Xəta baş verdi. Yenidən cəhd edin.',
    order_required: 'Ad və telefon mütləqdir',
    about_title: 'Haqqımızda',
    contact_title: 'Əlaqə',
    contact_unavailable: 'Əlaqə məlumatları müvəqqəti olaraq əlçatan deyil',
    footer_desc: 'Rəqəmlərlə rəsmlər — yaradıcılığı zövqə çevirir.',
    footer_catalog: 'Kataloq', footer_info: 'Məlumat',
    footer_about: 'Haqqımızda', footer_contact: 'Əlaqə',
    footer_delivery: 'Çatdırılma', footer_contacts: 'Əlaqə',
    footer_copyright: '© 2026. Bütün hüquqlar qorunur.',
    toast_added: 'səbətə əlavə edildi',
    toast_removed: 'səbətdən silindi',
    home_new: 'Yenilər', home_bestseller: 'Populyar', home_recommended: 'Tövsiyə', home_limited: 'Məhdud seriya',
    product_cart: 'Səbətə at', product_continue: 'Alış-verişə davam',
    contact_phone: 'Telefon', contact_email: 'Email', contact_address: 'Ünvan', contact_social: 'Sosial şəbəkələr'
  },
  ru: {
    title: 'Painting by Number',
    preloader: 'Создаём вдохновение...',
    nav_catalog: 'Каталог', nav_about: 'О нас', nav_contact: 'Контакты',
    hero_title: 'Создай собственный шедевр',
    hero_subtitle: 'Картины по номерам, которые превращают творчество в удовольствие.',
    hero_btn1: 'Выбрать картину', hero_btn2: 'Узнать больше',
    f1_title: 'Премиум качество', f1_desc: 'Натуральные холсты и яркие краски',
    f2_title: 'Быстрая доставка', f2_desc: 'По Баку за 1-3 дня, по стране 3-7 дней',
    f3_title: 'Для любого уровня', f3_desc: 'От новичка до профи',
    f4_title: 'Готовый интерьер', f4_desc: 'Сразу после завершения',
    catalog_title: 'Каталог картин',
    filter_category: 'Все категории',
    filter_difficulty: 'Любая сложность',
    diff_easy: 'Лёгкий', diff_medium: 'Средний', diff_hard: 'Сложный',
    sort_default: 'По умолчанию', sort_asc: 'Сначала дешёвые', sort_desc: 'Сначала дорогие', sort_name: 'По названию', sort_new: 'Новинки',
    search_placeholder: 'Поиск...',
    catalog_empty: 'Ничего не найдено',
    back_catalog: '← Назад в каталог',
    cart_title: 'Корзина',
    cart_empty: 'Корзина пуста', cart_go: 'В каталог',
    cart_total: 'Итого:',
    cart_remove: 'Удалить',
    order_name: 'Ваше имя',
    order_phone: 'Номер телефона',
    order_comment: 'Комментарий (необязательно)',
    order_btn: 'Заказать',
    order_success_title: 'Заказ принят!',
    order_success_text: 'Заказ зарегистрирован. С вами свяжутся в ближайшее время.',
    order_error: 'Произошла ошибка. Попробуйте снова.',
    order_required: 'Имя и телефон обязательны',
    about_title: 'О нас',
    contact_title: 'Контакты',
    contact_unavailable: 'Контакты временно недоступны',
    footer_desc: 'Картины по номерам — творчество в удовольствие.',
    footer_catalog: 'Каталог', footer_info: 'Информация',
    footer_about: 'О нас', footer_contact: 'Контакты',
    footer_delivery: 'Доставка', footer_contacts: 'Контакты',
    footer_copyright: '© 2026. Все права защищены.',
    toast_added: 'добавлен в корзину',
    toast_removed: 'удалён из корзины',
    home_new: 'Новинки', home_bestseller: 'Хиты продаж', home_recommended: 'Рекомендуем', home_limited: 'Ограниченная серия',
    product_cart: 'В корзину', product_continue: 'Продолжить покупки',
    contact_phone: 'Телефон', contact_email: 'Email', contact_address: 'Адрес', contact_social: 'Социальные сети'
  }
};

// =========== INIT ===========
document.addEventListener('DOMContentLoaded', async () => {
  applyLang();
  await loadSettings();
  await loadCategories();
  await loadBanners();
  await loadHomeProducts();
  updateCartCount();

  setTimeout(() => {
    document.getElementById('preloader').classList.add('hidden');
  }, 800);

  window.addEventListener('scroll', () => {
    document.getElementById('header').classList.toggle('scrolled', window.scrollY > 50);
    const hero = document.getElementById('hero');
    if (hero) hero.style.transform = `translateY(${window.scrollY * 0.08}px)`;
  });
});

// =========== LANGUAGE ===========
function setLang(code) {
  currentLang = code;
  localStorage.setItem('shop_lang', code);
  applyLang();
  // Refresh dynamic content
  const activeSection = document.querySelector('.section.active');
  if (activeSection) {
    const id = activeSection.id.replace('section-', '');
    if (id === 'catalog') loadCatalog();
    if (id === 'cart') renderCart();
    if (id === 'about') loadAbout();
    if (id === 'contact') loadContact();
    if (id === 'home') { loadHomeProducts(); }
  }
  // Re-render catalog filters
  updateFilterOptions();
}

function applyLang() {
  const t = lang[currentLang];
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-lang]').forEach(el => {
    const key = el.dataset.lang;
    if (t[key]) el.textContent = t[key];
  });
  document.querySelectorAll('[data-lang-placeholder]').forEach(el => {
    const key = el.dataset.langPlaceholder;
    if (t[key]) el.placeholder = t[key];
  });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.langCode === currentLang);
  });
  document.title = t.title;
}

function t(key) {
  return lang[currentLang][key] || key;
}

// =========== FILTERS ===========
function updateFilterOptions() {
  const catSelect = document.getElementById('filter-category');
  if (catSelect) {
    const currentVal = catSelect.value;
    catSelect.innerHTML = `<option value="all">${t('filter_category')}</option>`;
    allCategories.forEach(c => {
      catSelect.innerHTML += `<option value="${c.id}" ${c.id === currentVal ? 'selected' : ''}>${c.name}</option>`;
    });
  }
  const diffSelect = document.getElementById('filter-difficulty');
  if (diffSelect) {
    diffSelect.innerHTML = `
      <option value="all">${t('filter_difficulty')}</option>
      <option value="Лёгкий">${t('diff_easy')}</option>
      <option value="Средний">${t('diff_medium')}</option>
      <option value="Сложный">${t('diff_hard')}</option>`;
  }
  const sortSelect = document.getElementById('filter-sort');
  if (sortSelect) {
    sortSelect.innerHTML = `
      <option value="default">${t('sort_default')}</option>
      <option value="price_asc">${t('sort_asc')}</option>
      <option value="price_desc">${t('sort_desc')}</option>
      <option value="name">${t('sort_name')}</option>
      <option value="new">${t('sort_new')}</option>`;
  }
  document.getElementById('search-input').placeholder = t('search_placeholder');
}

// =========== NAVIGATION ===========
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const section = document.getElementById('section-' + name);
  if (section) {
    section.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (name === 'catalog') { updateFilterOptions(); loadCatalog(); }
  if (name === 'cart') renderCart();
  if (name === 'about') loadAbout();
  if (name === 'contact') loadContact();
  document.querySelector('.nav-menu').classList.remove('open');
}

// =========== SETTINGS ===========
async function loadSettings() {
  try {
    const res = await fetch(`${API}/settings/public`);
    allSettings = await res.json();
    if (allSettings.phone) document.getElementById('footer-phone').textContent = allSettings.phone;
    if (allSettings.email) document.getElementById('footer-email').textContent = allSettings.email;
    if (allSettings.address) document.getElementById('footer-address').textContent = allSettings.address;
    // Set dynamic site name everywhere
    const name = allSettings.site_name || 'Painting by Number';
    document.getElementById('logo-text').textContent = name;
    document.getElementById('footer-logo-text').textContent = name;
    renderSocialLinks();
  } catch (e) { console.error(e); }
}

function renderSocialLinks() {
  const container = document.getElementById('social-links');
  if (!container) return;
  const links = allSettings.social_links || [];
  container.innerHTML = links.map(s =>
    `<a href="${s.url}" target="_blank" class="social-link">${s.icon || s.name.slice(0,2)}</a>`
  ).join('');
}

// =========== CATEGORIES ===========
async function loadCategories() {
  try {
    const res = await fetch(`${API}/categories`);
    allCategories = await res.json();
    updateFilterOptions();
    const footerCat = document.getElementById('footer-categories');
    if (footerCat) {
      footerCat.innerHTML = allCategories.map(c =>
        `<a href="#" onclick="showSection('catalog');setTimeout(()=>document.getElementById('filter-category').value='${c.id}',100)">${c.name}</a>`
      ).join('');
    }
  } catch (e) { console.error(e); }
}

// =========== BANNERS ===========
async function loadBanners() {
  try {
    const res = await fetch(`${API}/banners`);
    const banners = await res.json();
    const slider = document.getElementById('banners-slider');
    const track = document.getElementById('banners-track');
    if (!banners.length) { slider.style.display = 'none'; return; }
    slider.style.display = 'block';
    track.innerHTML = banners.map(b => `
      <div class="banner-card">
        ${b.title ? `<h3>${b.title}</h3>` : ''}
        ${b.subtitle ? `<p>${b.subtitle}</p>` : ''}
        ${b.button_text ? `<a href="${b.button_link || '#'}" class="btn btn-primary">${b.button_text}</a>` : ''}
      </div>
    `).join('');
  } catch (e) { console.error(e); }
}

// =========== HOME PRODUCTS ===========
async function loadHomeProducts() {
  try {
    const res = await fetch(`${API}/home-products`);
    const data = await res.json();
    const container = document.getElementById('home-products');
    let html = '';
    if (data.news && data.news.length) html += renderBlock(t('home_new'), data.news);
    if (data.bestsellers && data.bestsellers.length) html += renderBlock(t('home_bestseller'), data.bestsellers);
    if (data.recommended && data.recommended.length) html += renderBlock(t('home_recommended'), data.recommended);
    if (data.limited && data.limited.length) html += renderBlock(t('home_limited'), data.limited);
    container.innerHTML = html;
    setTimeout(() => {
      document.querySelectorAll('.home-product-card').forEach((el, i) => {
        setTimeout(() => {
          el.style.opacity = '0';
          el.style.transform = 'translateY(20px)';
          el.style.transition = 'all 0.5s ease';
          requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
        }, i * 100);
      });
    }, 300);
  } catch (e) { console.error(e); }
}

function renderBlock(title, products) {
  return `<div class="section-block">
    <div class="container">
      <h2>${title}</h2>
      <div class="home-products-grid">
        ${products.map(p => {
          const imgSrc = p.image ? `/uploads/${p.image}` : null;
          return `<div class="home-product-card" onclick="showProduct('${p.id}')">
            <div class="hp-image">
              ${imgSrc ? `<img src="${imgSrc}" alt="${p.name}" loading="lazy">` : '<span class="placeholder-icon">🎨</span>'}
            </div>
            <div class="hp-info">
              <div class="hp-name">${p.name}</div>
              <div>
                <span class="hp-price">${formatPrice(p.price)} ₼</span>
                ${p.discount && p.old_price ? `<span class="hp-old-price">${formatPrice(p.old_price)} ₼</span>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}

// =========== CATALOG ===========
async function loadCatalog() {
  try {
    const category = document.getElementById('filter-category').value;
    const difficulty = document.getElementById('filter-difficulty').value;
    const sort = document.getElementById('filter-sort').value;
    const search = document.getElementById('search-input').value;
    let url = `${API}/products?visible=1`;
    if (category !== 'all') url += `&category=${category}`;
    if (difficulty !== 'all') url += `&difficulty=${difficulty}`;
    if (sort !== 'default') url += `&sort=${sort}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const res = await fetch(url);
    allProducts = await res.json();
    renderCatalog();
  } catch (e) { console.error(e); }
}

function renderCatalog() {
  const grid = document.getElementById('catalog-grid');
  const empty = document.getElementById('catalog-empty');
  if (!allProducts.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  const diffIcons = { 'Лёгкий': '🟢', 'Средний': '🟡', 'Сложный': '🔴' };
  grid.innerHTML = allProducts.map(p => {
    const mainImg = p.images && p.images.length ? p.images.find(i => i.is_main) || p.images[0] : null;
    const imgSrc = mainImg ? `/uploads/${mainImg.filename}` : null;
    const hasDiscount = p.discount && p.old_price;
    return `<div class="product-card" onclick="showProduct('${p.id}')">
      <div class="product-image">
        ${imgSrc ? `<img src="${imgSrc}" alt="${p.name}" loading="lazy">` : '<span class="placeholder-icon">🎨</span>'}
        <div class="product-badges">
          ${p.is_new ? `<span class="badge badge-new">${t('home_new')}</span>` : ''}
          ${p.is_bestseller ? `<span class="badge badge-bestseller">${t('home_bestseller')}</span>` : ''}
          ${p.is_limited ? `<span class="badge badge-limited">${t('home_limited')}</span>` : ''}
          ${hasDiscount ? `<span class="badge badge-discount">-${p.discount_percent}%</span>` : ''}
        </div>
      </div>
      <div class="product-info">
        <div class="product-category">${p.category_name || ''}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-meta">
          <span>${diffIcons[p.difficulty] || '⚪'} ${p.difficulty === 'Лёгкий' ? t('diff_easy') : p.difficulty === 'Средний' ? t('diff_medium') : p.difficulty === 'Сложный' ? t('diff_hard') : p.difficulty}</span>
          <span>🎨 ${p.colors_count} ${currentLang === 'az' ? 'rəng' : 'цв.'}</span>
        </div>
        <div class="product-price">
          <span class="price-current">${formatPrice(p.price)} ₼</span>
          ${hasDiscount ? `<span class="price-old">${formatPrice(p.old_price)} ₼</span><span class="price-discount">-${p.discount_percent}%</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.product-card').forEach((el, i) => {
    setTimeout(() => observer.observe(el), i * 50);
  });
}

function applyFilters() { loadCatalog(); }

// =========== PRODUCT DETAIL ===========
async function showProduct(id) {
  showSection('product');
  try {
    const res = await fetch(`${API}/products/${id}`);
    const p = await res.json();
    const container = document.getElementById('product-detail');
    const mainImg = p.images && p.images.length ? p.images.find(i => i.is_main) || p.images[0] : null;
    const hasDiscount = p.discount && p.old_price;
    const diffIcons = { 'Лёгкий': '🟢', 'Средний': '🟡', 'Сложный': '🔴' };
    let sizes = [];
    try { sizes = JSON.parse(p.sizes || '[]'); } catch(e) {}

    container.innerHTML = `<div class="product-detail${p.images && p.images.length ? ' gallery-loaded' : ''}">
      <div class="product-detail-gallery">
        <div class="product-detail-main-image">
          ${mainImg ? `<img src="/uploads/${mainImg.filename}" alt="${p.name}" id="main-product-image">` : '<span style="font-size:80px;opacity:0.3">🎨</span>'}
        </div>
        ${p.images && p.images.length > 1 ? `<div class="product-detail-thumbs">
          ${p.images.map(img => `<img src="/uploads/${img.filename}" class="${img.is_main ? 'active' : ''}" onclick="document.getElementById('main-product-image').src='/uploads/${img.filename}';document.querySelectorAll('.product-detail-thumbs img').forEach(el=>el.classList.remove('active'));this.classList.add('active')">`).join('')}
        </div>` : ''}
      </div>
      <div class="product-detail-info">
        <h2>${p.name}</h2>
        ${p.description ? `<div class="product-detail-description">${p.description}</div>` : ''}
        <div class="product-detail-specs">
          <div class="spec-item"><div class="spec-label">${currentLang === 'az' ? 'Çətinlik' : 'Сложность'}</div><div class="spec-value">${diffIcons[p.difficulty] || ''} ${p.difficulty === 'Лёгкий' ? t('diff_easy') : p.difficulty === 'Средний' ? t('diff_medium') : p.difficulty === 'Сложный' ? t('diff_hard') : p.difficulty}</div></div>
          <div class="spec-item"><div class="spec-label">${currentLang === 'az' ? 'Rəng sayı' : 'Количество цветов'}</div><div class="spec-value">${p.colors_count}</div></div>
          <div class="spec-item"><div class="spec-label">${currentLang === 'az' ? 'İstehsalçı' : 'Производитель'}</div><div class="spec-value">${p.manufacturer}</div></div>
          ${sizes.length ? `<div class="spec-item"><div class="spec-label">${currentLang === 'az' ? 'Ölçülər' : 'Размеры'}</div><div class="spec-value">${sizes.join(', ')}</div></div>` : ''}
          <div class="spec-item"><div class="spec-label">${currentLang === 'az' ? 'Stok' : 'В наличии'}</div><div class="spec-value">${p.stock > 0 ? `${p.stock} ${currentLang === 'az' ? 'əd.' : 'шт.'}` : currentLang === 'az' ? 'Yoxdur' : 'Нет в наличии'}</div></div>
        </div>
        ${p.includes ? `<div style="margin-top:24px"><div class="spec-label" style="margin-bottom:8px">${currentLang === 'az' ? 'Komplektasiya' : 'Комплектация'}</div><div style="color:rgba(240,236,227,0.8)">${p.includes}</div></div>` : ''}
      </div>
      <div class="product-detail-purchase">
        <div class="purchase-card">
          <div class="purchase-price">
            <span class="current">${formatPrice(p.price)} ₼</span>
            ${hasDiscount ? `<span class="old">${formatPrice(p.old_price)} ₼</span>
            <span class="discount-badge">-${p.discount_percent}%</span>` : ''}
          </div>
          <div class="purchase-actions">
            <button class="btn btn-primary" onclick="addToCart('${p.id}','${p.name.replace(/'/g, "\\'")}',${p.price})">${t('product_cart')}</button>
            <button class="btn btn-outline" onclick="showSection('catalog')">${t('product_continue')}</button>
          </div>
        </div>
      </div>
    </div>`;
  } catch (e) { console.error(e); }
}

// =========== CART (CONTACT-BASED, NO PAYMENT) ===========
function addToCart(id, name, price) {
  const existing = cart.find(i => i.id === id);
  if (existing) { existing.quantity += 1; }
  else { cart.push({ id, name, price, quantity: 1 }); }
  saveCart();
  updateCartCount();
  showToast(`«${name}» ${t('toast_added')}`);
}

function removeFromCart(id) {
  const item = cart.find(i => i.id === id);
  cart = cart.filter(i => i.id !== id);
  saveCart();
  updateCartCount();
  renderCart();
  if (item) showToast(`«${item.name}» ${t('toast_removed')}`);
}

function updateQuantity(id, delta) {
  const item = cart.find(i => i.id === id);
  if (item) { item.quantity = Math.max(1, item.quantity + delta); saveCart(); updateCartCount(); renderCart(); }
}

function saveCart() { localStorage.setItem('shop_cart', JSON.stringify(cart)); }
function updateCartCount() { document.getElementById('cart-count').textContent = cart.reduce((s, i) => s + i.quantity, 0); }
function getCartTotal() { return cart.reduce((s, i) => s + i.price * i.quantity, 0); }

function formatPrice(n) { return Number(n).toLocaleString('ru-RU'); }

function renderCart() {
  const container = document.getElementById('cart-content');
  if (!cart.length) {
    container.innerHTML = `<div class="cart-empty"><p>${t('cart_empty')}</p><br><a href="#" class="btn btn-primary" onclick="showSection('catalog')">${t('cart_go')}</a></div>`;
    return;
  }

  const ids = cart.map(i => i.id);
  Promise.all(ids.map(id => fetch(`${API}/products/${id}`).then(r => r.json())))
    .then(products => {
      const productMap = {};
      products.forEach(p => { productMap[p.id] = p; });

      container.innerHTML = `<div class="cart-items">
        ${cart.map(item => {
          const p = productMap[item.id];
          const img = p && p.images && p.images.length ? p.images.find(i => i.is_main) || p.images[0] : null;
          const imgSrc = img ? `/uploads/${img.filename}` : null;
          return `<div class="cart-item">
            <div class="cart-item-img">
              ${imgSrc ? `<img src="${imgSrc}" alt="${item.name}">` : '<span>🎨</span>'}
            </div>
            <div class="cart-item-info">
              <h4>${item.name}</h4>
              <p>${formatPrice(item.price)} ₼ × ${item.quantity}</p>
            </div>
            <div class="cart-item-actions">
              <button class="qty-btn" onclick="updateQuantity('${item.id}', -1)">−</button>
              <span>${item.quantity}</span>
              <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
              <span class="cart-item-total">${formatPrice(item.price * item.quantity)} ₼</span>
              <button class="cart-remove" onclick="removeFromCart('${item.id}')">✕</button>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="cart-summary" style="text-align:center">
        <div class="cart-total" style="justify-content:center;font-size:20px;margin-bottom:24px">
          <span>${t('cart_total')}</span>
          <span style="margin-left:8px">${formatPrice(getCartTotal())} ₼</span>
        </div>
        <form id="order-form" class="cart-form" onsubmit="submitOrder(event)" style="max-width:400px;margin:0 auto">
          <input type="text" name="name" placeholder="${t('order_name')}" required>
          <input type="tel" name="phone" placeholder="${t('order_phone')}" required>
          <textarea name="comment" placeholder="${t('order_comment')}"></textarea>
          <button type="submit" class="btn btn-primary" style="font-size:16px;padding:14px 32px">${t('order_btn')} — ${formatPrice(getCartTotal())} ₼</button>
        </form>
        <div style="margin-top:16px">
          <button class="btn btn-primary" onclick="showSection('catalog')" style="background:var(--glass);color:var(--gold);border:1px solid var(--gold);font-size:14px;padding:10px 24px">← ${t('cart_go')}</button>
        </div>
      </div>`;
    });
}

async function submitOrder(e) {
  e.preventDefault();
  const form = e.target;
  const data = {
    name: form.name.value.trim(),
    phone: form.phone.value.trim(),
    comment: form.comment.value.trim(),
    items: JSON.stringify(cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })))
  };
  if (!data.name || !data.phone) { showToast(t('order_required'), 'error'); return; }
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = '...';
  try {
    const res = await fetch(`${API}/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error();
    cart = []; saveCart(); updateCartCount();
    form.innerHTML = `<div style="padding:32px 0">
      <h3 style="color:var(--gold)">${t('order_success_title')}</h3>
      <p style="margin:12px 0 24px">${t('order_success_text')}</p>
      <button class="btn btn-primary" onclick="showSection('catalog')">${t('cart_go')}</button>
    </div>`;
  } catch(e) {
    btn.disabled = false; btn.textContent = t('order_btn');
    showToast(t('order_error'), 'error');
  }
}

// =========== ABOUT / CONTACT ===========
async function loadAbout() {
  try {
    const res = await fetch(`${API}/settings/public`);
    const s = await res.json();
    document.getElementById('about-text').innerHTML = s.about_text ? `<p>${s.about_text}</p>` : '<p>Rəqəmlərlə rəsmlər — yaradıcılığı zövqə çevirir.</p>';
  } catch(e) {
    document.getElementById('about-text').innerHTML = '<p>Rəqəmlərlə rəsmlər — yaradıcılığı zövqə çevirir.</p>';
  }
}

async function loadContact() {
  try {
    const res = await fetch(`${API}/settings/public`);
    const s = await res.json();
    document.getElementById('contact-content').innerHTML = `
      <div class="contact-info">
        ${s.phone ? `<div class="contact-item"><span class="icon">📞</span><span class="text"><strong>${t('contact_phone')}:</strong> ${s.phone}</span></div>` : ''}
        ${s.email ? `<div class="contact-item"><span class="icon">✉️</span><span class="text"><strong>${t('contact_email')}:</strong> ${s.email}</span></div>` : ''}
        ${s.address ? `<div class="contact-item"><span class="icon">📍</span><span class="text"><strong>${t('contact_address')}:</strong> ${s.address}</span></div>` : ''}
      </div>
      <h3 style="font-family:var(--font-display);color:var(--light-gold);margin:24px 0 12px">${t('contact_social')}</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${(allSettings.social_links || []).filter(s => s.url && s.url !== '#').map(s =>
          `<a href="${s.url}" class="btn btn-outline" target="_blank">${s.icon || ''} ${s.name}</a>`
        ).join('')}
      </div>`;
  } catch(e) {
    document.getElementById('contact-content').innerHTML = `<p>${t('contact_unavailable')}</p>`;
  }
}

// =========== UTILS ===========
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._hide);
  toast._hide = setTimeout(() => toast.classList.remove('show'), 3000);
}

function closeModal(e) {
  const modal = document.getElementById('modal');
  if (!e || e.target === modal) modal.classList.remove('open');
}

function openModal(html) {
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal').classList.add('open');
}

function toggleMobileMenu() {
  document.querySelector('.nav-menu').classList.toggle('open');
}
