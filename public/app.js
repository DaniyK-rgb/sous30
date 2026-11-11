/* Sous 30 — interface.
   Les données viennent de deals.json : en local, c'est server.py qui le fabrique à la demande en relevant
   la boutique Steam France ; en ligne, c'est un fichier régénéré toutes les 30 minutes. */
(() => {
  'use strict';

  const CDN = 'https://shared.fastly.steamstatic.com/store_item_assets/';
  const BATCH = 36;             // cartes ajoutées à chaque palier de défilement
  const VISIBLE_GENRES = 14;    // genres affichés avant « + de genres »
  const MAX_PRICE = 30;
  const STORE = 'https://store.steampowered.com/';
  // Genres proposés : identifiants de tags Steam et leur nom français, tel que Steam l'affiche.
  const GENRES = new Map([[19, 'Action'], [21, 'Aventure'], [122, 'RPG'], [9, 'Stratégie'], [599, 'Simulation'],
    [492, 'Indépendant'], [597, 'Casual'], [1662, 'Survie'], [1667, 'Horreur'], [1664, 'Casse-tête'],
    [1625, 'Plateforme'], [1663, 'FPS'], [1774, 'Tir'], [1695, 'Monde ouvert'], [1685, 'Coop'],
    [3859, 'Multijoueur'], [1716, 'Roguelike'], [12472, 'Gestion'], [1643, 'Construction'],
    [4328, 'Construction de villes'], [699, 'Course'], [701, 'Sport'], [1743, 'Combat'], [1628, 'Metroidvania'],
    [3799, 'Roman graphique'], [1698, 'Pointer et cliquer'], [1645, 'Défense de tours'],
    [3942, 'Science-fiction'], [1684, 'Fantasy'], [4085, 'Anime'], [3964, 'Graphismes pixel'], [3810, 'Bac à sable']]);
  const PLATS = [['w', 'WIN'], ['m', 'MAC'], ['l', 'LINUX'], ['d', 'DECK']];
  const BUCKETS = [10, 20, 30, 40, 50, 60, 70, 80, 90];   // tranches de réduction du graphique

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const els = {
    live: $('#live'), liveText: $('#liveText'), spot: $('#spot'), embers: $('#embers'),
    sCount: $('#sCount'), sMax: $('#sMax'), sMedian: $('#sMedian'), sUnder5: $('#sUnder5'),
    bars: $('#bars'), ticker: $('#ticker'), hot: $('#hot'), rail: $('#rail'),
    q: $('#q'), price: $('#price'), priceOut: $('#priceOut'), disc: $('#disc'), discOut: $('#discOut'),
    sort: $('#sort'), genres: $('#genres'), count: $('#count'), progress: $('#progress'), reset: $('#reset'),
    grid: $('#grid'), sentinel: $('#sentinel'), empty: $('#empty'), fail: $('#fail'), failText: $('#failText'),
    barAnchor: $('#barAnchor'), footTime: $('#footTime'), deals: $('#offres'),
  };

  const state = {
    all: [], received: 0, total: 0, done: false, version: 0, updatedAt: 0,
    q: '', maxPrice: MAX_PRICE, minDisc: 0, minRev: 0, plats: new Set(), genres: new Set(), sort: 'pop',
    view: [], shown: 0,
  };

  /* ------------------------------------------------------------------ outils */
  const fmtEur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const fmtInt = new Intl.NumberFormat('fr-FR');
  const eur = cents => fmtEur.format(cents / 100);
  const int = n => fmtInt.format(Math.round(n));
  const pct = n => `−${Math.round(n)} %`;
  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : '');
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const debounce = (fn, ms) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(fn, ms, ...args); }; };

  /* Couleur thermique d'une réduction : bleu à −10 %, blanc-jaune au-delà de −90 %. */
  const STOPS = [[0, 75, 87, 255], [.17, 139, 61, 255], [.34, 212, 47, 166], [.52, 255, 74, 79],
    [.7, 255, 138, 28], [.86, 255, 210, 46], [1, 255, 243, 191]];
  const heatCache = new Map();
  function heat(discount) {
    const d = Math.round(Math.max(0, Math.min(100, discount)));
    let found = heatCache.get(d);
    if (found) return found;
    const t = Math.max(0, Math.min(1, (d - 10) / 82));
    let i = 1;
    while (i < STOPS.length - 1 && STOPS[i][0] < t) i++;
    const a = STOPS[i - 1], b = STOPS[i], k = (t - a[0]) / (b[0] - a[0]);
    const rgb = [1, 2, 3].map(j => Math.round(a[j] + (b[j] - a[j]) * k));
    const lin = rgb.map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
    const luminance = .2126 * lin[0] + .7152 * lin[1] + .0722 * lin[2];
    found = { c: `rgb(${rgb.join(' ')})`, ink: luminance > .2 ? '#1c0b02' : '#ffffff' };
    heatCache.set(d, found);
    return found;
  }

  /* Borne basse de Wilson : classe « 97 % sur 12 000 avis » devant « 100 % sur 9 avis ». */
  function wilson(score, votes) {
    if (!votes) return 0;
    const z = 1.96, p = score / 100;
    return (p + z * z / (2 * votes) - z * Math.sqrt((p * (1 - p) + z * z / (4 * votes)) / votes)) / (1 + z * z / votes);
  }

  function adopt(item, index) {
    item.x = index;                       // rang de popularité (ordre de Steam)
    item.q = fold(item.t);                // titre simplifié pour la recherche
    item.w = wilson(item.s, item.n);      // qualité des avis
    item.e = item.o - item.f;             // économie en centimes
    return item;
  }

  const art = (item, name) => (!name ? '' : name.startsWith('http') ? name
    : `${CDN}steam/apps/${item.a}/${name}${item.ts ? `?t=${item.ts}` : ''}`);

  /* Temps restant avant la fin de l'offre : « encore 3 j », « encore 5 h ». */
  function timeLeft(item) {
    if (!item.z) return null;
    const hours = (item.z * 1000 - Date.now()) / 36e5;
    if (hours <= 0) return null;
    if (hours < 1) return { text: 'moins d’1 h', soon: true };
    if (hours < 48) return { text: `encore ${Math.floor(hours)} h`, soon: hours < 24 };
    return { text: `encore ${Math.floor(hours / 24)} j`, soon: false };
  }

  /* ------------------------------------------------------------------ gabarits */
  function artImg(item) {
    const sources = [];
    const capsule = art(item, item.i);
    if (item.h) sources.push(art(item, item.h));
    else if (/\/[0-9a-f]{40}\/capsule_231x87\.jpg/.test(capsule)) sources.push(capsule.replace('capsule_231x87.jpg', 'capsule_231x87_2x.jpg'));
    if (capsule) sources.push(capsule);
    if (!sources.length) return '';
    return `<img class="card__art" src="${esc(sources[0])}" data-next="${esc(sources.slice(1).join('|'))}" alt="" loading="lazy" decoding="async" width="460" height="215">`;
  }

  function cardHTML(item, i, mode) {
    const h = heat(item.d);
    const final = item.f ? eur(item.f) : 'Gratuit';
    const review = item.c
      ? `<span class="rev rev--${item.c}" title="${int(item.n)} évaluations"><i></i>${item.s} %<em>${esc(cap(item.l))}</em></span>`
      : '<span class="rev rev--none">Pas encore assez d’avis</span>';
    const plats = PLATS.filter(([key]) => item.p.includes(key)).map(([, label]) => `<span>${label}</span>`).join('');
    const left = timeLeft(item);
    const ends = left ? `<span class="card__ends${left.soon ? ' is-soon' : ''}">${left.text}</span>` : '';
    const label = `${item.t} : ${final} au lieu de ${eur(item.o)}, réduction de ${item.d} %${left ? `, ${left.text}` : ''}. Ouvrir sur Steam.`;
    return `<a class="card${mode ? ` card--${mode}` : ''}${item.d >= 85 ? ' card--blaze' : ''}" href="${STORE}${esc(item.u)}/" target="_blank" rel="noopener"`
      + ` title="${esc(item.t)}" aria-label="${esc(label)}" style="--heat:${h.c};--ink-on:${h.ink};--k:${(item.d / 100).toFixed(2)};--i:${i}">`
      + '<span class="card__in">'
      + `<span class="card__top"><span class="card__media">${artImg(item)}</span>${ends}<span class="card__pct">−${item.d}<small>%</small></span></span>`
      + `<span class="card__body"><span class="card__title">${esc(item.t)}</span>${review}`
      + `<span class="card__foot"><span class="price"><s>${eur(item.o)}</s><b>${final}</b></span><span class="plats">${plats}</span></span></span>`
      + '<span class="card__sheen"></span></span></a>';
  }

  function posterHTML(item, i) {
    const h = heat(item.d);
    const label = `Numéro ${i + 1} : ${item.t}, ${eur(item.f)} au lieu de ${eur(item.o)}, réduction de ${item.d} %. Ouvrir sur Steam.`;
    return `<a class="poster" href="${STORE}${esc(item.u)}/" target="_blank" rel="noopener" title="${esc(item.t)}" aria-label="${esc(label)}"`
      + ` style="--heat:${h.c};--ink-on:${h.ink};--i:${i}"><span class="poster__in">`
      + `<img src="${esc(art(item, item.v))}" alt="" decoding="async">`
      + `<span class="poster__shade"></span><span class="poster__rank">${i + 1}</span><span class="poster__pct">${pct(item.d)}</span>`
      + `<span class="poster__info"><strong>${esc(item.t)}</strong><span class="price"><s>${eur(item.o)}</s><b>${eur(item.f)}</b></span></span>`
      + '<span class="poster__holo"></span></span></a>';
  }

  /* ------------------------------------------------------------------ filtres et tri */
  const sorters = {
    pop: null,   // l'ordre reçu est déjà celui de Steam (popularité)
    hot: list => list.sort((a, b) => b.d - a.d || b.w - a.w || a.x - b.x),
    cheap: list => list.sort((a, b) => a.f - b.f || b.d - a.d || a.x - b.x),
    save: list => list.sort((a, b) => b.e - a.e || a.x - b.x),
    rated: list => list.sort((a, b) => b.w - a.w || a.x - b.x),
    recent: list => list.sort((a, b) => b.y - a.y || a.x - b.x),
    soon: list => list.sort((a, b) => (a.z || Infinity) - (b.z || Infinity) || a.x - b.x),
  };

  const isFiltered = () => Boolean(state.q || state.maxPrice < MAX_PRICE || state.minDisc || state.minRev
    || state.plats.size || state.genres.size);

  function applyFilters() {
    const maxCents = state.maxPrice * 100;
    const words = state.q ? fold(state.q).split(/\s+/).filter(Boolean) : [];
    const genres = [...state.genres], plats = [...state.plats];
    const out = [];
    for (const item of state.all) {
      if (item.f > maxCents || item.d < state.minDisc) continue;
      if (state.minRev && (!item.n || item.s < state.minRev)) continue;
      if (plats.length && !plats.every(p => item.p.includes(p))) continue;
      if (genres.length && !genres.every(g => item.g.includes(g))) continue;
      if (words.length && !words.every(w => item.q.includes(w))) continue;
      out.push(item);
    }
    const sorter = sorters[state.sort];
    if (sorter) sorter(out);
    state.view = out;
  }

  /* ------------------------------------------------------------------ grille */
  const sentinelWatch = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { appendBatch(); rearm(); }
  }, { rootMargin: '1200px 0px' });

  function rearm() {
    sentinelWatch.unobserve(els.sentinel);
    if (state.shown < state.view.length) sentinelWatch.observe(els.sentinel);
  }

  function appendBatch() {
    const slice = state.view.slice(state.shown, state.shown + BATCH);
    if (!slice.length) return;
    els.grid.insertAdjacentHTML('beforeend', slice.map((item, i) => cardHTML(item, i, 'scroll')).join(''));
    state.shown += slice.length;
  }

  function renderGrid({ quick = false, count = BATCH } = {}) {
    const slice = state.view.slice(0, count);
    els.grid.innerHTML = slice.map((item, i) => cardHTML(item, i, quick ? '' : 'intro')).join('');
    state.shown = slice.length;
    rearm();
  }

  /* Après un changement de filtre, on revient au début de la liste si on était plus bas. */
  function snapToList() {
    const top = els.barAnchor.getBoundingClientRect().top;
    if (top < 0) window.scrollTo({ top: window.scrollY + top - 4, behavior: 'instant' });
  }

  function refresh({ quick = false, keep = false, snap = true } = {}) {
    applyFilters();
    renderGrid({ quick, count: keep ? Math.max(BATCH, state.shown) : BATCH });
    syncUI();
    if (snap) snapToList();
  }

  function syncUI() {
    const shown = state.view.length, total = state.all.length, filtered = isFiltered();
    if (!total) els.count.textContent = 'Relevé des offres…';
    else if (!shown) els.count.textContent = 'Aucune offre';
    else els.count.innerHTML = `<b>${int(shown)}</b> offre${shown > 1 ? 's' : ''}${filtered ? ` sur ${int(total)}` : ''}`;
    els.reset.hidden = !filtered;
    els.empty.hidden = !(total && !shown);
    els.progress.hidden = state.done || !total;
    const ratio = state.total ? Math.min(1, total / state.total) : 0;
    els.progress.style.setProperty('--p', ratio.toFixed(3));
    els.progress.setAttribute('aria-valuenow', Math.round(ratio * 100));
  }

  /* ------------------------------------------------------------------ chiffres et graphique */
  const tweens = new WeakMap();
  function setNumber(el, value, format) {
    const previous = tweens.get(el);
    const from = previous ? previous.value : 0;
    if (previous) cancelAnimationFrame(previous.raf);
    const record = { value, raf: 0 };
    tweens.set(el, record);
    if (from === value || reduceMotion.matches) { el.textContent = format(value); return; }
    const start = performance.now();
    const step = now => {
      const p = Math.min(1, (now - start) / 800);
      el.textContent = format(from + (value - from) * (1 - (1 - p) ** 4));
      if (p < 1) record.raf = requestAnimationFrame(step);
    };
    record.raf = requestAnimationFrame(step);
  }

  function updateStats() {
    const all = state.all;
    if (!all.length) return;
    let max = 0, under5 = 0;
    const prices = new Array(all.length), buckets = new Array(BUCKETS.length).fill(0);
    for (let i = 0; i < all.length; i++) {
      const item = all[i];
      if (item.d > max) max = item.d;
      if (item.f < 500) under5++;
      prices[i] = item.f;
      buckets[Math.min(BUCKETS.length - 1, Math.max(0, Math.floor(item.d / 10) - 1))]++;
    }
    prices.sort((a, b) => a - b);
    setNumber(els.sCount, all.length, int);
    setNumber(els.sMax, max, pct);
    setNumber(els.sMedian, prices[prices.length >> 1], v => eur(Math.round(v)));
    setNumber(els.sUnder5, under5, int);

    const top = Math.max(...buckets, 1);
    $$('.tbar', els.bars).forEach((bar, i) => {
      const from = BUCKETS[i], to = i === BUCKETS.length - 1 ? 100 : from + 9;
      bar.style.setProperty('--h', (buckets[i] / top).toFixed(4));
      bar.querySelector('b').textContent = int(buckets[i]);
      bar.setAttribute('aria-label', `Réductions de ${from} à ${to} % : ${int(buckets[i])} offres. Filtrer à partir de ${from} %.`);
    });
  }

  function buildBars() {
    els.bars.innerHTML = BUCKETS.map(min => `<button type="button" class="tbar" data-min="${min}" style="--heat:${heat(min + 5).c}">`
      + `<span class="tbar__col"><b>—</b><i></i></span><span class="tbar__x">−${min}</span></button>`).join('');
  }

  /* ------------------------------------------------------------------ commandes */
  function paintDials() {
    const price = +els.price.value, disc = +els.disc.value;
    els.price.style.setProperty('--p', ((price - els.price.min) / (els.price.max - els.price.min)).toFixed(4));
    els.priceOut.textContent = `${price} €`;
    els.disc.style.setProperty('--p', (disc / els.disc.max).toFixed(4));
    els.disc.style.setProperty('--glow', heat(Math.max(10, disc)).c);
    els.discOut.textContent = disc ? pct(disc) : 'toutes';
    $$('.tbar', els.bars).forEach(bar => {
      const min = +bar.dataset.min;
      bar.classList.toggle('is-cold', min + 10 <= disc);
      bar.classList.toggle('is-edge', disc > 0 && min <= disc && disc < min + 10);
    });
  }

  function setMinDisc(value) {
    state.minDisc = value;
    els.disc.value = value;
    paintDials();
    refresh({ snap: false });
  }

  function resetFilters() {
    Object.assign(state, { q: '', maxPrice: MAX_PRICE, minDisc: 0, minRev: 0 });
    state.plats.clear();
    state.genres.clear();
    els.q.value = '';
    els.price.value = MAX_PRICE;
    els.disc.value = 0;
    $('#rev0').checked = true;
    $$('[aria-pressed="true"]', els.deals).forEach(chip => chip.setAttribute('aria-pressed', 'false'));
    paintDials();
    refresh();
  }

  function buildChips() {
    const counts = new Map();
    for (const item of state.all) for (const g of item.g) counts.set(g, (counts.get(g) || 0) + 1);
    const list = [...GENRES.keys()].filter(id => counts.get(id)).sort((a, b) => counts.get(b) - counts.get(a));
    const open = els.genres.classList.contains('is-open');
    const extra = list.length - VISIBLE_GENRES;
    els.genres.innerHTML = list.map((id, i) => `<button type="button" class="chip${i >= VISIBLE_GENRES ? ' chip--extra' : ''}" data-genre="${id}"`
      + ` aria-pressed="${state.genres.has(id)}">${esc(GENRES.get(id))}<small>${int(counts.get(id))}</small></button>`).join('')
      + (extra > 0 ? `<button type="button" class="chip chip--more" data-more="${extra}" aria-expanded="${open}">${open ? 'Moins de genres' : `+ ${extra} genres`}</button>` : '');
  }

  function bindControls() {
    const quickRefresh = (() => {
      let raf = 0;
      return () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; refresh({ quick: true }); }); };
    })();

    els.q.addEventListener('input', debounce(() => { state.q = els.q.value.trim(); refresh({ quick: true }); }, 140));
    els.q.addEventListener('keydown', e => {
      if (e.key === 'Escape' && els.q.value) { els.q.value = ''; state.q = ''; refresh({ quick: true }); }
    });
    els.price.addEventListener('input', () => { state.maxPrice = +els.price.value; paintDials(); quickRefresh(); });
    els.disc.addEventListener('input', () => { state.minDisc = +els.disc.value; paintDials(); quickRefresh(); });
    $('#rev').addEventListener('change', e => { state.minRev = +e.target.value; refresh(); });
    els.sort.addEventListener('change', () => { state.sort = els.sort.value; refresh(); });

    els.genres.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      if (chip.dataset.more) {
        const open = els.genres.classList.toggle('is-open');
        chip.setAttribute('aria-expanded', open);
        chip.textContent = open ? 'Moins de genres' : `+ ${chip.dataset.more} genres`;
        return;
      }
      const id = +chip.dataset.genre, on = !state.genres.has(id);
      state.genres[on ? 'add' : 'delete'](id);
      chip.setAttribute('aria-pressed', on);
      refresh();
    });

    $$('[data-plat]').forEach(chip => chip.addEventListener('click', () => {
      const key = chip.dataset.plat, on = !state.plats.has(key);
      state.plats[on ? 'add' : 'delete'](key);
      chip.setAttribute('aria-pressed', on);
      refresh();
    }));

    // Un clic sur une colonne du graphique fixe la réduction minimale, puis montre la liste.
    els.bars.addEventListener('click', e => {
      const bar = e.target.closest('.tbar');
      if (!bar) return;
      const min = +bar.dataset.min;
      setMinDisc(state.minDisc === min ? 0 : min);
      els.deals.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    });

    els.reset.addEventListener('click', resetFilters);
    $('#resetEmpty').addEventListener('click', resetFilters);
    $('#retry').addEventListener('click', load);

    const slide = dir => els.rail.scrollBy({ left: dir * els.rail.clientWidth * .8, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    $('#railPrev').addEventListener('click', () => slide(-1));
    $('#railNext').addEventListener('click', () => slide(1));

    // « / » place le curseur dans la recherche
    addEventListener('keydown', e => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      e.preventDefault();
      els.q.focus();
    });
  }

  /* ------------------------------------------------------------------ sélection et bandeau */
  function renderHot() {
    const score = item => (item.d / 100) ** 2 * item.w * Math.log10(item.n + 10);
    const picks = state.all.filter(item => item.v && item.d >= 50 && item.s >= 85 && item.n >= 2000)
      .sort((a, b) => score(b) - score(a)).slice(0, 12);
    els.hot.hidden = picks.length < 4;
    els.rail.innerHTML = picks.map(posterHTML).join('');
    els.rail.scrollLeft = 0;
  }

  function renderTicker() {
    const picks = state.all.filter(item => item.d >= 75 && item.n >= 1500)
      .sort((a, b) => b.d - a.d || b.n - a.n).slice(0, 26);
    if (picks.length < 6) { els.ticker.parentElement.hidden = true; return; }
    const html = picks.map(item => `<span class="tick" style="--heat:${heat(item.d).c}"><b>${pct(item.d)}</b>${esc(item.t)}<i>${eur(item.f)}</i></span>`).join('');
    els.ticker.innerHTML = html + html;   // deux fois, pour une boucle sans raccord
    els.ticker.style.setProperty('--dur', `${picks.length * 4.2}s`);
    els.ticker.parentElement.hidden = false;
  }

  function updateLive() {
    if (!state.done) {
      els.live.dataset.state = 'loading';
      els.liveText.textContent = `Relevé en cours · ${int(state.all.length)} / ${int(state.total)} offres`;
      return;
    }
    const when = new Date(state.updatedAt);
    const sameDay = when.toDateString() === new Date().toDateString();
    const time = when.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const stamp = sameDay ? `à ${time}` : `le ${when.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${time}`;
    els.live.dataset.state = 'live';
    els.liveText.textContent = `Prix Steam relevés ${stamp}`;
    els.footTime.textContent = ` ${stamp}`;
  }

  /* ------------------------------------------------------------------ chargement */
  function showFailure(message) {
    els.live.dataset.state = 'error';
    els.liveText.textContent = 'Relevé impossible';
    els.failText.textContent = message;
    els.fail.hidden = false;
    els.grid.innerHTML = '';
    els.count.textContent = '';
    els.progress.hidden = true;
  }

  function ingest(data) {
    if (data.reset || (state.version && data.v !== state.version)) { state.all = []; state.received = 0; }
    state.version = data.v;
    const first = state.all.length === 0;
    const now = Date.now() / 1000;
    for (const item of data.items) {
      if (item.z && item.z <= now) continue;      // offre terminée depuis le relevé : on ne l'affiche plus
      state.all.push(adopt(item, state.all.length));
    }
    state.received += data.items.length;
    Object.assign(state, { total: data.total, done: data.done, updatedAt: data.updatedAt });
    if (!state.all.length) return;

    updateStats();
    updateLive();
    if (first) {
      buildChips();
      refresh({ snap: false });
    } else if (state.sort === 'pop' && state.shown > 0) {
      applyFilters();          // les nouvelles offres s'ajoutent à la suite : rien à redessiner
      syncUI();
      rearm();
    } else {
      refresh({ quick: true, keep: true, snap: false });
    }
    if (state.done) {
      if (!first) buildChips();
      renderHot();
      renderTicker();
    }
  }

  let loading = false;
  async function load() {
    if (loading) return;
    if (location.protocol === 'file:') {
      showFailure('Ce site a besoin de son petit serveur local pour relever les prix. Lancer « demarrer.bat » (ou « python server.py »), puis ouvrir http://localhost:5173.');
      return;
    }
    loading = true;
    els.fail.hidden = true;
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    let failures = 0;
    try {
      for (;;) {
        let data;
        try {
          // Adresse relative : le site fonctionne aussi dans un sous-dossier (GitHub Pages).
          const response = await fetch(`deals.json?from=${state.received}&v=${state.version}`, { cache: 'no-cache' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          data = await response.json();
        } catch (error) {
          if (++failures > 3) {
            if (!state.all.length) {
              showFailure(local
                ? 'Le serveur local ne répond pas. Vérifier qu’il est toujours lancé, puis réessayer.'
                : 'Les offres n’ont pas pu être chargées. Réessayer dans un instant.');
            }
            return;
          }
          await sleep(1000 * failures);
          continue;
        }
        failures = 0;
        if (data.error && !data.loaded) {
          showFailure(`${data.error} Les offres reviendront dès que la boutique sera joignable.`);
          return;
        }
        ingest(data);
        if (data.done) return;
        await sleep(650);
      }
    } finally {
      loading = false;
    }
  }

  /* ------------------------------------------------------------------ effets */
  // Images : fondu à l'arrivée ; en cas d'échec, on essaie le visuel de secours suivant.
  document.addEventListener('load', e => {
    if (e.target instanceof HTMLImageElement) e.target.classList.add('is-loaded');
  }, true);
  document.addEventListener('error', e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    const next = (img.dataset.next || '').split('|').filter(Boolean);
    if (!next.length) return;
    img.dataset.next = next.slice(1).join('|');
    img.src = next[0];
  }, true);

  // Inclinaison 3D + position du reflet sur l'élément survolé.
  function bindTilt(root, selector, maxDeg) {
    let active = null, pointer = null, raf = 0;
    const release = () => {
      if (!active) return;
      active.classList.remove('is-live');
      active.style.removeProperty('--rx');
      active.style.removeProperty('--ry');
      active = null;
    };
    const apply = () => {
      raf = 0;
      if (!active || !pointer) return;
      const box = active.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (pointer.clientX - box.left) / box.width));
      const y = Math.min(1, Math.max(0, (pointer.clientY - box.top) / box.height));
      active.style.setProperty('--px', `${(x * 100).toFixed(1)}%`);
      active.style.setProperty('--py', `${(y * 100).toFixed(1)}%`);
      active.style.setProperty('--ry', `${((x - .5) * 2 * maxDeg).toFixed(2)}deg`);
      active.style.setProperty('--rx', `${((.5 - y) * 2 * maxDeg).toFixed(2)}deg`);
    };
    root.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch' || reduceMotion.matches) return;
      const target = e.target.closest(selector);
      if (target !== active) {
        release();
        active = target;
        if (active) active.classList.add('is-live');
      }
      pointer = e;
      if (active && !raf) raf = requestAnimationFrame(apply);
    });
    root.addEventListener('pointerleave', release);
  }

  // Point chaud qui suit le curseur, avec un léger retard.
  function bindSpot() {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, started = false;
    const tick = () => {
      cx += (tx - cx) * .12;
      cy += (ty - cy) * .12;
      els.spot.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > .5 ? requestAnimationFrame(tick) : 0;
    };
    addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      tx = e.clientX;
      ty = e.clientY;
      if (!started) { started = true; cx = tx; cy = ty; els.spot.classList.add('is-on'); }
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
  }

  function lightEmbers() {
    const colors = ['#ffd22e', '#ff8a1c', '#ff4a4f', '#fff3bf'];
    const count = innerWidth < 720 ? 12 : 26;
    const rnd = (min, max) => min + Math.random() * (max - min);
    els.embers.innerHTML = Array.from({ length: count }, () => `<i style="--x:${rnd(0, 100).toFixed(1)}%;--s:${rnd(2, 6).toFixed(1)}px;`
      + `--c:${colors[Math.floor(Math.random() * colors.length)]};--t:${rnd(7, 16).toFixed(1)}s;--delay:${(-rnd(0, 16)).toFixed(1)}s;`
      + `--dx:${rnd(-70, 70).toFixed(0)}px"></i>`).join('');
  }

  // Les animations des zones sorties de l'écran sont suspendues (voir styles.css).
  function pauseOffscreen() {
    const watch = new IntersectionObserver(entries => {
      for (const entry of entries) entry.target.toggleAttribute('data-offscreen', !entry.isIntersecting);
    }, { rootMargin: '120px' });
    [$('.hero'), $('.ticker'), els.hot].forEach(el => watch.observe(el));
  }

  /* ------------------------------------------------------------------ démarrage */
  buildBars();
  els.grid.innerHTML = '<div class="ghost"></div>'.repeat(12);
  els.rail.innerHTML = '<div class="poster poster--ghost"><span class="poster__in"></span></div>'.repeat(8);
  paintDials();
  bindControls();
  bindTilt(els.grid, '.card', 7);
  bindTilt(els.rail, '.poster', 12);
  bindSpot();
  if (!reduceMotion.matches) lightEmbers();
  pauseOffscreen();
  load();
})();
