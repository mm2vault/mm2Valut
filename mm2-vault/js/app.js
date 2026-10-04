/* ============================================
   MM2 Vault — Application Logic
   ============================================ */

let items = [];
let filteredItems = [];
let currentFilters = {
  search: '',
  rarity: 'all',
  type: 'all',
  sort: 'highest'
};

let tradeLeft = [];
let tradeRight = [];
let favorites = new Set(JSON.parse(localStorage.getItem('mm2vault_favorites') || '[]'));

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', async () => {
  await loadItems();
  initNavigation();
  initMobileMenu();
  initSearch();
  initFilters();
  initTrade();
  initShop();
  initLeaderboard();
  initProfile();
  renderMarket();
  updateStats();
  renderHomeTrending();
  showPage('home');
});

async function loadItems() {
  try {
    const res = await fetch('data/items.json');
    items = await res.json();
    filteredItems = [...items];
  } catch (e) {
    console.error('Failed to load items:', e);
    items = [];
    filteredItems = [];
  }
}

// ---------- Navigation ----------
function initNavigation() {
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const page = el.dataset.page;
      showPage(page);
      closeMobileMenu();
    });
  });
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(`page-${pageId}`);
  if (page) {
    page.classList.add('active');
  }

  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === pageId);
  });

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Page-specific renders
  if (pageId === 'market') renderMarket();
  if (pageId === 'trade') updateTradeUI();
}

function initMobileMenu() {
  const btn = document.getElementById('hamburger');
  const menu = document.getElementById('mobile-menu');
  if (!btn || !menu) return;

  btn.addEventListener('click', () => {
    btn.classList.toggle('open');
    menu.classList.toggle('open');
    document.body.style.overflow = menu.classList.contains('open') ? 'hidden' : '';
  });
}

function closeMobileMenu() {
  const btn = document.getElementById('hamburger');
  const menu = document.getElementById('mobile-menu');
  if (btn) btn.classList.remove('open');
  if (menu) menu.classList.remove('open');
  document.body.style.overflow = '';
}

// ---------- Search ----------
function initSearch() {
  const heroSearch = document.getElementById('hero-search-input');
  const heroBtn = document.getElementById('hero-search-btn');
  const marketSearch = document.getElementById('market-search-input');

  if (heroBtn) {
    heroBtn.addEventListener('click', () => {
      const q = heroSearch?.value?.trim() || '';
      currentFilters.search = q;
      if (marketSearch) marketSearch.value = q;
      showPage('market');
      applyFilters();
    });
  }

  if (heroSearch) {
    heroSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        heroBtn?.click();
      }
    });
  }

  if (marketSearch) {
    marketSearch.addEventListener('input', debounce(() => {
      currentFilters.search = marketSearch.value.trim();
      applyFilters();
    }, 250));
  }
}

// ---------- Filters ----------
function initFilters() {
  document.querySelectorAll('.filter-chip[data-rarity]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip[data-rarity]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilters.rarity = chip.dataset.rarity;
      applyFilters();
    });
  });

  document.querySelectorAll('.filter-chip[data-type]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip[data-type]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilters.type = chip.dataset.type;
      applyFilters();
    });
  });

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      currentFilters.sort = sortSelect.value;
      applyFilters();
    });
  }
}

function applyFilters() {
  let result = [...items];

  if (currentFilters.search) {
    const q = currentFilters.search.toLowerCase();
    result = result.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.rarity.toLowerCase().includes(q) ||
      i.type.toLowerCase().includes(q)
    );
  }

  if (currentFilters.rarity !== 'all') {
    result = result.filter(i => i.rarity.toLowerCase() === currentFilters.rarity.toLowerCase());
  }

  if (currentFilters.type !== 'all') {
    result = result.filter(i => i.type.toLowerCase() === currentFilters.type.toLowerCase());
  }

  switch (currentFilters.sort) {
    case 'highest':
      result.sort((a, b) => b.value - a.value);
      break;
    case 'lowest':
      result.sort((a, b) => a.value - b.value);
      break;
    case 'demand':
      result.sort((a, b) => b.demand - a.demand);
      break;
    case 'trending':
      result.sort((a, b) => b.trend - a.trend);
      break;
    case 'newest':
      result.sort((a, b) => b.year - a.year);
      break;
    case 'name':
      result.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  filteredItems = result;
  renderMarket();
}

// ---------- Market Render ----------
function renderMarket() {
  const grid = document.getElementById('item-grid');
  if (!grid) return;

  if (filteredItems.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <p>No items found matching your filters.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filteredItems.map(item => createItemCard(item)).join('');

  grid.querySelectorAll('.item-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      openItemDetail(id);
    });
  });
}

