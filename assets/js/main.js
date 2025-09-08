/* ===== Timeline App ===== */
(function () {
  const LIST = document.getElementById('timelineList');
  const TEMPLATE = document.getElementById('eventTemplate');
  const AXIS_FILL = document.querySelector('.axis-fill');
  const THEME_BTN = document.getElementById('themeToggle');
  const PRINT_BTN = document.getElementById('printBtn');
  const SEARCH = document.getElementById('searchInput');
  const TAG_CHIPS = document.getElementById('tagChips');
  const SORT = document.getElementById('sortSelect');

  let EVENTS = [];
  let ACTIVE_TAGS = new Set();

  /* ——— Utils ——— */
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const formatDate = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return iso; }
  };
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const matchesSearch = (ev, q) => {
    if (!q) return true;
    q = q.toLowerCase();
    const hay = [
      ev.title, ev.subtitle, ev.location, ev.description,
      ev.tags?.join(' ') || '', new Date(ev.date).getFullYear().toString()
    ].join(' ').toLowerCase();
    return hay.includes(q);
  };

  function renderChips(allTags) {
    TAG_CHIPS.innerHTML = '';
    allTags.sort((a,b)=>a.localeCompare(b)).forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.type = 'button';
      btn.textContent = tag;
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => {
        const on = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', String(!on));
        if (on) ACTIVE_TAGS.delete(tag); else ACTIVE_TAGS.add(tag);
        render();
      });
      TAG_CHIPS.appendChild(btn);
    });
    if (!allTags.length) {
      const span = document.createElement('span');
      span.className = 'chip';
      span.textContent = 'No tags yet';
      span.style.opacity = .6;
      TAG_CHIPS.appendChild(span);
    }
  }

  function buildCard(ev) {
    const li = TEMPLATE.content.firstElementChild.cloneNode(true);
    const article = li.querySelector('.card');
    const media = li.querySelector('.card-media');
    const dateEl = li.querySelector('.card-date');
    const title = li.querySelector('.card-title');
    const sub = li.querySelector('.card-subtitle');
    const desc = li.querySelector('.card-desc');
    const tags = li.querySelector('.tag-list');
    const meta = li.querySelector('.card-meta');

    article.id = ev.id || ('event-' + Math.random().toString(36).slice(2));
    article.setAttribute('aria-labelledby', article.id + '-title');

    title.id = article.id + '-title';
    title.textContent = ev.title || 'Untitled event';
    sub.textContent = ev.subtitle || (ev.location ? `@ ${ev.location}` : '');
    dateEl.dateTime = ev.date;
    dateEl.textContent = formatDate(ev.date);
    desc.textContent = ev.description || '';

    // Media
    if (ev.image) {
      const img = new Image();
      img.src = ev.image;
      img.alt = ev.image_alt || '';
      media.innerHTML = '';
      media.appendChild(img);
    } else {
      // decorative icon if no image
      media.innerHTML = `
        <svg viewBox="0 0 200 120" width="100%" height="100%" aria-hidden="true">
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="currentColor" stop-opacity=".6"/>
              <stop offset="1" stop-color="currentColor" stop-opacity=".2"/>
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="200" height="120" rx="12" fill="url(#lg)"/>
          <circle cx="48" cy="46" r="22" fill="#fff" opacity=".15"/>
          <rect x="90" y="34" width="90" height="12" rx="6" fill="#fff" opacity=".25"/>
          <rect x="90" y="56" width="70" height="12" rx="6" fill="#fff" opacity=".18"/>
        </svg>
      `;
    }

    // Tags
    (ev.tags || []).forEach(t => {
      const liTag = document.createElement('li');
      const badge = document.createElement('span');
      badge.className = 'tag';
      badge.textContent = t;
      liTag.appendChild(badge);
      tags.appendChild(liTag);
    });

    // Meta / actions
    const left = document.createElement('div');
    left.textContent = ev.location ? `📍 ${ev.location}` : '';
    const right = document.createElement('div');
    right.className = 'card-actions';

    if (ev.link) {
      const a = document.createElement('a');
      a.href = ev.link; a.target = '_blank'; a.rel = 'noopener';
      a.className = 'btn link'; a.textContent = 'Learn more';
      right.appendChild(a);
    }
    meta.append(left, right);

    // Hover parallax — track mouse position to create light glow
    article.addEventListener('mousemove', e => {
      const rect = article.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 100;
      const my = ((e.clientY - rect.top) / rect.height) * 100;
      article.style.setProperty('--mx', mx + '%');
      article.style.setProperty('--my', my + '%');
    });

    return li;
  }

  function computeAxisFill() {
    const listRect = LIST.getBoundingClientRect();
    const winH = window.innerHeight;
    const top = clamp((winH/2 - listRect.top), 0, listRect.height);
    AXIS_FILL.style.height = `${top}px`;
  }

  function render() {
    const query = SEARCH.value.trim();
    const sortAsc = SORT.value === 'asc';
    let items = EVENTS.slice();

    if (ACTIVE_TAGS.size) {
      items = items.filter(ev => (ev.tags || []).some(t => ACTIVE_TAGS.has(t)));
    }
    if (query) {
      items = items.filter(ev => matchesSearch(ev, query));
    }
    items.sort((a,b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return sortAsc ? da - db : db - da;
    });

    LIST.innerHTML = '';
    const frag = document.createDocumentFragment();
    items.forEach(ev => frag.appendChild(buildCard(ev)));
    LIST.appendChild(frag);
    observeInView();
    computeAxisFill();
  }

  /* ——— Intersection Observer for entrance animations ——— */
  let IO;
  function observeInView() {
    IO?.disconnect();
    IO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.querySelector('.card')?.classList.add('visible');
          IO.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });
    $$('.timeline-item').forEach(item => IO.observe(item));
  }

  /* ——— Accessibility: keyboard nav with arrow keys ——— */
  LIST.addEventListener('keydown', (e) => {
    if (!['ArrowDown','ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const cards = $$('.card', LIST);
    const active = document.activeElement.closest('.card') || cards[0];
    const idx = cards.indexOf(active);
    const next = e.key === 'ArrowDown' ? cards[idx+1] : cards[idx-1];
    if (next) next.focus({preventScroll:false});
  });

  /* ——— Theme toggle ——— */
  THEME_BTN.addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || 'light';
    const next = cur === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch(e){}
    THEME_BTN.setAttribute('aria-pressed', String(next === 'dark'));
  });

  /* ——— Print ——— */
  PRINT_BTN.addEventListener('click', () => window.print());

  /* ——— Search shortcut ——— */
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      SEARCH.focus();
    }
  });

  /* ——— Sorting ——— */
  SORT.addEventListener('change', render);
  SEARCH.addEventListener('input', render);
  window.addEventListener('resize', computeAxisFill);
  window.addEventListener('scroll', computeAxisFill, { passive: true });

  /* ——— Load data ——— */
  fetch('data/events.json', { cache: 'no-cache' })
    .then(r => r.json())
    .then(json => {
      EVENTS = json.events || [];
      // Collect tags
      const uniqueTags = Array.from(new Set(EVENTS.flatMap(e => e.tags || [])));
      renderChips(uniqueTags);
      render();
    })
    .catch(err => {
      console.error('Failed to load events.json', err);
      LIST.innerHTML = `
        <li class="timeline-item">
          <article class="card visible">
            <div class="card-body">
              <h3 style="margin-bottom:.5rem">Couldn’t load data 😬</h3>
              <p>Please ensure <code>data/events.json</code> exists and is valid JSON.</p>
            </div>
          </article>
        </li>`;
    });

})();
