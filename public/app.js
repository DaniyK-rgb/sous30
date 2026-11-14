/* Sous 30 — interface.
   Les données viennent de deals.json : en local, c'est server.py qui le fabrique à la demande en relevant
   la boutique Steam France ; en ligne, c'est un fichier régénéré toutes les 30 minutes. */
(() => {
  'use strict';

  /* Langue : ?lang=fr ou ?lang=en dans l'adresse, sinon le dernier choix, sinon la langue du navigateur.
     Le français est écrit dans la page ; l'anglais vient des attributs data-en* et des appels L('fr', 'en'). */
  const LANG_KEY = 'sous30:langue';
  const LANG = (() => {
    const known = value => value === 'fr' || value === 'en';
    const asked = new URLSearchParams(location.search).get('lang');
    let saved = '';
    try { saved = localStorage.getItem(LANG_KEY) || ''; } catch { /* mémoire du navigateur indisponible */ }
    if (known(asked)) { try { localStorage.setItem(LANG_KEY, asked); } catch { /* idem */ } return asked; }
    if (known(saved)) return saved;
    return (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  })();
  const EN = LANG === 'en';
  const L = (fr, en) => (EN ? en : fr);
  const LOCALE = EN ? 'en-GB' : 'fr-FR';

  const CDN = 'https://shared.fastly.steamstatic.com/store_item_assets/';
  const PAGE_SIZE = 24;         // jeux affichés par page
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
  if (EN) {
    for (const [id, name] of [[21, 'Adventure'], [9, 'Strategy'], [492, 'Indie'], [1662, 'Survival'], [1667, 'Horror'],
      [1664, 'Puzzle'], [1625, 'Platformer'], [1774, 'Shooter'], [1695, 'Open World'], [1685, 'Co-op'],
      [3859, 'Multiplayer'], [12472, 'Management'], [1643, 'Building'], [4328, 'City Builder'], [699, 'Racing'],
      [701, 'Sports'], [1743, 'Fighting'], [3799, 'Visual Novel'], [1698, 'Point & Click'], [1645, 'Tower Defense'],
      [3942, 'Sci-fi'], [3964, 'Pixel Graphics'], [3810, 'Sandbox']]) GENRES.set(id, name);
  }
  // Appréciations des avis : Steam les donne en français ; voici leur équivalent anglais.
  const REVIEW_EN = { 'extrêmement positives': 'Overwhelmingly Positive', 'très positives': 'Very Positive',
    'positives': 'Positive', 'plutôt positives': 'Mostly Positive', 'moyennes': 'Mixed',
    'plutôt négatives': 'Mostly Negative', 'négatives': 'Negative', 'très négatives': 'Very Negative',
    'extrêmement négatives': 'Overwhelmingly Negative' };
  const PLATS = [['w', 'WIN'], ['m', 'MAC'], ['l', 'LINUX'], ['d', 'DECK']];
  const BUCKETS = [10, 20, 30, 40, 50, 60, 70, 80, 90];   // tranches de réduction du graphique

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Version anglaise : on remplace les textes de la page avant de garder des références vers ses éléments.
  if (EN) {
    document.documentElement.lang = 'en';
    document.title = 'Sous 30 — every Steam deal under €30';
    for (const el of $$('[data-en-html]')) el.innerHTML = el.dataset.enHtml;
    for (const el of $$('[data-en]')) el.textContent = el.dataset.en;
    for (const name of ['aria-label', 'title', 'placeholder']) {
      for (const el of $$(`[data-en-${name}]`)) el.setAttribute(name, el.getAttribute(`data-en-${name}`));
    }
  }
  const els = {
    live: $('#live'), liveText: $('#liveText'), spot: $('#spot'), embers: $('#embers'),
    sCount: $('#sCount'), sMax: $('#sMax'), sMedian: $('#sMedian'), sUnder5: $('#sUnder5'),
    bars: $('#bars'), ticker: $('#ticker'), hot: $('#hot'), rail: $('#rail'),
    q: $('#q'), price: $('#price'), priceOut: $('#priceOut'), disc: $('#disc'), discOut: $('#discOut'),
    sort: $('#sort'), genres: $('#genres'), count: $('#count'), progress: $('#progress'), reset: $('#reset'),
    grid: $('#grid'), pager: $('#pager'), empty: $('#empty'), fail: $('#fail'), failText: $('#failText'),
    barAnchor: $('#barAnchor'), footTime: $('#footTime'), deals: $('#offres'),
    emptyTitle: $('#emptyTitle'), emptyText: $('#emptyText'), favChip: $('#favChip'), newChip: $('#newChip'), newCount: $('#newCount'), favCount: $('#favCount'),
    accountBtn: $('#accountBtn'), accountAvatar: $('#accountAvatar'), accountLabel: $('#accountLabel'),
    menu: $('#accountMenu'), menuName: $('#menuName'), menuFavs: $('#menuFavs'), menuFavCount: $('#menuFavCount'),
    menuLogout: $('#menuLogout'), menuAlerts: $('#menuAlerts'), menuDelete: $('#menuDelete'),
    auth: $('#auth'), authTitle: $('#authTitle'), authHint: $('#authHint'), authForm: $('#authForm'),
    authSwitch: $('#authSwitch'), authLost: $('#authLost'), authSocial: $('#authSocial'), authNote: $('#authNote'),
    authName: $('#authName'), authPass: $('#authPass'),
    authPass2: $('#authPass2'), authConfirmRow: $('#authConfirmRow'), authPeek: $('#authPeek'),
    authError: $('#authError'), authSubmit: $('#authSubmit'), authClose: $('#authClose'), toast: $('#toast'),
  };
  const EMPTY_DEFAULT = { title: els.emptyTitle.textContent, text: els.emptyText.textContent };

  const state = {
    all: [], received: 0, total: 0, done: false, version: 0, updatedAt: 0,
    q: '', maxPrice: MAX_PRICE, minDisc: 0, minRev: 0, plats: new Set(), genres: new Set(), sort: 'pop',
    onlyFavs: false, onlyNew: false, newCount: 0,
    view: [], page: 1,
  };

  /* ------------------------------------------------------------------ outils */
  const fmtEur = new Intl.NumberFormat(EN ? 'en-IE' : 'fr-FR', { style: 'currency', currency: 'EUR' });
  const fmtInt = new Intl.NumberFormat(LOCALE);
  const eur = cents => fmtEur.format(cents / 100);
  const int = n => fmtInt.format(Math.round(n));
  const pct = n => `−${Math.round(n)}${L(' %', '%')}`;
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
    if (hours < 1) return { text: L('moins d’1 h', 'under 1 h'), soon: true };
    if (hours < 48) return { text: L(`encore ${Math.floor(hours)} h`, `${Math.floor(hours)} h left`), soon: hours < 24 };
    return { text: L(`encore ${Math.floor(hours / 24)} j`, `${Math.floor(hours / 24)} d left`), soon: false };
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
    const final = item.f ? eur(item.f) : L('Gratuit', 'Free');
    const grade = EN ? REVIEW_EN[String(item.l).toLowerCase()] || item.l : cap(item.l);
    const review = item.c
      ? `<span class="rev rev--${item.c}" title="${int(item.n)} ${L('évaluations', 'reviews')}"><i></i>${item.s}${L(' %', '%')}<em>${esc(grade)}</em></span>`
      : `<span class="rev rev--none">${L('Pas encore assez d’avis', 'Not enough reviews yet')}</span>`;
    const plats = PLATS.filter(([key]) => item.p.includes(key)).map(([, label]) => `<span>${label}</span>`).join('');
    const left = timeLeft(item);
    const ends = (left ? `<span class="card__ends${left.soon ? ' is-soon' : ''}">${left.text}</span>` : '')
      + (item.isNew ? `<span class="card__new">${L('Nouveau', 'New')}</span>` : '');
    const label = L(`${item.t} : ${final} au lieu de ${eur(item.o)}, réduction de ${item.d} %${left ? `, ${left.text}` : ''}. Ouvrir sur Steam.`,
      `${item.t}: ${final} instead of ${eur(item.o)}, ${item.d}% off${left ? `, ${left.text}` : ''}. Open on Steam.`);
    const fav = account.favs.has(item.a);
    // La carte entière est un lien vers Steam ; le cœur est un bouton à part, posé par-dessus.
    return `<article class="card${mode ? ` card--${mode}` : ''}${item.d >= 85 ? ' card--blaze' : ''}"`
      + ` style="--heat:${h.c};--ink-on:${h.ink};--k:${(item.d / 100).toFixed(2)};--i:${i}"><div class="card__in">`
      + `<a class="card__link" href="${STORE}${esc(item.u)}/" target="_blank" rel="noopener" title="${esc(item.t)}" aria-label="${esc(label)}">`
      + `<span class="card__top"><span class="card__media">${artImg(item)}</span>${ends}<span class="card__pct">−${item.d}<small>%</small></span></span>`
      + `<span class="card__body"><span class="card__title">${esc(item.t)}</span>${review}`
      + `<span class="card__foot"><span class="price"><s>${eur(item.o)}</s><b>${final}</b></span><span class="plats">${plats}</span></span></span></a>`
      + `<button type="button" class="card__fav" data-fav="${item.a}" aria-pressed="${fav}" aria-label="${esc(favLabel(item.t, fav))}">${HEART}</button>`
      + `<button type="button" class="card__share" data-share="${item.a}" title="${L('Partager', 'Share')}" aria-label="${L('Partager', 'Share')} ${esc(item.t)}">${SHARE}</button>`
      + '<span class="card__sheen"></span></div></article>';
  }

  function posterHTML(item, i) {
    const h = heat(item.d);
    const label = L(`Numéro ${i + 1} : ${item.t}, ${eur(item.f)} au lieu de ${eur(item.o)}, réduction de ${item.d} %. Ouvrir sur Steam.`,
      `Number ${i + 1}: ${item.t}, ${eur(item.f)} instead of ${eur(item.o)}, ${item.d}% off. Open on Steam.`);
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
    || state.plats.size || state.genres.size || state.onlyFavs || state.onlyNew);

  /* ------------------------------------------------------------------ filtres dans l'adresse, partage */
  const URL_KEYS = ['q', 'prix', 'promo', 'avis', 'tri', 'plat', 'genre', 'page'];

  // Les filtres en cours, sous la forme qu'ils prennent dans l'adresse (les favoris, personnels, n'y vont pas).
  function filterParams() {
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.maxPrice < MAX_PRICE) params.set('prix', state.maxPrice);
    if (state.minDisc) params.set('promo', state.minDisc);
    if (state.minRev) params.set('avis', state.minRev);
    if (state.sort !== 'pop') params.set('tri', state.sort);
    if (state.plats.size) params.set('plat', [...state.plats].join(''));
    if (state.genres.size) params.set('genre', [...state.genres].join(','));
    return params;
  }

  // On ne touche qu'à nos propres réglages : le reste de l'adresse (retour d'une connexion…) est conservé.
  function writeURL() {
    const url = new URL(location.href);
    for (const key of URL_KEYS) url.searchParams.delete(key);
    for (const [key, value] of filterParams()) url.searchParams.set(key, value);
    if (state.page > 1) url.searchParams.set('page', state.page);
    try { history.replaceState(history.state, '', url); } catch { /* adresse figée : tant pis */ }
  }

  function readURL() {
    const params = new URLSearchParams(location.search);
    const num = (key, min, max, fallback) => {
      const n = parseInt(params.get(key), 10);
      return n >= min && n <= max ? n : fallback;
    };
    state.q = (params.get('q') || '').trim().slice(0, 80);
    state.maxPrice = num('prix', 1, MAX_PRICE, MAX_PRICE);
    state.minDisc = Math.round(num('promo', 0, 90, 0) / 5) * 5;
    state.minRev = [70, 85, 95].includes(+params.get('avis')) ? +params.get('avis') : 0;
    if (Object.hasOwn(sorters, params.get('tri') || '')) state.sort = params.get('tri');
    for (const key of params.get('plat') || '') if ('mld'.includes(key)) state.plats.add(key);
    for (const id of (params.get('genre') || '').split(',')) if (GENRES.has(+id)) state.genres.add(+id);
    state.page = num('page', 1, 99999, 1);

    els.q.value = state.q;
    els.price.value = state.maxPrice;
    els.disc.value = state.minDisc;
    $(`#rev${state.minRev}`).checked = true;
    els.sort.value = state.sort;
    $$('[data-plat]').forEach(chip => chip.setAttribute('aria-pressed', state.plats.has(chip.dataset.plat)));
  }

  // Sur téléphone : la feuille de partage du système. Ailleurs : le lien est copié.
  async function share(text, url) {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: 'Sous 30', text, url }); } catch { /* partage annulé */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast(L('Lien copié. Colle-le où tu veux.', 'Link copied. Paste it anywhere.'));
    } catch {
      toast(L('Copie impossible ici : copie l’adresse en haut du navigateur.', 'Couldn’t copy here: copy the address from the top of your browser.'));
    }
  }

  function shareGame(appid) {
    const item = state.all.find(entry => entry.a === appid);
    if (!item) return;
    const params = new URLSearchParams({ q: item.t });
    share(L(`${item.t} à ${eur(item.f)} au lieu de ${eur(item.o)} (−${item.d} %) sur Steam`,
      `${item.t} for ${eur(item.f)} instead of ${eur(item.o)} (−${item.d}%) on Steam`), `${HOME}?${params}`);
  }

  function shareFilters() {
    const query = filterParams().toString();
    const shown = state.view.length;
    share(L(`${int(shown)} promo${shown > 1 ? 's' : ''} Steam à moins de ${state.maxPrice} €`,
      `${int(shown)} Steam deal${shown > 1 ? 's' : ''} under €${state.maxPrice}`), HOME + (query ? `?${query}` : ''));
  }

  function applyFilters() {
    const maxCents = state.maxPrice * 100;
    const words = state.q ? fold(state.q).split(/\s+/).filter(Boolean) : [];
    const genres = [...state.genres], plats = [...state.plats];
    const out = [];
    for (const item of state.all) {
      if (item.f > maxCents || item.d < state.minDisc) continue;
      if (state.onlyFavs && !account.favs.has(item.a)) continue;
      if (state.onlyNew && !item.isNew) continue;
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

  /* ------------------------------------------------------------------ grille et pages */
  const pageCount = () => Math.max(1, Math.ceil(state.view.length / PAGE_SIZE));

  function renderGrid({ quick = false } = {}) {
    state.page = Math.min(Math.max(1, state.page), pageCount());
    const start = (state.page - 1) * PAGE_SIZE;
    els.grid.innerHTML = state.view.slice(start, start + PAGE_SIZE)
      .map((item, i) => cardHTML(item, i, quick ? '' : 'intro')).join('');
    renderPager();
  }

  // Numéros proposés : la première page, la dernière, et les voisines de la page affichée.
  function renderPager() {
    const pages = pageCount(), current = state.page;
    els.pager.hidden = pages < 2;
    if (pages < 2) { els.pager.innerHTML = ''; return; }
    const reach = innerWidth < 560 ? 1 : 2;
    const wanted = new Set([1, pages]);
    for (let p = current - reach; p <= current + reach; p++) if (p >= 1 && p <= pages) wanted.add(p);
    let html = `<button type="button" class="pager__btn pager__btn--step" data-page="${current - 1}"${current === 1 ? ' disabled' : ''}>← ${L('Précédent', 'Previous')}</button>`;
    let previous = 0;
    for (const p of [...wanted].sort((a, b) => a - b)) {
      if (p - previous > 1) html += '<span class="pager__gap" aria-hidden="true">…</span>';
      html += `<button type="button" class="pager__btn" data-page="${p}" aria-label="Page ${p}"${p === current ? ' aria-current="page"' : ''}>${int(p)}</button>`;
      previous = p;
    }
    html += `<button type="button" class="pager__btn pager__btn--step" data-page="${current + 1}"${current === pages ? ' disabled' : ''}>${L('Suivant', 'Next')} →</button>`;
    html += `<p class="pager__info">Page ${int(current)} ${L('sur', 'of')} ${int(pages)}</p>`;
    els.pager.innerHTML = html;
  }

  // Changer de page : on affiche les jeux de cette page et on remonte au début de la liste.
  function goToPage(page) {
    state.page = page;
    renderGrid();
    writeURL();
    window.scrollTo({ top: window.scrollY + els.barAnchor.getBoundingClientRect().top - 4, behavior: 'instant' });
  }
  els.pager.addEventListener('click', e => {
    const button = e.target.closest('[data-page]');
    if (button && !button.disabled) goToPage(+button.dataset.page);
  });

  /* Après un changement de filtre, on revient au début de la liste si on était plus bas. */
  function snapToList() {
    const top = els.barAnchor.getBoundingClientRect().top;
    if (top < 0) window.scrollTo({ top: window.scrollY + top - 4, behavior: 'instant' });
  }

  // keep : on reste sur la page affichée ; sinon un changement de filtre ramène à la page 1.
  function refresh({ quick = false, keep = false, snap = true } = {}) {
    applyFilters();
    if (!keep) state.page = 1;
    renderGrid({ quick });
    syncUI();
    writeURL();
    if (snap) snapToList();
  }

  function syncUI() {
    const shown = state.view.length, total = state.all.length, filtered = isFiltered();
    if (!total) els.count.textContent = L('Relevé des offres…', 'Fetching deals…');
    else if (!shown) els.count.textContent = L('Aucune offre', 'No deals');
    else els.count.innerHTML = `<b>${int(shown)}</b> ${L('offre', 'deal')}${shown > 1 ? 's' : ''}${filtered ? ` ${L('sur', 'of')} ${int(total)}` : ''}`;
    els.reset.hidden = !filtered;
    els.empty.hidden = !(total && !shown);
    if (state.onlyFavs && !shown) {
      els.emptyTitle.textContent = account.favs.size ? L('Aucun favori en promo ici.', 'No favourite on sale here.') : L('Pas encore de favori.', 'No favourites yet.');
      els.emptyText.textContent = account.favs.size
        ? L('Aucun de tes jeux favoris ne correspond à ces filtres en ce moment. Ils reviendront ici à leur prochaine promo.',
          'None of your favourite games match these filters right now. They will be back here on their next sale.')
        : L('Touche le cœur d’une carte pour ajouter un jeu à tes favoris.', 'Tap the heart on a card to add a game to your favourites.');
    } else {
      els.emptyTitle.textContent = EMPTY_DEFAULT.title;
      els.emptyText.textContent = EMPTY_DEFAULT.text;
    }
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
      bar.setAttribute('aria-label', L(`Réductions de ${from} à ${to} % : ${int(buckets[i])} offres. Filtrer à partir de ${from} %.`,
        `Discounts from ${from} to ${to}%: ${int(buckets[i])} deals. Filter from ${from}% up.`));
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
    els.priceOut.textContent = L(`${price} €`, `€${price}`);
    els.disc.style.setProperty('--p', (disc / els.disc.max).toFixed(4));
    els.disc.style.setProperty('--glow', heat(Math.max(10, disc)).c);
    els.discOut.textContent = disc ? pct(disc) : L('toutes', 'any');
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
    Object.assign(state, { q: '', maxPrice: MAX_PRICE, minDisc: 0, minRev: 0, onlyFavs: false, onlyNew: false });
    state.plats.clear();
    state.genres.clear();
    els.q.value = '';
    els.price.value = MAX_PRICE;
    els.disc.value = 0;
    $('#rev0').checked = true;
    $$('.chip[aria-pressed="true"]', els.deals).forEach(chip => chip.setAttribute('aria-pressed', 'false'));
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
      + (extra > 0 ? `<button type="button" class="chip chip--more" data-more="${extra}" aria-expanded="${open}">${open ? L('Moins de genres', 'Fewer genres') : `+ ${extra} genres`}</button>` : '');
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
        chip.textContent = open ? L('Moins de genres', 'Fewer genres') : `+ ${chip.dataset.more} genres`;
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
    els.newChip.addEventListener('click', () => {
      state.onlyNew = !state.onlyNew;
      els.newChip.setAttribute('aria-pressed', state.onlyNew);
      refresh({ snap: false });
    });
    $('#shareBtn').addEventListener('click', shareFilters);
    $('#resetEmpty').addEventListener('click', resetFilters);
    $('#retry').addEventListener('click', load);

    const slide = dir => els.rail.scrollBy({ left: dir * els.rail.clientWidth * .8, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    $('#railPrev').addEventListener('click', () => slide(-1));
    $('#railNext').addEventListener('click', () => slide(1));

    // « / » place le curseur dans la recherche
    addEventListener('keydown', e => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (els.auth.open || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
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
      els.liveText.textContent = L(`Relevé en cours · ${int(state.all.length)} / ${int(state.total)} offres`,
        `Fetching · ${int(state.all.length)} / ${int(state.total)} deals`);
      return;
    }
    const when = new Date(state.updatedAt);
    const sameDay = when.toDateString() === new Date().toDateString();
    const time = when.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
    const day = when.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long' });
    const stamp = sameDay ? L(`à ${time}`, `at ${time}`) : L(`le ${day} à ${time}`, `on ${day} at ${time}`);
    els.live.dataset.state = 'live';
    els.liveText.textContent = L(`Prix Steam relevés ${stamp}`, `Steam prices checked ${stamp}`);
    els.footTime.textContent = ` ${stamp}`;
  }

  /* ------------------------------------------------------------------ chargement */
  function showFailure(message) {
    els.live.dataset.state = 'error';
    els.liveText.textContent = L('Relevé impossible', 'Prices unavailable');
    els.failText.textContent = message;
    els.fail.hidden = false;
    els.grid.innerHTML = '';
    els.count.textContent = '';
    els.progress.hidden = true;
  }

  /* Nouveautés : les promos apparues depuis la dernière visite.
     Le navigateur garde deux listes de jeux : celle de la visite précédente (le repère) et celle de la visite en cours.
     Après quelques heures d'absence, la liste en cours devient le nouveau repère. */
  const SEEN_KEY = 'sous30:vus';
  const VISIT_GAP = 3 * 3600 * 1000;
  function markNew() {
    const ids = state.all.map(item => item.a), now = Date.now();
    let record = null;
    try { record = JSON.parse(localStorage.getItem(SEEN_KEY)); } catch { /* mémoire du navigateur indisponible */ }
    const valid = record && Array.isArray(record.base) && Array.isArray(record.cur);
    let base = ids, baseAt = now;                         // première visite : rien n'est « nouveau »
    if (valid && now - record.curAt > VISIT_GAP) { base = record.cur; baseAt = record.curAt; }
    else if (valid) { base = record.base; baseAt = record.baseAt; }
    try { localStorage.setItem(SEEN_KEY, JSON.stringify({ base, baseAt, cur: ids, curAt: now })); } catch { /* idem */ }

    const known = new Set(base);
    let count = 0;
    for (const item of state.all) { item.isNew = !known.has(item.a); if (item.isNew) count++; }
    state.newCount = count;
    if (!count) state.onlyNew = false;
    els.newChip.hidden = !count;
    els.newChip.setAttribute('aria-pressed', state.onlyNew);
    els.newCount.textContent = int(count);
    const since = new Date(baseAt).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' });
    els.newChip.title = L(`Promos apparues depuis ta dernière visite (${since})`, `Deals that appeared since your last visit (${since})`);
    return count;
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
    const fresh = state.done ? markNew() : 0;
    if (first) {
      buildChips();
      refresh({ snap: false, keep: true });     // keep : la page demandée dans l'adresse est respectée
    } else if (state.sort === 'pop' && els.grid.querySelector('.card')) {
      applyFilters();          // les nouvelles offres s'ajoutent à la suite : la page affichée ne bouge pas
      syncUI();
      if (fresh || els.grid.querySelectorAll('.card').length < PAGE_SIZE) renderGrid({ quick: true });
      else renderPager();
    } else {
      refresh({ quick: true, keep: true, snap: false });
    }
    if (state.done) {
      if (!first) buildChips();
      renderHot();
      renderTicker();
    }
    paintFavs();
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
                : L('Les offres n’ont pas pu être chargées. Réessayer dans un instant.', 'The deals couldn’t be loaded. Try again in a moment.'));
            }
            return;
          }
          await sleep(1000 * failures);
          continue;
        }
        failures = 0;
        if (data.error && !data.loaded) {
          showFailure(L(`${data.error} Les offres reviendront dès que la boutique sera joignable.`,
            'Steam isn’t responding right now. Deals will be back as soon as the store is reachable.'));
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

  /* ------------------------------------------------------------------ comptes et favoris
     Le site n'a pas de serveur : chaque compte vit dans le navigateur du visiteur (localStorage)
     et n'existe que sur son appareil. Le mot de passe n'est jamais gardé tel quel : on ne conserve
     que son empreinte (PBKDF2), recalculée à chaque connexion. */
  const ACCOUNTS_KEY = 'sous30:comptes';
  const SESSION_KEY = 'sous30:session';
  const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  let authSignup = false;      // la fenêtre est-elle en mode « créer un compte » ?
  let authNew = false;         // … ou en mode « choisir un nouveau mot de passe » ?

  /* Comptes en ligne : actifs seulement si config.js contient l'adresse et la clé publique du projet Supabase.
     Sinon tout ce qui suit reste en sommeil et les comptes vivent dans le navigateur. */
  const CONFIG = window.SOUS30 || {};
  const ONLINE = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseKey);
  const PROVIDERS = (CONFIG.providers || []).map(name => String(name).toLowerCase());
  const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js';
  const HOME = location.origin + location.pathname;      // adresse où revenir après une connexion
  let cloud = null, cloudReady = null, favTimer = 0;

  function startCloud() {
    cloudReady = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SUPABASE_JS;
      script.onload = resolve;
      script.onerror = () => reject(new Error(L('Le service de comptes est injoignable. Réessaie dans un instant.', 'The account service can’t be reached. Try again in a moment.')));
      document.head.append(script);
    }).then(() => {
      cloud = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
      cloud.auth.onAuthStateChange((event, session) => {
        applyCloudUser(session ? session.user : null);
        if (event === 'PASSWORD_RECOVERY') openAuth('', true);     // retour depuis l'e-mail « mot de passe oublié »
      });
    });
    cloudReady.catch(() => {});
  }

  function applyCloudUser(user) {
    if (!user) {
      if (!account.id) return;
      const wasFiltered = state.onlyFavs;
      Object.assign(account, { id: '', name: '', favs: new Set(), alerts: false });
      paintAccount();
      if (wasFiltered) refresh({ snap: false });
      return;
    }
    const meta = user.user_metadata || {};
    const name = (meta.custom_claims && meta.custom_claims.global_name) || meta.full_name || meta.name
      || meta.user_name || (user.email || '').split('@')[0] || L('Mon compte', 'My account');
    // Même compte déjà chargé : on garde les favoris en mémoire, plus récents que ceux du serveur.
    const favs = account.id === user.id ? account.favs : new Set(Array.isArray(meta.favs) ? meta.favs : []);
    const alerts = account.id === user.id ? account.alerts : meta.alerts === true;
    Object.assign(account, { id: user.id, name, favs, alerts });
    paintAccount();
  }

  function cloudMessage(error) {
    const text = String((error && error.message) || '');
    if (/invalid login credentials/i.test(text)) return L('E-mail ou mot de passe incorrect.', 'Wrong email or password.');
    if (/already (been )?registered/i.test(text)) return L('Cet e-mail a déjà un compte. Connecte-toi.', 'This email already has an account. Sign in instead.');
    if (/email not confirmed/i.test(text)) return L('Ton e-mail n’est pas encore confirmé : clique sur le lien reçu par e-mail.', 'Your email isn’t confirmed yet: click the link we emailed you.');
    if ((error && error.status === 429) || /rate limit/i.test(text)) return L('Trop de demandes pour le moment. Réessaie dans quelques minutes.', 'Too many requests right now. Try again in a few minutes.');
    if (/should be different/i.test(text)) return L('Choisis un mot de passe différent de l’ancien.', 'Choose a password different from the old one.');
    return L(`Ça n’a pas marché : ${text || 'erreur inconnue'}.`, `That didn’t work: ${text || 'unknown error'}.`);
  }

  async function cloudSignUp(email, password) {
    const { data, error } = await cloud.auth.signUp({ email, password, options: { emailRedirectTo: HOME } });
    if (error) throw new Error(cloudMessage(error));
    // Supabase répond sans erreur pour un e-mail déjà inscrit, mais avec une liste d'identités vide.
    if (data.user && data.user.identities && data.user.identities.length === 0) throw new Error(L('Cet e-mail a déjà un compte. Connecte-toi.', 'This email already has an account. Sign in instead.'));
    if (!data.session) return 'confirm';      // un e-mail de confirmation vient d'être envoyé
    applyCloudUser(data.user);
    return 'ok';
  }

  async function cloudSignIn(email, password) {
    const { data, error } = await cloud.auth.signInWithPassword({ email, password });
    if (error) throw new Error(cloudMessage(error));
    applyCloudUser(data.user);
    return 'ok';
  }

  async function cloudNewPassword(password) {
    const { error } = await cloud.auth.updateUser({ password });
    if (error) throw new Error(cloudMessage(error));
    return 'ok';
  }
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  const SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>';
  const USER_ICON ='<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  const account = { id: '', name: '', favs: new Set(), alerts: false };   // compte connecté (id vide : personne)
  let pendingFav = 0;                                      // jeu à mettre en favori une fois connecté

  const vault = {
    all() {
      try {
        const data = JSON.parse(localStorage.getItem(ACCOUNTS_KEY));
        return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
      } catch { return {}; }
    },
    save(all) {
      try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(all)); return true; } catch { return false; }
    },
    session() {
      try { return localStorage.getItem(SESSION_KEY) || ''; } catch { return ''; }
    },
    setSession(id) {
      try {
        if (id) localStorage.setItem(SESSION_KEY, id); else localStorage.removeItem(SESSION_KEY);
      } catch { /* stockage indisponible : la session ne sera simplement pas mémorisée */ }
    },
  };
  const slot = id => `u:${id}`;   // préfixe : aucun pseudo ne peut heurter une propriété interne des objets

  const toBase64 = buffer => btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const fromBase64 = text => Uint8Array.from(atob(text), ch => ch.charCodeAt(0));
  async function fingerprint(password, salt) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    return toBase64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150000 }, material, 256));
  }

  async function signUp(email, password) {
    if (ONLINE) return cloudSignUp(email, password);
    const id = email.toLowerCase(), all = vault.all();
    if (all[slot(id)]) throw new Error(L('Cet e-mail a déjà un compte sur cet appareil. Connecte-toi.', 'This email already has an account on this device. Sign in instead.'));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const name = email.split('@')[0];      // nom affiché : la partie avant le @
    all[slot(id)] = { name, salt: toBase64(salt), hash: await fingerprint(password, salt), favs: [], created: Date.now() };
    if (!vault.save(all)) throw new Error(L('Ce navigateur refuse d’enregistrer des données : impossible de créer un compte ici.', 'This browser refuses to store data: an account can’t be created here.'));
    openSession(id, all[slot(id)]);
  }

  async function signIn(name, password) {
    if (ONLINE) return cloudSignIn(name, password);
    const id = name.toLowerCase(), found = vault.all()[slot(id)];
    if (!found) throw new Error(L(`Aucun compte « ${name} » sur cet appareil. Les comptes ne sont pas partagés entre appareils : crée-le avec « Pas encore de compte ? ».`,
      `No “${name}” account on this device. Accounts aren’t shared between devices: create it with “No account yet?”.`));
    if (await fingerprint(password, fromBase64(found.salt)) !== found.hash) throw new Error(L('Mot de passe incorrect.', 'Wrong password.'));
    openSession(id, found);
  }

  function openSession(id, record) {
    Object.assign(account, { id, name: record.name, favs: new Set(record.favs || []) });
    vault.setSession(id);
    paintAccount();
  }

  function closeSession() {
    const wasFiltered = state.onlyFavs;
    Object.assign(account, { id: '', name: '', favs: new Set(), alerts: false });
    if (ONLINE && cloud) cloud.auth.signOut();
    else vault.setSession('');
    paintAccount();
    if (wasFiltered) refresh({ snap: false });
  }

  function restoreSession() {
    if (ONLINE) {              // la session en ligne arrive toute seule dès que le service a répondu
      startCloud();
      paintAccount();
      return;
    }
    const id = vault.session();
    const record = id && vault.all()[slot(id)];
    if (record) Object.assign(account, { id, name: record.name, favs: new Set(record.favs || []) });
    paintAccount();
  }

  function saveFavs() {
    if (ONLINE) {              // en ligne : les favoris sont rangés avec le compte, après une courte pause
      clearTimeout(favTimer);
      favTimer = setTimeout(() => { if (cloud && account.id) cloud.auth.updateUser({ data: { favs: [...account.favs] } }); }, 700);
      return;
    }
    const all = vault.all();
    if (!all[slot(account.id)]) return;
    all[slot(account.id)].favs = [...account.favs];
    vault.save(all);
  }

  // Alertes : un e-mail quand un favori revient en promo. Rien n'est envoyé sans ce réglage.
  async function toggleAlerts() {
    if (!cloud || !account.id) return;
    const wanted = !account.alerts;
    account.alerts = wanted;
    paintAccount();
    const { error } = await cloud.auth.updateUser({ data: { alerts: wanted } });
    if (error) {
      account.alerts = !wanted;
      paintAccount();
      return toast(L('Le réglage n’a pas pu être enregistré. Réessaie dans un instant.', 'The setting couldn’t be saved. Try again in a moment.'));
    }
    toast(wanted ? L('C’est noté : tu recevras un e-mail quand un favori revient en promo.', 'Got it: you’ll get an email when a favourite is back on sale.')
      : L('Alertes par e-mail arrêtées.', 'Email alerts turned off.'));
  }

  function favLabel(title, on) {
    return on ? L(`Retirer ${title} des favoris`, `Remove ${title} from favourites`) : L(`Ajouter ${title} aux favoris`, `Add ${title} to favourites`);
  }

  // Met à jour les cœurs affichés et le nombre de favoris actuellement en promo.
  function paintFavs() {
    const onSale = account.favs.size ? state.all.reduce((n, item) => n + (account.favs.has(item.a) ? 1 : 0), 0) : 0;
    els.favCount.textContent = onSale;
    els.menuFavCount.textContent = onSale;
    for (const button of $$('.card__fav', els.grid)) {
      const on = account.favs.has(+button.dataset.fav);
      button.setAttribute('aria-pressed', on);
      button.setAttribute('aria-label', favLabel(button.previousElementSibling.title, on));
    }
  }

  function paintAccount() {
    const on = Boolean(account.id);
    els.accountLabel.textContent = on ? account.name : L('Connexion', 'Sign in');
    if (on) els.accountAvatar.textContent = Array.from(account.name)[0].toUpperCase();
    else els.accountAvatar.innerHTML = USER_ICON;
    els.accountBtn.setAttribute('aria-label', on ? L(`Compte de ${account.name} : ouvrir le menu`, `${account.name}’s account: open the menu`) : L('Se connecter ou créer un compte', 'Sign in or create an account'));
    els.menuName.textContent = account.name;
    els.menuDelete.hidden = ONLINE;      // un compte en ligne ne peut pas être supprimé depuis le site
    els.menuAlerts.hidden = !ONLINE;     // les alertes partent par e-mail : il faut un compte en ligne
    els.menuAlerts.setAttribute('aria-pressed', account.alerts);
    els.menuAlerts.lastElementChild.textContent = account.alerts ? L('Oui', 'Yes') : L('Non', 'No');
    els.favChip.hidden = !on;
    if (!on) { state.onlyFavs = false; els.favChip.setAttribute('aria-pressed', 'false'); }
    paintFavs();
  }

  function toggleFav(appid, button) {
    if (!account.id) {
      pendingFav = appid;
      openAuth(L('Connecte-toi pour garder ce jeu dans tes favoris.', 'Sign in to keep this game in your favourites.'));
      return;
    }
    const on = !account.favs.has(appid);
    account.favs[on ? 'add' : 'delete'](appid);
    saveFavs();
    paintFavs();
    if (on) {
      button.classList.add('is-pop');
      button.addEventListener('animationend', () => button.classList.remove('is-pop'), { once: true });
    } else if (state.onlyFavs) {
      refresh({ quick: true, keep: true, snap: false });
    }
  }

  function showFavs(on) {
    state.onlyFavs = on;
    els.favChip.setAttribute('aria-pressed', on);
    refresh({ snap: false });
    if (on) els.deals.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }

  let toastTimer = 0;
  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('is-on'), 3400);
  }

  // Message sous les champs : une erreur (rouge) ou une simple information (gris clair).
  function authSay(message, info = false) {
    els.authError.textContent = message;
    els.authError.classList.toggle('is-info', info);
  }

  // renew : choix d'un nouveau mot de passe, après le lien reçu par e-mail (comptes en ligne seulement)
  function setAuthMode(signup, renew = false) {
    authSignup = signup;
    authNew = renew;
    els.auth.classList.toggle('auth--new', renew);
    els.authTitle.textContent = renew ? L('Nouveau mot de passe', 'New password') : signup ? L('Inscription', 'Sign up') : L('Connexion', 'Sign in');
    els.authSubmit.textContent = renew ? L('Enregistrer', 'Save') : signup ? L('Créer mon compte', 'Create my account') : L('Se connecter', 'Sign in');
    els.authSwitch.textContent = signup ? L('Déjà un compte ?', 'Already have an account?') : L('Pas encore de compte ?', 'No account yet?');
    els.authLost.hidden = signup;
    els.authConfirmRow.hidden = !(signup || renew);
    els.authPass.autocomplete = signup || renew ? 'new-password' : 'current-password';
    authSay('');
  }

  function showPassword(show) {
    els.authPass.type = els.authPass2.type = show ? 'text' : 'password';
    els.authPeek.setAttribute('aria-pressed', show);
    els.authPeek.setAttribute('aria-label', show ? L('Cacher le mot de passe', 'Hide password') : L('Afficher le mot de passe', 'Show password'));
  }

  function openAuth(hint, renew = false) {
    if (els.auth.open) return;
    els.authForm.reset();
    showPassword(false);
    // Comptes locaux : s'il n'y en a aucun sur cet appareil, on propose directement l'inscription.
    setAuthMode(!renew && !ONLINE && Object.keys(vault.all()).length === 0, renew);
    els.authHint.textContent = hint || '';
    els.authHint.hidden = !hint;
    els.auth.showModal();
    els.authName.focus();
  }

  function bindAccount() {
    els.accountBtn.addEventListener('click', () => { if (account.id) els.menu.togglePopover(); else openAuth(); });
    els.menuFavs.addEventListener('click', () => { els.menu.hidePopover(); showFavs(true); });
    els.menuLogout.addEventListener('click', () => {
      const name = account.name;
      els.menu.hidePopover();
      closeSession();
      toast(L(`À bientôt, ${name} !`, `See you soon, ${name}!`));
    });
    els.menuDelete.addEventListener('click', () => {
      if (!els.menuDelete.dataset.armed) {          // premier clic : on demande confirmation
        els.menuDelete.dataset.armed = '1';
        els.menuDelete.textContent = L('Confirmer la suppression', 'Confirm deletion');
        return;
      }
      const all = vault.all();
      delete all[slot(account.id)];
      vault.save(all);
      els.menu.hidePopover();
      closeSession();
      toast(L('Compte supprimé de cet appareil.', 'Account removed from this device.'));
    });
    els.menu.addEventListener('toggle', () => {
      delete els.menuDelete.dataset.armed;
      els.menuDelete.textContent = L('Supprimer ce compte', 'Delete this account');
    });
    els.favChip.addEventListener('click', () => showFavs(!state.onlyFavs));
    els.menuAlerts.addEventListener('click', toggleAlerts);

    els.grid.addEventListener('click', e => {
      const button = e.target.closest('.card__fav');
      if (button) return toggleFav(+button.dataset.fav, button);
      const shareButton = e.target.closest('.card__share');
      if (shareButton) shareGame(+shareButton.dataset.share);
    });

    els.authSwitch.addEventListener('click', () => { setAuthMode(!authSignup); els.authName.focus(); });
    if (ONLINE) els.authNote.textContent = L('Ton compte et tes favoris sont enregistrés en ligne : tu les retrouves sur tous tes appareils.',
      'Your account and favourites are stored online: you’ll find them on all your devices.');

    els.authLost.addEventListener('click', async () => {
      if (!ONLINE) {     // sans serveur, impossible d'envoyer un e-mail de récupération : on le dit clairement
        return authSay(L('Ton compte est enregistré sur cet appareil : son mot de passe ne peut pas être retrouvé. Tu peux créer un nouveau compte avec « Pas encore de compte ? ».',
          'Your account is stored on this device: its password can’t be recovered. You can create a new account with “No account yet?”.'), true);
      }
      const email = els.authName.value.trim();
      if (!EMAIL_RULE.test(email)) return authSay(L('Écris d’abord ton adresse e-mail dans le premier champ, puis reclique ici.', 'Type your email address in the first field first, then click here again.'));
      try {
        await cloudReady;
        const { error } = await cloud.auth.resetPasswordForEmail(email, { redirectTo: HOME });
        if (error) throw new Error(cloudMessage(error));
        authSay(L('Si un compte existe pour cette adresse, un e-mail vient de partir avec un lien pour choisir un nouveau mot de passe.',
          'If an account exists for this address, an email is on its way with a link to choose a new password.'), true);
      } catch (error) {
        authSay(error.message);
      }
    });

    // Facebook, Google, Apple, Discord : seuls les réseaux listés dans config.js sont branchés.
    els.authSocial.addEventListener('click', async e => {
      const button = e.target.closest('[data-social]');
      if (!button) return;
      const provider = button.dataset.social.toLowerCase();
      if (!ONLINE || !PROVIDERS.includes(provider)) {
        return authSay(L(`La connexion avec ${button.dataset.social} n’est pas encore activée. Utilise ton e-mail pour l’instant.`,
          `Signing in with ${button.dataset.social} isn’t available yet. Use your email for now.`), true);
      }
      try {
        await cloudReady;
        const { error } = await cloud.auth.signInWithOAuth({ provider, options: { redirectTo: HOME } });
        if (error) throw new Error(cloudMessage(error));     // sinon le navigateur part vers la page du réseau
      } catch (error) {
        authSay(error.message);
      }
    });
    els.authClose.addEventListener('click', () => els.auth.close());
    els.auth.addEventListener('close', () => { pendingFav = 0; });
    els.auth.addEventListener('click', e => {       // clic à côté de la fenêtre : on la ferme
      if (e.target !== els.auth) return;
      const box = els.auth.getBoundingClientRect();
      if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) els.auth.close();
    });
    els.authPeek.addEventListener('click', () => showPassword(els.authPass.type === 'password'));

    els.authForm.addEventListener('submit', async e => {
      e.preventDefault();
      const signup = authSignup, renew = authNew;
      const name = els.authName.value.trim(), password = els.authPass.value;
      const fail = message => authSay(message);
      // Il faut un e-mail, sauf pour se connecter à un compte local créé avec un ancien pseudo.
      if (!renew && (signup || ONLINE ? !EMAIL_RULE.test(name) : !name)) return fail(L('Écris ton adresse e-mail, par exemple prenom@exemple.fr.', 'Type your email address, for example name@example.com.'));
      if (password.length < 6) return fail(L('Le mot de passe doit faire au moins 6 caractères.', 'The password must be at least 6 characters long.'));
      if ((signup || renew) && password !== els.authPass2.value) return fail(L('Les deux mots de passe ne sont pas identiques.', 'The two passwords don’t match.'));
      if (!ONLINE && (!window.crypto || !crypto.subtle)) return fail(L('Ce navigateur ne peut pas protéger un mot de passe sur cette page. Ouvre le site par son adresse en https.', 'This browser can’t protect a password on this page. Open the site through its https address.'));
      els.authSubmit.disabled = true;
      let outcome;
      try {
        if (ONLINE) await cloudReady;
        outcome = await (renew ? cloudNewPassword(password) : signup ? signUp(name, password) : signIn(name, password));
      } catch (error) {
        return fail(error.message);
      } finally {
        els.authSubmit.disabled = false;
      }
      if (outcome === 'confirm') {
        return authSay(L('Presque fini : ouvre l’e-mail que tu viens de recevoir et clique sur le lien pour activer ton compte.',
          'Almost done: open the email you just received and click the link to activate your account.'), true);
      }
      if (pendingFav) { account.favs.add(pendingFav); saveFavs(); paintFavs(); }
      els.auth.close();
      toast(renew ? L('Ton nouveau mot de passe est enregistré.', 'Your new password is saved.')
        : signup ? L(`Bienvenue, ${account.name} ! Ton compte est créé.`, `Welcome, ${account.name}! Your account is ready.`)
          : L(`Te revoilà, ${account.name} !`, `Welcome back, ${account.name}!`));
    });
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
  readURL();
  els.grid.innerHTML = '<div class="ghost"></div>'.repeat(12);
  els.rail.innerHTML = '<div class="poster poster--ghost"><span class="poster__in"></span></div>'.repeat(8);
  paintDials();
  bindControls();
  bindAccount();
  // Bouton de langue : il propose l'autre langue, retient le choix et recharge la page.
  {
    const other = EN ? 'fr' : 'en', button = $('#langBtn');
    button.textContent = other.toUpperCase();
    button.setAttribute('aria-label', EN ? 'Passer en français' : 'Switch to English');
    button.title = EN ? 'Version française' : 'English version';
    button.addEventListener('click', () => {
      try { localStorage.setItem(LANG_KEY, other); } catch { /* le choix passera par l'adresse */ }
      const url = new URL(location.href);
      url.searchParams.set('lang', other);
      location.assign(url);
    });
  }
  restoreSession();
  // Bouton « Tip me » : affiché seulement si config.js donne l'adresse de la page de dons.
  if (/^https:\/\//.test(CONFIG.tipUrl || '')) {
    $('#tipBtn').href = $('#tipLink').href = CONFIG.tipUrl;
    $('#tipBtn').hidden = $('#tipFoot').hidden = false;
  }
  bindTilt(els.grid, '.card', 7);
  bindTilt(els.rail, '.poster', 12);
  bindSpot();
  if (!reduceMotion.matches) lightEmbers();
  pauseOffscreen();
  load();
})();
