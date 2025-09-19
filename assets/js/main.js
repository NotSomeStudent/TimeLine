/* ===== Horizontal Ultra Timeline (Tour-Only UI) ===== */
(function(){
  const VIEW = document.querySelector('.viewport');
  const RAIL = document.getElementById('rail');
  const NODES = document.getElementById('nodes');
  const TICKS = document.getElementById('ticks');
  const PROGRESS = document.getElementById('progress');
  const AXIS_FILL = document.getElementById('axisFill');
  const TOUR_BTN = document.getElementById('tourBtn');
  const COUNTER = document.getElementById('counter');
  const CANVAS = document.getElementById('fx-canvas');
  const CTX = CANVAS.getContext('2d', { alpha:true });
  const TEMPLATE = document.getElementById('nodeTemplate');

  let EVENTS = [];
  let IO;
  let tourTimer = null;
  let current = 0;
  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let theme = document.documentElement.dataset.theme || 'light';

  /* ---------- Canvas FX (starfield with horizontal parallax) ---------- */
  const stars = [];
  function sizeCanvas(){
    const dpr = devicePixelRatio || 1;
    CANVAS.width = Math.floor(innerWidth * dpr);
    CANVAS.height = Math.floor(innerHeight * dpr);
  }
  function initStars(){
    stars.length = 0;
    const dpr = devicePixelRatio || 1;
    const count = Math.min(260, Math.floor(innerWidth/4));
    for(let i=0;i<count;i++){
      stars.push({
        x: Math.random()*CANVAS.width,
        y: Math.random()*CANVAS.height,
        z: Math.random()*1+0.3,
        s: (Math.random()*1.2+0.3)*dpr,
        t: Math.random()*Math.PI*2
      });
    }
  }
  function drawStars(){
    if(prefersReduced){ CTX.clearRect(0,0,CANVAS.width,CANVAS.height); return; }
    const tint = theme==='dark'?'255,255,255':'40,50,100';
    CTX.clearRect(0,0,CANVAS.width,CANVAS.height);
    const scrollX = VIEW.scrollLeft || 0;
    for(const st of stars){
      const x = (st.x - scrollX*st.z*0.15) % CANVAS.width;
      const y = st.y;
      st.t += 0.02; const a = 0.18 + 0.5*Math.sin(st.t);
      CTX.fillStyle = `rgba(${tint},${a})`;
      CTX.beginPath(); CTX.arc((x+CANVAS.width)%CANVAS.width, y, st.s, 0, Math.PI*2);
      CTX.fill();
    }
    requestAnimationFrame(drawStars);
  }

  /* ---------- Build nodes/ticks ---------- */
  function buildTicks(years){
    TICKS.innerHTML = '';
    years.forEach(y=>{
      const li = document.createElement('li');
      li.innerHTML = `<span class="tick-line"></span>${y}`;
      TICKS.appendChild(li);
    });
  }

  function buildNode(ev, i){
    const li = TEMPLATE.content.firstElementChild.cloneNode(true);
    const node = li;
    const dot = li.querySelector('.dot');
    const card = li.querySelector('.card');
    const dateEl = li.querySelector('.date');
    const title = li.querySelector('.title');
    const sub = li.querySelector('.sub');
    const media = li.querySelector('.media');
    const desc = li.querySelector('.desc');
    const meta = li.querySelector('.meta');
    const yearLabel = li.querySelector('.year-label');

    dateEl.textContent = new Date(ev.date).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
    title.textContent = ev.title || 'Untitled';
    sub.textContent = ev.subtitle || (ev.location ? `@ ${ev.location}` : '');
    desc.textContent = ev.description || '';
    meta.textContent = ev.location ? `📍 ${ev.location}` : '';
    yearLabel.textContent = String(new Date(ev.date).getFullYear());

    if(ev.image){
      const img = new Image(); img.src = ev.image; img.alt = ev.image_alt || '';
      media.innerHTML = ''; media.appendChild(img);
    } else {
      media.innerHTML = `
        <svg viewBox="0 0 200 120" width="100%" height="100%" aria-hidden="true">
          <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="currentColor" stop-opacity=".6"/>
            <stop offset="1" stop-color="currentColor" stop-opacity=".2"/>
          </linearGradient></defs>
          <rect x="0" y="0" width="200" height="120" rx="12" fill="url(#lg)"/>
          <circle cx="48" cy="46" r="22" fill="#fff" opacity=".15"/>
          <rect x="90" y="34" width="90" height="12" rx="6" fill="#fff" opacity=".25"/>
          <rect x="90" y="56" width="70" height="12" rx="6" fill="#fff" opacity=".18"/>
        </svg>`;
    }

    // lift card above/below axis alternating, fixed distance to keep layout perfect
    const lift = (i % 2 === 0) ? 160 : -160;
    card.style.setProperty('--lift', Math.abs(lift) + 'px');
    if(lift < 0){
      card.style.top = `calc(50% + ${Math.abs(lift)}px)`;
    }

    // interactions: hover/focus open; click pin
    function open(pin=false){
      node.classList.add('active');
      dot.setAttribute('aria-expanded','true');
      if(pin) node.dataset.pinned = 'true';
    }
    function close(){
      node.classList.remove('active');
      dot.setAttribute('aria-expanded','false');
      node.dataset.pinned = '';
    }
    node.addEventListener('pointerenter', ()=>{ if(!node.dataset.pinned) open(false); });
    node.addEventListener('pointerleave', ()=>{ if(!node.dataset.pinned) close(); });
    dot.addEventListener('click', ()=>{ if(node.dataset.pinned) close(); else open(true); });
    node.addEventListener('keydown', (e)=>{
      if(e.key==='Enter' || e.key===' '){ e.preventDefault(); if(node.dataset.pinned) close(); else open(true); }
      if(e.key==='Escape'){ close(); }
    });

    // subtle 3D tilt on card
    node.addEventListener('mousemove', e=>{
      if(prefersReduced) return;
      const r = card.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width/2))/(r.width/2);
      const dy = (e.clientY - (r.top + r.height/2))/(r.height/2);
      card.style.transform = `translate(-50%,-50%) scale(1) rotateX(${ -dy*6 }deg) rotateY(${ dx*8 }deg)`;
      card.querySelector('.shine').style.transform = `rotate(${dx*24}deg)`;
    });
    node.addEventListener('mouseleave', ()=>{ card.style.transform=''; });

    return li;
  }

  /* ---------- Render ---------- */
  function render(){
    // enforce 15 nodes; evenly-spaced columns (no date distortion)
    const COUNT = EVENTS.length;
    RAIL.style.setProperty('--count', COUNT);

    // ticks show each node's year (perfect alignment)
    buildTicks(EVENTS.map(e=>new Date(e.date).getFullYear()));

    NODES.innerHTML = '';
    const frag = document.createDocumentFragment();
    EVENTS.forEach((ev,i)=> frag.appendChild(buildNode(ev,i)));
    NODES.appendChild(frag);

    observeInView();
    updateUI(0);
  }

  /* ---------- IO for visibility (entrance) ---------- */
  function observeInView(){
    IO?.disconnect();
    IO = new IntersectionObserver((entries)=>{
      entries.forEach(ent=>{
        if(ent.isIntersecting){
          ent.target.classList.add('active');
          IO.unobserve(ent.target);
        }
      });
    }, {root:VIEW, threshold:.35});
    Array.from(NODES.children).forEach(n=>IO.observe(n));
  }

  /* ---------- Scroll helpers ---------- */
  function snapTo(i){
    const node = NODES.children[i];
    if(!node) return;
    node.scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'});
  }

  function updateUI(i){
    current = i;
    COUNTER.textContent = `${i+1}/${EVENTS.length}`;
    // progress + axis fill
    const pct = i/(EVENTS.length-1);
    PROGRESS.style.transform = `scaleX(${pct})`;
    AXIS_FILL.style.width = `calc(${pct*100}% )`;
    // open current node
    Array.from(NODES.children).forEach((n,idx)=>{
      if(idx===i){ n.classList.add('active'); n.dataset.pinned='true'; }
      else { n.classList.remove('active'); n.dataset.pinned=''; }
    });
  }

  /* ---------- Tour mode ---------- */
  function startTour(){
    stopTour();
    TOUR_BTN.textContent = 'Stop Tour';
    TOUR_BTN.setAttribute('aria-pressed','true');
    let i = 0;
    const step = ()=>{
      updateUI(i);
      snapTo(i);
      i++;
      tourTimer = setTimeout(()=>{
        if(i < EVENTS.length) step();
        else { stopTour(); }
      }, 1800);
    };
    step();
  }
  function stopTour(){
    if(tourTimer){ clearTimeout(tourTimer); tourTimer = null; }
    TOUR_BTN.textContent = 'Start Tour';
    TOUR_BTN.setAttribute('aria-pressed','false');
  }
  TOUR_BTN.addEventListener('click', ()=> tourTimer ? stopTour() : startTour());

  // arrow keys left/right for internal nav (not exposed as UI “customization”)
  VIEW.addEventListener('keydown', (e)=>{
    if(e.key==='ArrowRight'){ const i = Math.min(EVENTS.length-1, current+1); updateUI(i); snapTo(i); }
    if(e.key==='ArrowLeft'){ const i = Math.max(0, current-1); updateUI(i); snapTo(i); }
  });

  /* ---------- Sync axis/progress with manual scroll (if user drags) ---------- */
  let scrollIdle;
  VIEW.addEventListener('scroll', ()=>{
    if(!NODES.children.length) return;
    const w = NODES.children[0].getBoundingClientRect().width + parseFloat(getComputedStyle(RAIL).gap);
    const left = VIEW.scrollLeft + (VIEW.clientWidth - NODES.children[0].getBoundingClientRect().width)/2;
    const idx = Math.round(left / w);
    const i = Math.max(0, Math.min(EVENTS.length-1, idx));
    updateUI(i);
    if(scrollIdle) cancelAnimationFrame(scrollIdle);
    scrollIdle = requestAnimationFrame(drawStars);
  }, {passive:true});

  /* ---------- Boot ---------- */
  fetch('data/events.json', {cache:'no-cache'})
    .then(r=>r.json())
    .then(json=>{
      EVENTS = (json.events || []).slice(0,15);
      render();
      VIEW.tabIndex = 0; // keyboard focusable
      VIEW.focus({preventScroll:true});
    })
    .catch(err=>{
      console.error('Failed to load events.json', err);
      NODES.innerHTML = '<li style="color:var(--muted)">Could not load data/events.json</li>';
    });

  // canvas boot
  function bootCanvas(){ if(prefersReduced) return; sizeCanvas(); initStars(); drawStars(); }
  bootCanvas();
  addEventListener('resize', ()=>{ sizeCanvas(); initStars(); }, {passive:true});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e=>{ theme = e.matches?'dark':'light'; });

})();
