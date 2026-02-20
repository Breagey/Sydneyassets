// File: scripts/app.js

// === Custom Select (ONLY for #loc and #type) ================================
(function () {
  function enhanceSelect(select) {
    if (!select || select.dataset.enhanced === "1" || select.multiple || select.size > 1) return;

    const wrapper = document.createElement("div");
    wrapper.className = "cselect";
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    select.dataset.enhanced = "1";
    select.tabIndex = -1; // remove native from tab order

    // Trigger button
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cselect__btn";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    wrapper.appendChild(btn);

    // Panel
    const panel = document.createElement("ul");
    panel.className = "cselect__panel";
    panel.setAttribute("role", "listbox");
    panel.id = `cs-${Math.random().toString(36).slice(2, 9)}`;
    btn.setAttribute("aria-controls", panel.id);
    wrapper.appendChild(panel);

    const options = Array.from(select.options);
    let activeIndex = Math.max(0, options.findIndex(o => o.selected));

    function setButtonLabel() {
      const sel = select.selectedOptions[0];
      btn.textContent = sel ? sel.textContent : "Select…";
    }

    function renderOptions() {
      panel.innerHTML = "";
      options.forEach((opt, idx) => {
        const li = document.createElement("li");
        li.className = "cselect__opt";
        li.setAttribute("role", "option");
        li.textContent = opt.textContent;
        li.dataset.value = opt.value;
        if (opt.disabled) li.setAttribute("aria-disabled", "true");
        if (opt.selected) li.setAttribute("aria-selected", "true");
        if (idx === activeIndex) li.setAttribute("data-active", "1");
        li.addEventListener("click", () => {
          if (opt.disabled) return;
          select.value = opt.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          setButtonLabel();
          close();
        });
        panel.appendChild(li);
      });
    }

    function keepActiveInView() {
      const a = panel.querySelector('[data-active="1"]');
      if (!a) return;
      const top = a.offsetTop, bottom = top + a.offsetHeight;
      if (top < panel.scrollTop) panel.scrollTop = top;
      else if (bottom > panel.scrollTop + panel.clientHeight) panel.scrollTop = bottom - panel.clientHeight;
    }

    function open() {
      wrapper.setAttribute("data-open", "true");
      btn.setAttribute("aria-expanded", "true");
      renderOptions();
      const a = panel.querySelector('[data-active="1"]');
      if (a) panel.scrollTop = a.offsetTop - panel.clientHeight / 2 + a.clientHeight / 2;
      panel.tabIndex = -1;
      panel.focus({ preventScroll: true });
      document.addEventListener("click", onDocClick);
      document.addEventListener("keydown", onKeydown);
    }

    function close() {
      wrapper.removeAttribute("data-open");
      btn.setAttribute("aria-expanded", "false");
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeydown);
    }

    function toggle() { (wrapper.getAttribute("data-open") === "true") ? close() : open(); }
    function onDocClick(e) { if (!wrapper.contains(e.target)) close(); }

    function onKeydown(e) {
      if (wrapper.getAttribute("data-open") !== "true") return;
      const max = options.length - 1;
      if (e.key === "ArrowDown") { e.preventDefault(); activeIndex = Math.min(max, activeIndex + 1); renderOptions(); keepActiveInView(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); activeIndex = Math.max(0, activeIndex - 1); renderOptions(); keepActiveInView(); }
      else if (e.key === "Home") { e.preventDefault(); activeIndex = 0; renderOptions(); keepActiveInView(); }
      else if (e.key === "End") { e.preventDefault(); activeIndex = max; renderOptions(); keepActiveInView(); }
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const opt = options[activeIndex]; if (!opt.disabled) {
          select.value = opt.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          setButtonLabel(); close();
        }
      } else if (e.key === "Escape" || e.key === "Tab") {
        close();
      }
    }

    btn.addEventListener("click", toggle);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ") { e.preventDefault(); open(); }
    });

    select.addEventListener("change", () => {
      activeIndex = Math.max(0, options.findIndex(o => o.value === select.value));
      options.forEach(o => (o.selected = (o.value === select.value)));
      setButtonLabel();
    });

    setButtonLabel();
  }

  // Enhance ONLY #loc and #type
  window.addEventListener("DOMContentLoaded", () => {
    enhanceSelect(document.getElementById("loc"));
    enhanceSelect(document.getElementById("type"));
  });
})();

// === Search & Demo Rendering ===============================================

const DATA = [
  { id:1, title:'9 Lady Penrhyn Drive, Beacon Hill NSW 2100', type:'House',     status:'For Sale', bedrooms:5, bathrooms:5, price:750000, area:500, location:'Beacon Hill', garages:2 },
  { id:2, title:'2303a/148 Elizabeth St, Sydney, NSW, 2000',  type:'Apartment', status:'For Sale', bedrooms:2, bathrooms:2, price:1450000, area:102, location:'Sydney', garages:1 },
  { id:3, title:'1901/91 Liverpool St, Sydney NSW 2000',      type:'Apartment', status:'For Sale', bedrooms:1, bathrooms:1, price:650,    area:62,  location:'Sydney', garages:0 },
];

const form = document.querySelector('.search-form');
const box  = document.getElementById('results');

