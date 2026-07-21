/* Best Bottles — Beautifully Contained
   Canvas image-sequence scrub cinema. Deterministic, real product frames.
   Public dev hooks: __bbLenis, __bbScrollTrigger, __bbFrames, __bbRefraction */
(() => {
  'use strict';

  const SEQS = { swingin: 72, cascade: 132, range: 96, macro: 72 };
  const pad = n => String(n).padStart(4, '0');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = matchMedia('(max-width:768px)').matches;
  const FALLBACK = reduce || isMobile;

  const loader = document.getElementById('loader');
  const fill = document.getElementById('loader-fill');
  const pct = document.getElementById('loader-pct');

  /* ============================ FRAME PRELOAD ============================ */
  const frames = {};              // seq -> [Image]
  window.__bbFrames = frames;

  function preload(onProgress, done) {
    if (FALLBACK) { done(); return; }              // fallback uses <video>, skip frames
    const total = Object.values(SEQS).reduce((a, b) => a + b, 0);
    let loaded = 0;
    const bump = () => { loaded++; onProgress(loaded / total); if (loaded >= total) done(); };
    for (const [seq, n] of Object.entries(SEQS)) {
      frames[seq] = new Array(n);
      for (let i = 0; i < n; i++) {
        const img = new Image();
        img.onload = img.onerror = bump;
        img.src = `frames/${seq}/frame_${pad(i + 1)}.jpg`;
        frames[seq][i] = img;
      }
    }
  }

  /* ============================ SMOOTH SCROLL =========================== */
  // Lenis-style: lerp a virtual position toward a wheel/touch-driven target.
  const Lenis = (() => {
    let target = window.scrollY, current = target, running = false;
    const EASE = 0.09;
    const maxY = () => document.documentElement.scrollHeight - window.innerHeight;
    function onWheel(e) { e.preventDefault(); target = clamp(target + e.deltaY, 0, maxY()); start(); }
    let ty = 0;
    function onTouchStart(e){ ty = e.touches[0].clientY; }
    function onTouchMove(e){ const y=e.touches[0].clientY; target=clamp(target+(ty-y)*1.6,0,maxY()); ty=y; e.preventDefault(); start(); }
    function onKey(e){
      const k=e.key, big=window.innerHeight*0.85;
      if(k==='PageDown'||k===' ') target=clamp(target+big,0,maxY());
      else if(k==='PageUp') target=clamp(target-big,0,maxY());
      else if(k==='ArrowDown') target=clamp(target+80,0,maxY());
      else if(k==='ArrowUp') target=clamp(target-80,0,maxY());
      else if(k==='Home') target=0;
      else if(k==='End') target=maxY();
      else return;
      e.preventDefault(); start();
    }
    function frame(){
      current = lerp(current, target, EASE);
      if (Math.abs(target - current) < 0.4){ current = target; running = false; }
      window.scrollTo(0, current);
      if (running) requestAnimationFrame(frame);
    }
    function start(){ if(!running){ running=true; requestAnimationFrame(frame); } }
    function enable(){
      target = current = window.scrollY;
      addEventListener('wheel', onWheel, { passive:false });
      addEventListener('touchstart', onTouchStart, { passive:true });
      addEventListener('touchmove', onTouchMove, { passive:false });
      addEventListener('keydown', onKey);
      addEventListener('resize', ()=>{ target=clamp(target,0,maxY()); });
    }
    return { enable, get target(){return target;}, set target(v){target=clamp(v,0,maxY());start();}, get current(){return current;} };
  })();
  window.__bbLenis = Lenis;

  /* ============================ SCRUB CANVASES ========================== */
  const chapters = [];
  document.querySelectorAll('canvas.scrub[data-seq]').forEach(cv => {
    const seq = cv.dataset.seq;
    chapters.push({ seq, cv, ctx: cv.getContext('2d', { alpha:false }),
                    section: cv.closest('.chapter'), shown: -1, disp: 0, prog: 0 });
  });

  function sizeCanvas(c){
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.cv.clientWidth, h = c.cv.clientHeight;
    c.cv.width = Math.round(w * dpr); c.cv.height = Math.round(h * dpr);
    c.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.shown = -1;                         // force repaint
  }
  function cover(ctx, img, cw, ch){
    if(!img || !img.width) return;
    const s = Math.max(cw / img.width, ch / img.height);
    const w = img.width * s, h = img.height * s;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }
  function drawFrame(c, idx){
    const arr = frames[c.seq]; if(!arr) return;
    idx = clamp(idx, 0, arr.length - 1);
    if (idx === c.shown) return;
    const cw = c.cv.clientWidth, ch = c.cv.clientHeight;
    c.ctx.fillStyle = '#05070f'; c.ctx.fillRect(0, 0, cw, ch);
    cover(c.ctx, arr[idx], cw, ch);
    c.shown = idx;
  }

  // progress of a pinned chapter: 0 when its top hits viewport top, 1 at end
  function chapterProgress(section){
    const r = section.getBoundingClientRect();
    const scrollable = section.offsetHeight - window.innerHeight;
    return clamp(-r.top / scrollable, 0, 1);
  }

  /* ============================ REVEALS ================================= */
  function setReveals(section, p){
    section.querySelectorAll('[data-at]').forEach(el => {
      const at = parseFloat(el.dataset.at);
      el.classList.toggle('in', p >= at);
    });
  }

  /* combination counter */
  const comboNum = document.getElementById('combo-num');
  const comboCap = document.getElementById('combo-caption');
  const TARGET = 2285;
  const caps = [[0,'Same flacon. New closure. New bottle.'],
                [0.28,'Sprayers — gold, silver, black, colour, copper.'],
                [0.55,'Bulb atomizers. Droppers. Reducers.'],
                [0.78,'Antique bulb & tassel — the theatrical top.']];
  function setCounter(p){
    const n = Math.round(easeOut(clamp(p*1.05,0,1)) * TARGET);
    comboNum.textContent = n.toLocaleString('en-US');
    let label = caps[0][1];
    for (const [t,txt] of caps) if (p >= t) label = txt;
    if (comboCap.textContent !== label) comboCap.textContent = label;
  }

  /* light chapter lines */
  const lightLines = [...document.querySelectorAll('.light-line')];
  function setLight(p){
    lightLines.forEach((el, i) => {
      const center = (i + 0.5) / lightLines.length;
      el.classList.toggle('on', Math.abs(p - center) < 0.115);
    });
  }
  const closeSection = document.getElementById('c-close');

  /* ============================ REFRACTION (WebGL) ====================== */
  const Refraction = (() => {
    const cv = document.getElementById('refraction');
    let gl, prog, uProg, uTime, uRes, buf, ok = false, progress = 0;
    const FS = `precision highp float;
      uniform vec2 u_res; uniform float u_time; uniform float u_prog;
      // rainbow ramp
      vec3 spectral(float t){
        t = clamp(t,0.0,1.0);
        return 0.5 + 0.5*cos(6.2831*(vec3(0.0,0.33,0.67)+t));
      }
      float hash(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453); }
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
        float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
        return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
      }
      void main(){
        // y up, centred; product sits right-of-centre per the art direction
        vec2 p = (gl_FragCoord.xy - 0.5*u_res)/u_res.y;
        float t = u_time*0.3;
        vec3 col = vec3(0.02,0.027,0.059);            // navy void
        float bx = 0.20;                               // beam / prism column
        float prismY = 0.02;                           // the glass sits here
        float dx = p.x - bx;

        // 1 · hard white beam descending from top into the prism
        float beamW = 0.016 + 0.012*u_prog;
        float beam = smoothstep(beamW, 0.0, abs(dx)) * smoothstep(-prismY-0.02, 0.55, p.y);
        col += vec3(0.72,0.80,0.98) * beam * (0.55+0.45*u_prog);
        // beam soft halo
        col += vec3(0.30,0.40,0.62) * smoothstep(0.09,0.0,abs(dx)) * smoothstep(-prismY,0.6,p.y) * 0.25*u_prog;

        // 2 · the glass prism band — a bright refracting lozenge
        float prism = smoothstep(0.085,0.0,abs(dx)) * smoothstep(0.06,0.0,abs(p.y-prismY));
        col += vec3(0.85,0.92,1.0) * prism * (0.4+0.6*u_prog);

        // 3 · dispersed spectrum fanning DOWN from the prism
        float below = smoothstep(prismY, prismY-0.75, p.y);          // only under the glass
        float depth = clamp((prismY - p.y), 0.0, 1.0);
        float fanW = 0.03 + depth*0.55;                              // widens as it falls
        float within = smoothstep(fanW, fanW*0.2, abs(dx));
        // hue mapped across the fan (red one edge -> violet other), full spectrum
        float hue = 0.0 + (dx/ max(fanW,0.001))*0.5 + 0.5;
        // caustic ripple bands travelling down
        float ripple = 0.0;
        for(float i=0.0;i<3.0;i++){
          float n = noise(vec2(dx*10.0/(fanW+0.05), p.y*7.0 - t*(1.2+i*0.5) + i*3.0));
          ripple += smoothstep(0.5,0.95,n);
        }
        ripple/=3.0;
        float caust = within*below*(0.35+0.65*ripple)*(0.25+0.9*u_prog);
        col += spectral(hue) * caust * 1.5;

        // 4 · scattered caustic glints on the void floor
        float floorY = smoothstep(-0.34,-0.5,p.y);
        float gl = noise(vec2(p.x*7.0 - t*0.6, p.y*9.0))*noise(vec2(p.x*3.0+t*0.3,5.0));
        col += spectral(fract(p.x*0.7+0.2)) * smoothstep(0.75,1.0,gl) * floorY * 0.5 * u_prog;

        // vignette
        col *= 1.0 - 0.4*length(p*vec2(0.85,1.0));
        col = max(col, vec3(0.02,0.027,0.059));
        gl_FragColor = vec4(col,1.0);
      }`;
    const VS = `attribute vec2 a; void main(){ gl_Position = vec4(a,0.0,1.0); }`;
    function compile(type, src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); return s; }
    function init(){
      if(!cv) return;
      gl = cv.getContext('webgl') || cv.getContext('experimental-webgl');
      if(!gl){ ok=false; return; }
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){ ok=false; return; }
      gl.useProgram(prog);
      buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(prog,'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
      uProg=gl.getUniformLocation(prog,'u_prog'); uTime=gl.getUniformLocation(prog,'u_time'); uRes=gl.getUniformLocation(prog,'u_res');
      ok=true; resize();
    }
    function resize(){
      if(!ok) return;
      const dpr=Math.min(2,window.devicePixelRatio||1);
      cv.width=cv.clientWidth*dpr; cv.height=cv.clientHeight*dpr; gl.viewport(0,0,cv.width,cv.height);
    }
    function render(time){
      if(!ok) return;
      gl.uniform1f(uTime, time*0.001); gl.uniform1f(uProg, progress); gl.uniform2f(uRes, cv.width, cv.height);
      gl.drawArrays(gl.TRIANGLES,0,3);
    }
    // canvas2d fallback: animated spectral wash
    function render2d(time){
      const ctx = cv.getContext('2d'); const w=cv.clientWidth,h=cv.clientHeight;
      cv.width=w; cv.height=h;
      ctx.fillStyle='#05070f'; ctx.fillRect(0,0,w,h);
      const bx=w*0.66;
      const g=ctx.createLinearGradient(bx,0,bx,h);
      g.addColorStop(0,'rgba(200,210,240,'+(0.3+0.4*progress)+')');
      g.addColorStop(1,'rgba(200,210,240,0)');
      ctx.fillStyle=g; ctx.fillRect(bx-40,0,80,h);
      for(let i=0;i<6;i++){
        const t=time*0.0005+i;
        ctx.fillStyle=`hsla(${(i*50+time*0.03)%360},80%,62%,${0.10*progress})`;
        const y=h*0.5+Math.sin(t)*40;
        ctx.beginPath(); ctx.ellipse(bx+Math.cos(t)*140, y+120, 160, 40, 0, 0, 7); ctx.fill();
      }
    }
    return {
      init, resize,
      set progress(v){ progress = v; },
      get ok(){ return ok; },
      tick(time){ ok ? render(time) : render2d(time); }
    };
  })();
  window.__bbRefraction = Refraction;

  /* ============================ MAIN LOOP =============================== */
  const ST = {}; window.__bbScrollTrigger = ST;
  const lightSection = document.getElementById('c-light');
  const combSection = document.getElementById('c-comb');

  function tick(time){
    for (const c of chapters){
      const r = c.section.getBoundingClientRect();
      const visible = r.top < window.innerHeight && r.bottom > 0;
      if (!visible) continue;
      const p = chapterProgress(c.section);
      c.prog = p; ST[c.section.id] = p;
      const arr = frames[c.seq];
      if (arr){
        const targetIdx = p * (arr.length - 1);
        c.disp = lerp(c.disp, targetIdx, 0.18);           // frame lerp smoothing
        if (Math.abs(c.disp - targetIdx) < 0.05) c.disp = targetIdx;
        drawFrame(c, Math.round(c.disp));
      }
      setReveals(c.section, p);
    }
    // still chapters (no canvas) still need their reveals
    { const r = closeSection.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) setReveals(closeSection, chapterProgress(closeSection)); }
    // combinations counter
    { const r=combSection.getBoundingClientRect();
      if (r.top<window.innerHeight && r.bottom>0) setCounter(chapterProgress(combSection)); }
    // light chapter
    { const r=lightSection.getBoundingClientRect();
      const vis = r.top<window.innerHeight && r.bottom>0;
      if (vis){ const p=chapterProgress(lightSection); ST['c-light']=p; setLight(p); Refraction.progress=0.15+0.85*p; }
      Refraction.tick(time);
    }
    requestAnimationFrame(tick);
  }

  /* ============================ FALLBACK MODE ========================== */
  function enableFallback(){
    document.body.classList.add('use-fallback');
    document.querySelectorAll('video.fallback[data-seq]').forEach(v => {
      v.src = `media/${v.dataset.seq}.mp4`; v.load();
      const play = () => v.play().catch(()=>{});
      if ('IntersectionObserver' in window){
        new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? play() : v.pause()), {threshold:0.1}).observe(v);
      } else play();
    });
    // simple reveal-on-scroll for copy
    const io = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting) e.target.classList.add('in'); }), {threshold:0.3});
    document.querySelectorAll('[data-at],.reveal,.wordmark,.still .display,.light-line').forEach(el=>io.observe(el));
    document.querySelectorAll('.light-line').forEach(el=>el.classList.add('on'));
    // counter on scroll into combinations
    new IntersectionObserver(es=>es.forEach(e=>{
      if(e.isIntersecting){ let s=0; const iv=setInterval(()=>{ s+=0.04; setCounter(Math.min(1,s)); if(s>=1)clearInterval(iv); },24); }
    }),{threshold:0.4}).observe(combSection);
    Refraction.init();
    requestAnimationFrame(function f(t){ Refraction.progress=0.7; Refraction.tick(t); requestAnimationFrame(f); });
  }

  /* ============================ BOOT =================================== */
  function boot(){
    document.getElementById('nav').classList.add('in');
    if (FALLBACK){ enableFallback(); return; }
    chapters.forEach(sizeCanvas);
    Refraction.init();
    addEventListener('resize', () => { chapters.forEach(sizeCanvas); Refraction.resize(); });
    if (!reduce) Lenis.enable();
    // kick reveals for the first chapter, then run
    requestAnimationFrame(tick);
  }

  function finishLoad(){
    fill.style.width = '100%'; pct.textContent = '100';
    setTimeout(() => { loader.classList.add('done'); document.body.style.overflow=''; boot(); }, 350);
  }

  document.body.style.overflow = 'hidden';
  preload(
    frac => { const p = Math.round(frac*100); fill.style.width = p+'%'; pct.textContent = p; },
    finishLoad
  );
  // safety: never hang the loader
  setTimeout(() => { if(!loader.classList.contains('done')) finishLoad(); }, 12000);
})();
