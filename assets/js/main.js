/* ===== Rigorous Mode Timeline ===== */
(function(){
  const NODES = document.getElementById('nodes');
  const YEAR_TICKS = document.getElementById('yearTicks');
  const AXIS = document.querySelector('.axis');
  const AXIS_FILL = document.querySelector('.axis-fill');
  const PROGRESS = document.getElementById('progress');
  const THEME_BTN = document.getElementById('themeToggle');
  const FX_BTN = document.getElementById('fxToggle');
  const TOUR_BTN = document.getElementById('tourBtn');
  const PRINT_BTN = document.getElementById('printBtn');
  const CANVAS = document.getElementById('fx-canvas');
  const CTX = CANVAS.getContext('2d', { alpha: true });
  const TEMPLATE = document.getElementById('nodeTemplate');

  let EVENTS = [];
  let fxOn = (document.documentElement.dataset.fx ?? 'on') === 'on';
  let theme = document.documentElement.dataset.theme || 'light';
  let IO;

  /* Utils */
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = iso => { try { return new Date(iso).toLocaleDateString(undefined, {year:'numeric',month:'long',day:'numeric'}); } catch { return iso; } };
  const yearOf = iso => new Date(iso).getFullYear();

  function setCanvasSize(){
    const dpr = window.devicePixelRatio || 1;
    CANVAS.width = Math.floor(window.innerWidth * dpr);
    CANVAS.height = Math.floor(window.innerHeight * dpr);
  }

  /* Background starfield */
  const stars = [];
  function initStars(){
    stars.length = 0;
    const dpr = window.devicePixelRatio || 1;
    const count = Math.min(240, Math.floor(window.innerWidth/5));
    for(let i=0;i<count;i++){
      stars.push({x:Math.random()*CANVAS.width,y:Math.random()*CANVAS.height,z:Math.random()*1+0.3,s:(Math.random()*1.2+0.3)*dpr,t:Math.random()*Math.PI*2});
    }
  }
  function drawStars(){
    if(!fxOn || prefersReduced){ CTX.clearRect(0,0,CANVAS.width,CANVAS.height); return; }
    const tint = theme === 'dark' ? '255,255,255' : '40,50,100';
    CTX.clearRect(0,0,CANVAS.width,CANVAS.height);
    const sc = (window.scrollY||0);
    for(const st of stars){
      const y = (st.y + sc*st.z*0.2) % CANVAS.height;
      st.t += 0.02;
      const a = 0.2 + 0.5*Math.sin(st.t);
      CTX.fillStyle = `rgba(${tint},${a})`;
      CTX.beginPath(); CTX.arc(st.x, y, st.s, 0, Math.PI*2); CTX.fill();
    }
    requestAnimationFrame(drawStars);
  }

  /* Axis + progress */
  function updateAxis(){
    const rect = AXIS.getBoundingClientRect();
    const winH = window.innerHeight;
    const top = clamp((winH/2 - rect.top), 0, rect.height);
    AXIS_FILL.style.height = `${top}px`;

    const sc = window.scrollY || document.documentElement.scrollTop;
    const total = document.body.scrollHeight - winH;
    PROGRESS.style.transform = `scaleX(${clamp(total? sc/total : 0, 0, 1)})`;
  }

  /* Build ticks (2009..2025 visible) */
  function buildTicks(minY, maxY){
    YEAR_TICKS.innerHTML = '';
    for(let y = minY; y <= maxY; y++){
      const li = document.createElement('li');
      const pct = (y - minY) / (maxY - minY);
      li.style.top = (pct * 100) + '%';
      li.className = 'reveal-up';
      li.innerHTML = `<span class="tick-line"></span>${y}`;
      YEAR_TICKS.appendChild(li);
    }
  }

  /* Map date to Y% along axis */
  function yPercent(dateISO, minISO, maxISO){
    const t = +new Date(dateISO);
    const a = +new Date(minISO);
    const b = +new Date(maxISO);
    return (t - a) / (b - a);
  }

  /* Node creation */
  function buildNode(ev, idx, minISO, maxISO){
    const li = TEMPLATE.content.firstElementChild.cloneNode(true);
    const node = li;
    const dot = li.querySelector('.dot');
    const panel = li.querySelector('.panel');
    const yPct = yPercent(ev.date, minISO, maxISO);
    const side = (idx % 2 === 0) ? 'left' : 'right';

    node.style.top = (yPct * 100) + '%';
    node.dataset.side = side;

    const title = li.querySelector('.panel-title');
    const subtitle = li.querySelector('.panel-sub');
    const dateEl = li.querySelector('.panel-date');
    const desc = li.querySelector('.panel-desc');
    const media = li.querySelector('.panel-media');
    const tags = li.querySelector('.panel-tags');
    const meta = li.querySelector('.panel-meta');
    const yearLabel = li.querySelector('.year-label');

    dateEl.textContent = fmt(ev.date);
    title.textContent = ev.title || 'Untitled event';
    subtitle.textContent = ev.subtitle || (ev.location? `@ ${ev.location}` : '');
    desc.textContent = ev.description || '';
    yearLabel.textContent = String(new Date(ev.date).getFullYear());

    if(ev.image){
      const img = new Image(); img.src = ev.image; img.alt = ev.image_alt || '';
      media.innerHTML = ''; media.appendChild(img);
    } else {
      media.innerHTML = `
        <svg viewBox="0 0 200 120" width="100%" height="100%" aria-hidden="true">
          <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="currentColor" stop-opacity=".6"/><stop offset="1" stop-color="currentColor" stop-opacity=".2"/>
          </linearGradient></defs>
          <rect x="0" y="0" width="200" height="120" rx="12" fill="url(#lg)"/>
          <circle cx="48" cy="46" r="22" fill="#fff" opacity=".15"/>
          <rect x="90" y="34" width="90" height="12" rx="6" fill="#fff" opacity=".25"/>
          <rect x="90" y="56" width="70" height="12" rx="6" fill="#fff" opacity=".18"/>
        </svg>`;
    }

    (ev.tags||[]).forEach(t=>{
      const liTag = document.createElement('li'); liTag.textContent = t; tags.appendChild(liTag);
    });

    meta.textContent = ev.location ? `📍 ${ev.location}` : '';

    // Position the panel and arrow offset
    const dy = -20; // slight raise
    node.style.setProperty('--ty', dy + 'px');
    node.style.setProperty('--tx', side === 'left' ? '-14px' : '14px');

    // Interactions
    function openPanel(pin=false){
      node.classList.add('active');
      if(pin) node.dataset.pinned = 'true';
      burst(node.getBoundingClientRect().left + window.innerWidth/2, node.getBoundingClientRect().top, document.body);
    }
    function closePanel(){
      node.classList.remove('active');
      node.dataset.pinned = '';
    }

    node.addEventListener('pointerenter', ()=>{ if(!node.dataset.pinned) openPanel(false); });
    node.addEventListener('pointerleave', ()=>{ if(!node.dataset.pinned) closePanel(); });
    node.addEventListener('click', ()=>{ if(node.dataset.pinned){ closePanel(); } else { openPanel(true); } });
    node.addEventListener('keydown', (e)=>{
      if(e.key==='Enter' || e.key===' '){ e.preventDefault(); if(node.dataset.pinned){ closePanel(); } else { openPanel(true); } }
      if(e.key==='Escape'){ closePanel(); }
      // Up/Down to move between nodes
      if(e.key==='ArrowDown' || e.key==='ArrowUp'){
        e.preventDefault();
        const nodes = $$('.node', NODES);
        const i = nodes.indexOf(node);
        const j = e.key==='ArrowDown' ? i+1 : i-1;
        if(nodes[j]) nodes[j].focus({preventScroll:false});
        nodes[j]?.scrollIntoView({behavior:'smooth', block:'center'});
      }
    });

    // Mouse glow tilt
    node.addEventListener('mousemove', (e)=>{
      if(!fxOn || prefersReduced) return;
      const r = panel.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width/2))/(r.width/2);
      const dy = (e.clientY - (r.top + r.height/2))/(r.height/2);
      panel.style.transform = `translate3d(var(--tx), var(--ty), 0) rotateX(${ -dy*6 }deg) rotateY(${ dx*8 }deg)`;
    });
    node.addEventListener('mouseleave', ()=>{ panel.style.transform=''; });

    // Ripple on dot
    node.addEventListener('click', (e)=> ripple(e, dot));

    // Entrance reveal class
    li.classList.add('reveal-up');

    return li;
  }

  /* Build all nodes */
  function render(){
    const minYear = 2009, maxYear = 2025;
    // enforce exactly 15 items in range (will render what’s in data)
    const minISO = `${minYear}-01-01`;
    const maxISO = `${maxYear}-12-31`;

    buildTicks(minYear, maxYear);

    NODES.innerHTML = '';
    const frag = document.createDocumentFragment();
    EVENTS.forEach((ev, i) => {
      const node = buildNode(ev, i, minISO, maxISO);
      frag.appendChild(node);
    });
    NODES.appendChild(frag);

    observeInView();
    updateAxis();
  }

  /* Reveal on view */
  function observeInView(){
    IO?.disconnect();
    IO = new IntersectionObserver((entries)=>{
      entries.forEach(ent=>{
        if(ent.isIntersecting){
          ent.target.classList.add('visible');
          IO.unobserve(ent.target);
        }
      });
    },{rootMargin:'0px 0px -15% 0px',threshold:0.15});
    $$('.node').forEach(n=>IO.observe(n));
  }

  /* Ripples + Bursts */
  function ripple(e, el){
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    el.style.setProperty('--rx', x+'px'); el.style.setProperty('--ry', y+'px');
    const hyp = Math.hypot(r.width, r.height);
    el.style.setProperty('--rsize', hyp+'px');
    setTimeout(()=> el.style.removeProperty('--rsize'), 450);
  }
  function burst(x, y, root=document.body){
    if(!fxOn || prefersReduced) return;
    const count = 18;
    for(let i=0;i<count;i++){
      const p = document.createElement('span');
      p.className = 'particle';
      const ang = (Math.PI*2)*(i/count) + (Math.random()*0.6-0.3);
      const vel = 8 + Math.random()*6;
      const dx = Math.cos(ang)*vel, dy = Math.sin(ang)*vel;
      p.style.left = x+'px'; p.style.top = y+'px';
      p.style.setProperty('--dx', dx); p.style.setProperty('--dy', dy);
      p.style.setProperty('--life', 700 + Math.random()*500);
      p.style.background = `linear-gradient(180deg, var(--brand), var(--accent))`;
      root.appendChild(p); setTimeout(()=>p.remove(), 1400);
    }
  }
  (function injectParticleCSS(){
    const s = document.createElement('style');
    s.textContent = `.particle{position:fixed;width:6px;height:6px;border-radius:50%;pointer-events:none;z-index:9999;transform:translate(-50%,-50%);opacity:1;filter:drop-shadow(0 8px 16px rgba(0,0,0,.25));animation:fly var(--life,900ms) ease-out forwards}
    @keyframes fly{to{transform:translate(calc(-50% + var(--dx)*12px), calc(-50% + var(--dy)*12px));opacity:0}} .dot{--rsize:0px} .dot::after{content:"";position:absolute;left:var(--rx);top:var(--ry);width:var(--rsize);height:var(--rsize);transform:translate(-50%,-50%);border-radius:50%;background:#fff4}`;
    document.head.appendChild(s);
  })();

  /* Parallax hero beams */
  function parallaxHero(){
    const hero = document.getElementById('hero');
    const rect = hero.getBoundingClientRect();
    const center = rect.top + rect.height/2 - window.innerHeight/2;
    $$('.hero-bg .beam').forEach(el=>{
      const depth = parseFloat(el.dataset.depth||'0.2');
      el.style.transform = `translate3d(0, ${-center*depth}px, 0)`;
    });
  }

  /* Tour mode */
  let tourTimer = null;
  function runTour() {
    stopTour();
    const nodes = $$('.node', NODES);
    let i = 0;
    function step(){
      if(i>=nodes.length){ stopTour(); return; }
      nodes.forEach(n=>{ n.classList.remove('active'); n.dataset.pinned=''; });
      const n = nodes[i];
      n.classList.add('active'); n.dataset.pinned='true';
      n.scrollIntoView({behavior:'smooth', block:'center'});
      i++;
      tourTimer = setTimeout(step, 1600);
    }
    step();
  }
  function stopTour(){ if(tourTimer){ clearTimeout(tourTimer); tourTimer=null; } }

  /* Toggles */
  THEME_BTN.addEventListener('click', ()=>{
    const cur = document.documentElement.dataset.theme || 'light';
    theme = cur === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    try{ localStorage.setItem('theme', theme); }catch(e){}
    THEME_BTN.setAttribute('aria-pressed', String(theme==='dark'));
  });
  FX_BTN.addEventListener('click', (e)=>{
    fxOn = !fxOn; document.documentElement.dataset.fx = fxOn ? 'on' : 'off';
    FX_BTN.setAttribute('aria-pressed', String(fxOn));
    try{ localStorage.setItem('fx', fxOn ? 'on' : 'off'); }catch(e){}
    ripple(e, FX_BTN);
  });
  TOUR_BTN.addEventListener('click', ()=> { if(tourTimer){ stopTour(); TOUR_BTN.textContent='Tour'; } else { runTour(); TOUR_BTN.textContent='Stop'; } });
  PRINT_BTN.addEventListener('click', ()=>window.print());

  /* Events */
  window.addEventListener('scroll', ()=>{ updateAxis(); parallaxHero(); }, {passive:true});
  window.addEventListener('resize', ()=>{ updateAxis(); setCanvasSize(); initStars(); }, {passive:true});
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e=>{ theme = e.matches?'dark':'light'; });

  /* Load data & boot */
  fetch('data/events.json', {cache:'no-cache'})
    .then(r=>r.json())
    .then(json=>{
      EVENTS = (json.events||[]).slice(0,15); // enforce 15
      render();
    })
    .catch(err=>{
      console.error('events.json failed', err);
      NODES.innerHTML = '<li style="position:absolute;top:10%;left:50%;transform:translateX(-50%);color:var(--muted)">Could not load data/events.json</li>';
    });

  // Canvas boot
  function bootCanvas(){ if(prefersReduced) return; setCanvasSize(); initStars(); drawStars(); }
  bootCanvas();

})();