function createItemCard(item) {
  const rarityClass = `rarity-${item.rarity.toLowerCase()}`;
  const trendClass = item.trend > 0 ? 'up' : item.trend < 0 ? 'down' : 'neutral';
  const trendSign = item.trend > 0 ? '+' : '';
  const demandDots = Array.from({ length: 10 }, (_, i) =>
    `<span class="demand-dot ${i < item.demand ? 'filled' : ''}"></span>`
  ).join('');

  return `
    <article class="item-card" data-id="${item.id}">
      <div class="item-card-image">
        <span class="item-card-rarity ${rarityClass}">${item.rarity}</span>
        <img src="${item.image}" alt="${item.name}" loading="lazy" />
      </div>
      <div class="item-card-body">
        <h3 class="item-card-name">${item.name}</h3>
        <div class="item-card-meta">
          <span>${item.type}</span>
          <div class="demand-dots" title="Demand: ${item.demand}/10">${demandDots}</div>
        </div>
        <div class="item-card-footer">
          <span class="item-value">${formatValue(item.value)}</span>
          <span class="item-trend ${trendClass}">${trendSign}${item.trend}%</span>
        </div>
      </div>
    </article>
  `;
}

function formatValue(val) {
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (val >= 1_000) return (val / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return val.toLocaleString();
}

// ---------- Item Detail Modal ----------
function openItemDetail(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('item-modal');
  if (!overlay || !modal) return;

  const rarityClass = `rarity-${item.rarity.toLowerCase()}`;
  const isFav = favorites.has(item.id);
  const trendClass = item.trend > 0 ? 'up' : item.trend < 0 ? 'down' : 'neutral';
  const trendSign = item.trend > 0 ? '+' : '';

  // Similar items (same rarity or type)
  const similar = items
    .filter(i => i.id !== item.id && (i.rarity === item.rarity || i.type === item.type))
    .slice(0, 4);

  modal.innerHTML = `
    <div class="modal-header">
      <span style="font-weight:600;font-size:0.95rem;">Item Details</span>
      <button class="modal-close" id="modal-close" aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="modal-body">
      <div class="detail-grid">
        <div class="detail-image-wrap">
          <img src="${item.image}" alt="${item.name}" />
        </div>
        <div class="detail-info">
          <h2>${item.name}</h2>
          <div class="detail-badges">
            <span class="badge badge-rarity ${rarityClass}">${item.rarity}</span>
            <span class="badge badge-type">${item.type}</span>
          </div>
          <div class="detail-stats">
            <div class="detail-stat">
              <div class="detail-stat-label">Value</div>
              <div class="detail-stat-value" style="color:var(--accent-cyan)">${formatValue(item.value)}</div>
            </div>
            <div class="detail-stat">
              <div class="detail-stat-label">Demand</div>
              <div class="detail-stat-value">${item.demand}/10</div>
            </div>
            <div class="detail-stat">
              <div class="detail-stat-label">Trend</div>
              <div class="detail-stat-value ${trendClass}">${trendSign}${item.trend}%</div>
            </div>
            <div class="detail-stat">
              <div class="detail-stat-label">Year</div>
              <div class="detail-stat-value">${item.year}</div>
            </div>
            <div class="detail-stat">
              <div class="detail-stat-label">Obtained</div>
              <div class="detail-stat-value" style="font-size:0.95rem">${item.obtained}</div>
            </div>
          </div>
          <div class="detail-actions">
            <button class="btn btn-primary" id="btn-add-trade" data-id="${item.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Add to Trade
            </button>
            <button class="btn btn-secondary" id="btn-favorite" data-id="${item.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              ${isFav ? 'Favorited' : 'Favorite'}
            </button>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3>Value History</h3>
        <div class="chart-placeholder">
          <svg viewBox="0 0 400 120" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgba(139,92,246,0.3)"/>
                <stop offset="100%" stop-color="rgba(139,92,246,0)"/>
              </linearGradient>
            </defs>
            <path d="M0,90 L40,85 L80,70 L120,75 L160,55 L200,50 L240,40 L280,45 L320,30 L360,25 L400,20 L400,120 L0,120 Z" fill="url(#chartGrad)"/>
            <path d="M0,90 L40,85 L80,70 L120,75 L160,55 L200,50 L240,40 L280,45 L320,30 L360,25 L400,20" fill="none" stroke="#8b5cf6" stroke-width="2"/>
          </svg>
        </div>
      </div>

      <div class="detail-section">
        <h3>About</h3>
        <p class="detail-desc">${item.description}</p>
      </div>

      ${similar.length ? `
      <div class="detail-section">
        <h3>Similar Items</h3>
        <div class="similar-grid">
          ${similar.map(s => `
            <div class="similar-card" data-id="${s.id}">
              <img src="${s.image}" alt="${s.name}" />
              <span>${s.name}</span>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>
  `;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Events
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  document.getElementById('btn-add-trade')?.addEventListener('click', () => {
    addToTrade(item, 'left');
    closeModal();
    showPage('trade');
    showToast(`${item.name} added to your side`);
  });

  document.getElementById('btn-favorite')?.addEventListener('click', () => {
    toggleFavorite(item.id);
    openItemDetail(item.id); // re-render
  });

  modal.querySelectorAll('.similar-card').forEach(c => {
    c.addEventListener('click', () => openItemDetail(c.dataset.id));
  });
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function toggleFavorite(id) {
  if (favorites.has(id)) {
    favorites.delete(id);
    showToast('Removed from favorites');
  } else {
    favorites.add(id);
    showToast('Added to favorites');
  }
  localStorage.setItem('mm2vault_favorites', JSON.stringify([...favorites]));
}

// ---------- Trade ----------
function initTrade() {
  document.getElementById('trade-add-left')?.addEventListener('click', () => openTradePicker('left'));
  document.getElementById('trade-add-right')?.addEventListener('click', () => openTradePicker('right'));
}

function addToTrade(item, side) {
  const list = side === 'left' ? tradeLeft : tradeRight;
  if (list.find(i => i.id === item.id)) {
    showToast('Item already in trade');
    return;
  }
  list.push(item);
  updateTradeUI();
}

function removeFromTrade(id, side) {
  if (side === 'left') {
    tradeLeft = tradeLeft.filter(i => i.id !== id);
  } else {
    tradeRight = tradeRight.filter(i => i.id !== id);
  }
  updateTradeUI();
}

function updateTradeUI() {
  const leftContainer = document.getElementById('trade-items-left');
  const rightContainer = document.getElementById('trade-items-right');
  const leftTotal = document.getElementById('trade-total-left');
  const rightTotal = document.getElementById('trade-total-right');
  const resultEl = document.getElementById('trade-result');

  if (!leftContainer || !rightContainer) return;

  const renderSide = (list, container, side) => {
    if (list.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:24px 0;">No items added</p>`;
      return;
    }
    container.innerHTML = list.map(item => `
      <div class="trade-item">
        <img src="${item.image}" alt="${item.name}" />
        <div class="trade-item-info">
          <div class="trade-item-name">${item.name}</div>
          <div class="trade-item-value">${formatValue(item.value)}</div>
        </div>
        <button class="trade-item-remove" data-id="${item.id}" data-side="${side}" aria-label="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `).join('');

    container.querySelectorAll('.trade-item-remove').forEach(btn => {
      btn.addEventListener('click', () => removeFromTrade(btn.dataset.id, btn.dataset.side));
    });
  };

  renderSide(tradeLeft, leftContainer, 'left');
  renderSide(tradeRight, rightContainer, 'right');

  const leftSum = tradeLeft.reduce((s, i) => s + i.value, 0);
  const rightSum = tradeRight.reduce((s, i) => s + i.value, 0);

  if (leftTotal) leftTotal.textContent = formatValue(leftSum);
  if (rightTotal) rightTotal.textContent = formatValue(rightSum);

  // Result
  if (resultEl) {
    if (leftSum === 0 && rightSum === 0) {
      resultEl.className = 'trade-result fair';
      resultEl.innerHTML = `
        <div class="trade-result-label">—</div>
        <div class="trade-result-diff">Add items to compare</div>
      `;
    } else {
      const diff = leftSum - rightSum;
      const pct = rightSum > 0 ? ((diff / rightSum) * 100) : (leftSum > 0 ? 100 : 0);
      let status, label;
      if (Math.abs(pct) < 5) {
        status = 'fair';
        label = 'FAIR';
      } else if (diff > 0) {
        status = 'win';
        label = 'WIN';
      } else {
        status = 'lose';
        label = 'LOSE';
      }
      resultEl.className = `trade-result ${status}`;
      resultEl.innerHTML = `
        <div class="trade-result-label">${label}</div>
        <div class="trade-result-diff">${diff >= 0 ? '+' : ''}${formatValue(diff)} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)</div>
      `;
    }
  }
}

function openTradePicker(side) {
  // Simple approach: show a mini list of items to add
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('item-modal');
  if (!overlay || !modal) return;

  const available = items.filter(i => {
    const inLeft = tradeLeft.find(t => t.id === i.id);
    const inRight = tradeRight.find(t => t.id === i.id);
    return !inLeft && !inRight;
  }).slice(0, 12);

  modal.innerHTML = `
    <div class="modal-header">
      <span style="font-weight:600;">Select Item to Add</span>
      <button class="modal-close" id="modal-close" aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="modal-body">
      <div class="item-grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));">
        ${available.map(item => `
          <article class="item-card" data-id="${item.id}" style="cursor:pointer;">
            <div class="item-card-image" style="padding:12px;">
              <img src="${item.image}" alt="${item.name}" />
            </div>
            <div class="item-card-body" style="padding:10px;">
              <h3 class="item-card-name" style="font-size:0.8rem;">${item.name}</h3>
              <div class="item-value" style="font-size:0.85rem;">${formatValue(item.value)}</div>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

  modal.querySelectorAll('.item-card').forEach(card => {
    card.addEventListener('click', () => {
      const item = items.find(i => i.id === card.dataset.id);
      if (item) {
        addToTrade(item, side);
        closeModal();
        showToast(`${item.name} added`);
      }
    });
  });
}

// ---------- Shop ----------
function initShop() {
  const owned = new Set(JSON.parse(localStorage.getItem('mm2vault_owned_cosmetics') || '[]'));
  let coins = Number(localStorage.getItem('mm2vault_coins') || '12450');
  const updateCoins = () => {
    document.querySelectorAll('.coin-balance span:last-child').forEach(el => el.textContent = coins.toLocaleString());
    localStorage.setItem('mm2vault_coins', String(coins));
  };
  document.querySelectorAll('[data-shop-action]').forEach(btn => {
    const name = btn.dataset.name || 'Item';
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const priceText = btn.closest('.shop-card')?.querySelector('.shop-price')?.textContent || '';
    const price = Number(priceText.replace(/[^0-9]/g, '')) || 0;
    if (owned.has(key)) {
      btn.textContent = 'Equip';
      btn.dataset.shopAction = 'equip';
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
    }
    btn.addEventListener('click', () => {
      if (btn.dataset.shopAction === 'buy') {
        if (coins < price) { showToast('Not enough coins'); return; }
        coins -= price;
        owned.add(key);
        localStorage.setItem('mm2vault_owned_cosmetics', JSON.stringify([...owned]));
        btn.textContent = 'Equip';
        btn.dataset.shopAction = 'equip';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
        updateCoins();
        showToast(name + ' purchased!');
      } else if (btn.dataset.shopAction === 'equip') {
        localStorage.setItem('mm2vault_equipped_cosmetic', key);
        document.querySelectorAll('[data-shop-action]').forEach(other => {
          if (other !== btn && other.dataset.shopAction === 'equip') other.disabled = false;
        });
        btn.textContent = 'Equipped';
        btn.disabled = true;
        showToast(name + ' equipped');
      }
    });
  });
  updateCoins();
}

function renderHomeTrending() {
  const grid = document.getElementById('home-trending');
  if (!grid) return;
  const trending = [...items].sort((a,b) => (b.demand * 10 + b.trend) - (a.demand * 10 + a.trend)).slice(0, 5);
  grid.innerHTML = trending.map(item => createItemCard(item)).join('');
  grid.querySelectorAll('.item-card').forEach(card => card.addEventListener('click', () => openItemDetail(card.dataset.id)));

  const featured = trending[0];
  if (featured) {
    const img = document.getElementById('hero-featured-image');
    const name = document.getElementById('featured-name');
    const value = document.getElementById('featured-value');
    const trend = document.getElementById('featured-trend');
    if (img) { img.src = featured.image; img.alt = featured.name; }
    if (name) name.textContent = featured.name;
    if (value) value.textContent = formatValue(featured.value) + ' value';
    if (trend) trend.textContent = (featured.trend >= 0 ? 'TRENDING ↑' : 'DROPPING ↓');
  }
}

// ---------- Leaderboard ----------
function initLeaderboard() {
  document.querySelectorAll('.lb-filter').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.lb-filter').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      // In a real app this would re-fetch; here we just show toast
      showToast(`Showing ${chip.dataset.period} rankings`);
    });
  });
}

// ---------- Profile ----------
function initProfile() {
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.querySelectorAll('.profile-panel').forEach(p => {
        p.style.display = p.dataset.panel === target ? 'block' : 'none';
      });
    });
  });
}

// ---------- Stats ----------
function updateStats() {
  const totalEl = document.getElementById('stat-total');
  const valueEl = document.getElementById('stat-value');
  const tradersEl = document.getElementById('stat-traders');
  const listedEl = document.getElementById('stat-listed');

  if (totalEl) totalEl.textContent = items.length.toLocaleString();
  if (valueEl) {
    const totalVal = items.reduce((s, i) => s + i.value, 0);
    valueEl.textContent = formatValue(totalVal);
  }
  if (tradersEl) tradersEl.textContent = '12.4K';
  if (listedEl) listedEl.textContent = '3.8K';
}

// ---------- Toast ----------
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ---------- Utils ----------
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Keyboard: Escape closes modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