const toNum = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const parsePlus = (v) => {
  if (!v) return null;
  if (v.endsWith('+')) return Number(v.slice(0, -1));
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Keep pasted input to digits only (safeguard for some browsers)
function digitsOnly(el) {
  el?.addEventListener('input', () => {
    const cleaned = el.value.replace(/[^\d]/g, '');
    if (el.value !== cleaned) el.value = cleaned;
  });
}

// If both present and reversed, swap for nicer UX
function ensureOrdered(minInput, maxInput) {
  const minVal = toNum(minInput.value);
  const maxVal = toNum(maxInput.value);
  if (minVal != null && maxVal != null && minVal > maxVal) {
    [minInput.value, maxInput.value] = [maxInput.value, minInput.value];
    return { min: maxVal, max: minVal };
  }
  return { min: minVal, max: maxVal };
}

// Core filter using current form values
function applyFilters(items) {
  const F = form.elements;

  const q        = (F['q']?.value || '').trim().toLowerCase();
  const location = F['location']?.value || '';
  const status   = F['status']?.value || '';
  const type     = F['type']?.value || '';

  const minBeds  = parsePlus(F['min_beds']?.value || '');
  const minBaths = parsePlus(F['min_baths']?.value || '');

  const { min: minPrice, max: maxPrice } = ensureOrdered(F['min_price'], F['max_price']);
  const { min: minArea,  max: maxArea  } = ensureOrdered(F['min_area'],  F['max_area']);

  return items.filter(it => {
    if (q && !(it.title.toLowerCase().includes(q) || it.location.toLowerCase().includes(q))) return false;

    if (location && it.location.toLowerCase() !== location.toLowerCase()) return false;
    if (status   && it.status   !== status)   return false;
    if (type     && it.type     !== type)     return false;

    if (minBeds  != null && it.bedrooms <  minBeds) return false;
    if (minBaths != null && it.bathrooms < minBaths) return false;
    if (minPrice != null && toNum(it.price) <  minPrice) return false;
    if (maxPrice != null && toNum(it.price) >  maxPrice) return false;
    if (minArea  != null && it.area  <     minArea)  return false;
    if (maxArea  != null && it.area  >     maxArea)  return false;

    return true;
  });
}

// Display helpers
function formatPrice(p, status){
  const n = Number(p);
  if (!Number.isFinite(n)) return null;
  return status === 'For Rent' ? `A$${n.toLocaleString()}/wk` : `A$${n.toLocaleString()}`;
}
function garageLabel(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return `${n} garage${n === 1 ? '' : 's'}`;
}

// Render (image + price + features + garages)
function render(items) {
  if (!items.length) {
    box.innerHTML = `<p class="meta">No results. Try changing filters.</p>`;
    return;
  }

  const cards = items.map(it => {
    const features = [
      `${it.bedrooms} bed`,
      `${it.bathrooms} bath`,
      `${it.area} m²`,
      garageShort(it.garages)
    ].filter(Boolean).join(' • ');

    const priceText = formatPrice(it.price, it.status);
    const imgSrc = `images/listing${it.id}-0.png`;
    const detailsHref = `listings/${listingPage(it.id)}`;

    return `
      <article class="card">
        <img src="${imgSrc}" alt="Property Image" class="listing-img" loading="lazy" />
        <h3><a href="${detailsHref}">${it.title}</a></h3>
        <div class="muted">${it.location} • ${it.type} • ${it.status}</div>
        <div class="muted">${features}</div>
        ${priceText ? `<div class="price">${priceText}</div>` : ``}
      </article>
    `;
  }).join('');

  box.innerHTML = `
    <p class="meta"><strong>${items.length}</strong> result${items.length > 1 ? 's' : ''}</p>
    <div class="grid">${cards}</div>
  `;
}

// URL sync (apply only on submit)
function syncUrlFromForm() {
  const fd = new FormData(form);
  const entries = [...fd.entries()].filter(([,v]) => v !== '');
  const qs = new URLSearchParams(entries).toString();
  const url = qs ? `?${qs}` : location.pathname;
  history.replaceState(null, '', url);
}

// Hydrate form from URL on first load (for shared links)
function hydrateFormFromUrl() {
  const params = new URLSearchParams(location.search);
  for (const [k, v] of params.entries()) {
    if (form.elements[k]) form.elements[k].value = v;
  }
  return [...params.keys()].length > 0;
}

function garageShort(n) {
  const g = Number(n);
  if (!Number.isFinite(g) || g === 0) return null;
  return `${g} garage${g === 1 ? '' : 's'}`;
}

// Wire-up
window.addEventListener('DOMContentLoaded', () => {
  // numeric field hygiene only (does not filter)
  ['min_price','max_price','min_area','max_area'].forEach(n => digitsOnly(form.elements[n]));

  const hasQuery = hydrateFormFromUrl();

  // Initial render:
  // - If URL has filters, apply them (shared link)
  // - Otherwise show all items (no filtering until Search is clicked)
  if (hasQuery) {
    render(applyFilters(DATA));
  } else {
    render(DATA);
  }
});

// Apply filters ONLY on Search (no live filtering)
form.addEventListener('submit', (e) => {
  e.preventDefault();
  syncUrlFromForm();
  render(applyFilters(DATA));
});

// IMPORTANT: No 'change' or 'input' listeners here — filters run only on submit.

function listingPage(id) {
  return `listing${id}.html`;
}