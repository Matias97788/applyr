(function () {
  'use strict';

  const S = { source: 'resume', titles: [], mode: 'auto', notify: {}, aiTitleSuggestions: [] };
  let step = 0;
  const TITLES_STEP = 3;
  const view = document.getElementById('view');

  const STEPS = [
    () => `<h1>Antes de continuar, revisa estos términos</h1>
   <div class="card"><b>instaWork — Acuerdo de Usuario y Términos de Auto-Apply</b>
   <p class="hint">Versión: v1.0 · Actualizado: hoy<br>Al continuar, confirmas que has leído, entendido y aceptas este Acuerdo. Si no estás de acuerdo, no continúes.</p>
   <p style="font-size:13px"><b>1. Alcance.</b> Este Acuerdo regula Auto-Apply, que encuentra vacantes en plataformas de terceros (ATS/bolsas) y —según tus instrucciones— redacta y envía postulaciones usando modelos de lenguaje (LLMs).</p>
   <p style="font-size:13px"><b>2. Servicio automatizado; límites.</b> Auto-Apply opera con mejor esfuerzo usando datos que provees, plataformas de terceros y sistemas de IA. No garantizamos entrevistas ni ofertas.</p></div>
   <button class="btn primary" onclick="next()">Continuar a Auto Apply</button>`,
    () => {
      const isLi = S.source === 'linkedin';
      return `<h1>Sube tu CV</h1><p class="sub">Tu CV muestra a los empleadores tus habilidades y experiencia, y muchas veces decide si avanzas.</p>
   <span class="reuse">ⓘ Hazlo una vez. Lo reutilizamos en cada postulación.</span>
   <div class="segw"><div class="seg">
     <button class="on" onclick="setSource('resume')">Subir CV</button>
     <button disabled title="Disponible próximamente" style="opacity:.5;cursor:not-allowed">LinkedIn · Próximamente</button>
   </div></div>
   ${isLi
        ? `<div class="card"><label style="display:block;font-weight:600;font-size:13px;margin-bottom:6px">Pega tu URL de LinkedIn</label>
        <input type="url" id="linkedinUrl" data-k="linkedin" placeholder="https://www.linkedin.com/in/tu-perfil" value="${S.linkedin || ''}"/>
        <p class="hint" style="margin-top:8px">Guardamos tu perfil de LinkedIn para reutilizarlo en tus postulaciones.</p></div>
        <button class="btn primary" onclick="saveLinkedin()">Continuar →</button>`
        : `<input type="file" id="cvInput" accept=".pdf,.doc,.docx" style="display:none" onchange="handleCv(this)"/>
        <div class="card"><div class="drop ${S.cv ? 'filled' : ''}" onclick="document.getElementById('cvInput').click()">
          <div class="ic">${S.cv ? '✓' : '⤓'}</div><b>${S.cv ? S.cv : 'Haz clic para subir tu CV'}</b><small>${S.cvMsg || 'PDF, DOC o DOCX'}</small></div></div>
        ${S.cv ? '<button class="btn primary" onclick="next()">Continuar →</button>' : '<button class="btn skip" onclick="next()">Omitir por ahora</button>'}`
      }`;
    },
    () => {
      const my = step;
      setTimeout(() => { if (step === my) next(); }, 6000);
      const sk = (S.cvSkills || []);
      const body = sk.length
        ? '<b>Detectamos ' + sk.length + ' habilidades' + (S.cvArea ? ' · Área: ' + S.cvArea : '') + ' en tu CV:</b><div class="chips" style="margin-top:8px">' + sk.slice(0, 14).map(s => '<span class="chip">' + s + '</span>').join('') + '</div><p class="hint" style="margin-top:10px">Las usaremos para priorizar tus mejores coincidencias.</p>'
        : (S.cv ? '<b>CV recibido.</b><p class="hint" style="margin-top:6px">No pudimos extraer habilidades automáticamente (puede ser un PDF escaneado como imagen). Igual lo guardamos.</p>' : '<b>Sin CV.</b><p class="hint">Puedes subirlo luego desde Preferencias.</p>');
      return `<h1>Leyendo tu CV</h1><p class="sub">Extraemos la información clave de tu CV para priorizar tus postulaciones.</p>
   <div class="spin"></div><div class="card">${body}${S.cvChars ? ('<p class="hint" style="margin-top:8px">~' + S.cvChars + ' caracteres leídos.</p>') : ''}</div>`;
    },
    () => {
      const t = (S.titles && S.titles.length) ? S.titles : inferTitles(S.cvSkills || []);
      S.titles = t;
      const src = (S.cvSkills && S.cvSkills.length) ? 'a partir de tu CV' : 'sugeridos';
      return `<h1>¿Qué puestos buscas?</h1><p class="sub">Detectamos estos roles ${src}. Agrégalos, quítalos o escribe otros — la IA te sugiere opciones.</p>
   <div class="roles-step">
     <div class="roles-panel">
       <div class="roles-panel-head">
         <div class="roles-panel-copy">
           <strong>Tus puestos objetivo</strong>
           <span>Los roles que usaremos para buscar empleos</span>
         </div>
         <span class="title-count hidden" id="titleCount"></span>
         <span class="ai-badge"><span class="ai-badge-dot"></span> IA</span>
       </div>
       <div class="title-chip-box" id="titleChipBox">
         <div class="title-chips" id="titleChips"></div>
         <div class="title-input-wrap">
           <span class="title-input-icon" aria-hidden="true">${searchIconSvg()}</span>
           <input type="text" id="titleInput" placeholder="Buscar o escribir un puesto…" autocomplete="off"/>
           <button type="button" class="title-input-add" id="addTitleBtn" aria-label="Agregar puesto">Agregar</button>
           <div class="title-suggestions hidden" id="titleSuggestions"></div>
         </div>
       </div>
     </div>

     <div class="roles-suggest-panel">
       <div class="ai-suggest-head hidden" id="aiSuggestHead">
         <div>
           <span>Sugerencias para ti</span>
           <small>Basado en tu CV</small>
         </div>
       </div>
       <div class="ai-suggest-row" id="aiSuggestPills"></div>
       <p class="hint ai-status" id="aiSuggestStatus"><span class="ai-status-spin"></span> Generando sugerencias con IA…</p>
     </div>

     <div class="roles-country card">
       <label>País de búsqueda</label>
       <select id="paisBusqueda" data-k="pais_busqueda"><option${(!S.country || S.country === 'Chile') ? ' selected' : ''}>Chile</option><option${S.country === 'Argentina' ? ' selected' : ''}>Argentina</option><option${S.country === 'Perú' ? ' selected' : ''}>Perú</option><option${S.country === 'Colombia' ? ' selected' : ''}>Colombia</option><option${S.country === 'México' ? ' selected' : ''}>México</option><option${S.country === 'Remoto' ? ' selected' : ''}>Remoto</option></select>
     </div>
   </div>
   <button class="btn primary" onclick="saveTitles()">Continuar →</button>`;
    },
    () => `<h1>Sube una foto de perfil</h1><p class="sub">Algunas postulaciones pueden pedir una foto de perfil. Sube una imagen clara en formato PNG, JPG o JPEG.</p>
   <input type="file" id="photoInput" accept="image/*" style="display:none" onchange="handlePhoto(this)"/>
   <div class="card"><div class="drop ${S.photo ? 'filled' : ''}" onclick="document.getElementById('photoInput').click()"><div class="ic">${S.photo ? '✓' : '👤'}</div><b>${S.photo ? S.photo : 'Haz clic para subir'}</b><small>${S.photo ? 'Foto cargada' : 'PNG, JPG, JPEG'}</small></div></div>
   <button class="btn primary" onclick="next()">Continuar →</button><button class="btn skip" onclick="next()">Omitir</button>`,
    () => `<h1>¿Cuáles son tus datos personales?</h1><p class="sub">Usamos esta información para emparejarte con empleos y para que los empleadores te contacten.</p>
   <span class="reuse">ⓘ Hazlo una vez. Lo reutilizamos en cada postulación.</span>
   <div class="card">
     <label>¿Cuál es tu nombre completo?</label><input type="text" id="fullname" placeholder="Nombre y apellidos"/>
     <label>URL de LinkedIn</label><input type="url" id="linkedin" placeholder="www.linkedin.com/in/tu-perfil"/>
     <label>Teléfono</label><input type="tel" id="phone" placeholder="+56 9 ..."/>
     <label>¿Cuándo naciste?</label><input type="date" id="dob"/>
   </div><button class="btn primary" onclick="next()">Continuar →</button>`,
    () => `<h1>¿Dónde vives?</h1><p class="sub">Es tu dirección de residencia, requerida para postulaciones y registros. NO se usará para influir en tus preferencias de búsqueda.</p>
   <div class="card"><label>Dirección</label><input type="text" id="address" placeholder="Calle y número"/>
     <label>Ciudad</label><input type="text" id="city" placeholder="Ciudad"/>
     <label>País</label><select id="pais" data-k="pais"><option>Chile</option><option>Argentina</option><option>Perú</option><option>Colombia</option><option>México</option></select>
     <label>Código postal</label><input type="text" id="zip" placeholder="10001"/>
   </div><button class="btn primary" onclick="next()">Continuar →</button>`,
    () => `<h1>Cuéntanos sobre tu experiencia</h1><p class="sub">Estos datos de tu CV nos ayudan a referenciar tu perfil en las postulaciones.</p>
   <div class="card"><div class="top" style="display:flex;justify-content:space-between"><b>Experiencia <span class="hint">(Opcional)</span></b><button class="addbtn">+ Agregar</button></div></div>
   <div class="card" style="margin-top:12px"><div class="top" style="display:flex;justify-content:space-between"><b>Educación <span class="hint">(Opcional)</span></b><button class="addbtn">+ Agregar</button></div></div>
   <div class="card" style="margin-top:12px"><div class="top" style="display:flex;justify-content:space-between"><b>Habilidades <span class="hint">(Opcional)</span></b><button class="addbtn">+ Agregar</button></div></div>
   <button class="btn primary" onclick="next()">Continuar →</button>`,
    () => `<h1>¿Tienes referencias de empleadores anteriores?</h1><p class="sub">Agregar referencias profesionales ayuda a los empleadores a verificar tu experiencia y mejora tu postulación.</p>
   <div class="card"><div class="top" style="display:flex;justify-content:space-between"><b>Referencias profesionales <span class="hint">(Opcional)</span></b><button class="addbtn">+ Agregar</button></div></div>
   <button class="btn primary" onclick="next()">Continuar →</button><button class="btn skip" onclick="next()">Omitir</button>`,
    () => `<h1>¿Quieres excluir ciertas empresas?</h1><p class="sub">Indica las empresas que quieres excluir de tus resultados de búsqueda.</p>
   <div class="card"><label>Nombre de la empresa <span class="count">0/5</span></label><input type="text" id="exclude" placeholder='Por ejemplo "Google"'/>
   <p class="hint" style="margin-top:10px">Los empleos de las empresas excluidas no aparecerán en tu búsqueda.</p></div>
   <button class="btn primary" onclick="next()">Continuar →</button><button class="btn skip" onclick="next()">Omitir</button>`,
    () => `<h1>Cuéntanos sobre ti</h1><p class="sub">Pedimos tu etnia, nacionalidad y género para promover una contratación inclusiva y mejores coincidencias.</p>
   <span class="reuse">ⓘ Hazlo una vez. Lo reutilizamos en cada postulación.</span>
   <div class="card">
     <label>¿Qué describe mejor tu raza o etnia?</label>
     <select id="etnia" data-k="etnia"><option>Prefiero no decir</option><option>Latino/Hispano</option><option>Mestizo</option><option>Blanco</option><option>Afrodescendiente</option><option>Indígena / Pueblos originarios</option><option>Asiático</option><option>Medio Oriente / Norte de África</option><option>Otra</option></select>
     <label>¿Cuál es tu nacionalidad?</label>
     <select id="nacionalidad" data-k="nacionalidad"><option>Prefiero no decir</option><option>Chilena</option><option>Argentina</option><option>Peruana</option><option>Colombiana</option><option>Venezolana</option><option>Boliviana</option><option>Ecuatoriana</option><option>Mexicana</option><option>Española</option><option>Otra</option></select>
     <label>¿Cómo describirías tu orientación sexual?</label>
     <select id="orientacion" data-k="orientacion"><option>Prefiero no entregar esta información</option><option>Heterosexual</option><option>Homosexual (gay/lesbiana)</option><option>Bisexual</option><option>Otra</option></select>
     <label>¿Te identificas como transgénero?</label>
     <select id="transgenero" data-k="transgenero"><option>Prefiero no entregar esta información</option><option>No</option><option>Sí</option></select>
   </div><button class="btn primary" onclick="next()">Continuar →</button>`,
    () => `<h1>Crea tu bandeja de Auto Apply</h1><p class="sub">Una bandeja dedicada nos deja gestionar tu búsqueda de punta a punta mientras tu correo personal queda limpio.</p>
   <div class="tiles">
     <div class="tile"><div class="ic">🛡</div><b>Anti-spam</b><small>Bloquea estafas</small></div>
     <div class="tile"><div class="ic">▤</div><b>Auto-orden</b><small>Clasifica cada correo</small></div>
     <div class="tile"><div class="ic">🤖</div><b>Sin manos</b><small>Maneja códigos OTP</small></div>
     <div class="tile"><div class="ic">🔔</div><b>Notificado</b><small>Updates clave a tu correo</small></div>
   </div>
   <div class="card"><div class="top" style="display:flex;justify-content:space-between"><b>Notificarme en mi correo personal</b><span>🟣</span></div>
   <div class="chips">${['Invitaciones a entrevista', 'Ofertas y contrataciones', 'Seguimientos de entrevista', 'Invitaciones a assessment', 'Resultados de assessment', 'Confirmaciones de postulación', 'Rechazos', 'Formularios de igualdad', 'Otros updates'].map(c => `<span class="chip">${c}</span>`).join('')}</div></div>
   <button class="btn primary" onclick="next()">Guardar y continuar</button>`,
    () => `<h1>¿Cómo debemos postular por ti?</h1>
   <div class="card">
     ${modeCard('hybrid', 'Modo Híbrido', 'Lo mejor de ambos', 'Mejor equilibrio entre velocidad y control. Auto-postulamos a roles de alto match (75%+). Tú decides el resto.')}
     ${modeCard('auto', 'Modo Auto', 'Ahorra tiempo, sin aprobación', 'Totalmente sin manos. Máxima velocidad. Nuestro agente encuentra y postula por ti.')}
     ${modeCard('review', 'Modo Revisión', 'Aprueba cada empleo', 'Control total. Nada se envía sin tu aprobación. Revisa cada coincidencia.')}
   </div><button class="btn primary" onclick="genKit()">Continuar →</button>`,
    () => {
      genAnim();
      return `<h1>Generando tu kit de postulación</h1><p class="sub">Esto suele tardar unos segundos</p>
   <div class="card"><div class="spin"></div><div class="tasklist" id="genlist">
     <div id="g0">◦ Generando carta de presentación</div><div id="g1">◦ Generando CV</div>
     <div id="g2">◦ Generando email de seguimiento</div><div id="g3">◦ Buscando empleos que coinciden</div>
   </div><p class="hint" style="text-align:center">🛡 Tus datos se procesan de forma segura.</p></div>`;
    },
    () => `<div class="check">✓</div><h1>¡Todo listo!</h1><p class="sub">Tu Auto-Apply está activo. Empezamos a buscar empleos para ti de inmediato.</p>
   <div class="card"><b>Tu búsqueda ya está corriendo</b><div class="tasklist">
     <div class="done"><b class="b">Ahora ·</b> Revisión de perfil</div><div>~10 min · Primeras postulaciones</div><div>3–5 días · Respuestas en tu bandeja</div>
   </div><p class="hint">Buscamos empleos frescos en ATS (Greenhouse, Ashby, Lever) + GetOnBoard (CL) donde eres top match.</p></div>
   <button class="btn primary" onclick="goDash()">Ir a mi tablero →</button>`
  ];

  function modeCard(id, t, tag, desc) {
    return `<div class="modecard ${S.mode === id ? 'on' : ''}" onclick="setMode('${id}')"><div class="rd"></div><div class="t">${t} <span class="tag">${tag}</span></div><p>${desc}</p></div>`;
  }

  window.setMode = function (m) { S.mode = m; render(); };
  window.setSource = function (s) { S.source = s; render(); };

  function inferTitles(skills) {
    try {
      if (window.InstaWorkAnalyzer) {
        const t = window.InstaWorkAnalyzer.inferTitles(skills || [], S.cvText || '');
        if (t && t.length) return t.slice(0, 6);
      }
    } catch (e) {}
    const s = (skills || []).map(x => x.toLowerCase());
    const has = (...k) => k.some(x => s.includes(x));
    const t = [];
    if (has('react', 'vue', 'angular', 'javascript', 'typescript')) t.push('Frontend Developer');
    if (has('node', 'python', 'java', 'php')) t.push('Backend Developer');
    if (!t.length) t.push('Profesional', 'Analista', 'Asistente');
    return [...new Set(t)].slice(0, 6);
  }

  window.saveTitles = function () {
    syncTitlesFromDom();
    if (!S.titles.length) S.titles = ['Developer'];
    const p = document.getElementById('paisBusqueda');
    S.country = (p && p.value) || 'Chile';
    try { InstaWorkEngine.setPreferences({ titles: S.titles, country: S.country, remote: true }); } catch (e) {}
    next();
  };

  function escHtml(s) {
    return (s || '').toString().replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function syncTitlesFromDom() {
    const pending = (document.getElementById('titleInput')?.value || '').trim();
    if (pending) addTitle(pending);
  }

  function addTitle(title) {
    const t = (title || '').trim();
    if (!t) return;
    const exists = S.titles.some((x) => x.toLowerCase() === t.toLowerCase());
    if (exists) return;
    S.titles.push(t);
    renderTitleChips();
    const input = document.getElementById('titleInput');
    if (input) input.value = '';
    updateTitleSuggestions('');
    renderAiPills();
    persist();
  }

  function removeTitle(index) {
    S.titles.splice(index, 1);
    renderTitleChips();
    updateTitleSuggestions(document.getElementById('titleInput')?.value || '');
    renderAiPills();
    persist();
  }

  function searchIconSvg() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  function chipIconSvg(variant) {
    const icons = {
      tech: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M8 9l-3 3 3 3M16 9l3 3-3 3M14 4l-4 16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      cms: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" stroke="currentColor" stroke-width="2"/></svg>',
      design: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>',
      growth: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 18h16M7 14l3-4 3 2 4-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      default: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="4" y="7" width="16" height="12" rx="2" stroke="currentColor" stroke-width="2"/><path d="M9 7V5a2 2 0 014 0v2" stroke="currentColor" stroke-width="2"/></svg>'
    };
    return icons[variant] || icons.default;
  }

  function chipMeta(t) {
    const low = (t || '').toLowerCase();
    if (/wordpress|woocommerce|shopify|cms|web\b/.test(low)) {
      return { variant: 'cms' };
    }
    if (/ux|ui|diseñ|design|figma/.test(low)) {
      return { variant: 'design' };
    }
    if (/ingenier|software|developer|desarroll|program|frontend|backend|full.?stack|devops|data|qa|sre/.test(low)) {
      return { variant: 'tech' };
    }
    if (/marketing|seo|sem|growth|content/.test(low)) {
      return { variant: 'growth' };
    }
    return { variant: 'default' };
  }

  function formatTitle(t) {
    const raw = (t || '').trim();
    const low = raw.toLowerCase();
    const special = {
      wordpress: 'WordPress', woocommerce: 'WooCommerce', shopify: 'Shopify',
      javascript: 'JavaScript', typescript: 'TypeScript', 'node.js': 'Node.js',
      ux: 'UX', ui: 'UI', seo: 'SEO', sem: 'SEM', api: 'API'
    };
    if (special[low]) return special[low];
    return low.replace(/\b([a-záéíóúñ]+)\b/g, (w, word, offset) => {
      if (offset > 0 && ['de', 'del', 'y', 'en', 'la', 'el'].includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
  }

  function renderTitleChips() {
    const el = document.getElementById('titleChips');
    const box = document.getElementById('titleChipBox');
    const countEl = document.getElementById('titleCount');
    if (!el) return;
    if (countEl) {
      countEl.textContent = S.titles.length ? `${S.titles.length} rol${S.titles.length === 1 ? '' : 'es'}` : '';
      countEl.classList.toggle('hidden', !S.titles.length);
    }
    if (!S.titles.length) {
      el.innerHTML = '<div class="title-chips-empty"><span class="title-chips-empty-icon">✦</span><div><strong>Sin puestos aún</strong><p>Agrega roles desde las sugerencias o escribe uno abajo.</p></div></div>';
      box?.classList.add('is-empty');
      return;
    }
    box?.classList.remove('is-empty');
    el.innerHTML = S.titles.map((t, i) => {
      const meta = chipMeta(t);
      return `<span class="title-chip title-chip--${meta.variant}" style="animation-delay:${i * 50}ms">
        <span class="title-chip-accent" aria-hidden="true"></span>
        <span class="title-chip-icon">${chipIconSvg(meta.variant)}</span>
        <span class="title-chip-text">${escHtml(formatTitle(t))}</span>
        <button type="button" class="title-chip-x" data-i="${i}" aria-label="Quitar ${escHtml(t)}">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </span>`;
    }).join('');
  }

  function renderAiPills() {
    const el = document.getElementById('aiSuggestPills');
    const head = document.getElementById('aiSuggestHead');
    if (!el) return;
    const selected = new Set(S.titles.map((x) => x.toLowerCase()));
    const pills = (S.aiTitleSuggestions || []).filter((t) => !selected.has(t.toLowerCase())).slice(0, 6);
    if (head) head.classList.toggle('hidden', !pills.length);
    el.innerHTML = pills.map((t, i) =>
      `<button type="button" class="ai-suggest-pill" data-idx="${i}">
        <span class="ai-suggest-plus">+</span>
        <span class="ai-suggest-label">${escHtml(formatTitle(t))}</span>
      </button>`
    ).join('');
  }

  function updateTitleSuggestions(query) {
    const box = document.getElementById('titleSuggestions');
    if (!box || !window.InstaWorkAITitles) return;
    const list = window.InstaWorkAITitles.filterSuggestions(query, S.aiTitleSuggestions, S.titles);
    box._suggestList = list;
    if (!list.length) {
      box.classList.add('hidden');
      box.innerHTML = '';
      return;
    }
    box.classList.remove('hidden');
    box.innerHTML = list.map((t, i) =>
      `<button type="button" class="title-suggestion${i === 0 ? ' active' : ''}" data-idx="${i}">${escHtml(formatTitle(t))}</button>`
    ).join('');
  }

  function initTitlesStep() {
    renderTitleChips();

    const input = document.getElementById('titleInput');
    const statusEl = document.getElementById('aiSuggestStatus');
    const chipsEl = document.getElementById('titleChips');
    const pillsEl = document.getElementById('aiSuggestPills');
    const suggestionsEl = document.getElementById('titleSuggestions');

    if (!input || !statusEl) return;

    const loadSuggestions = () => {
      const ai = window.InstaWorkAITitles;
      if (!ai) {
        S.aiTitleSuggestions = inferTitles(S.cvSkills || []);
        statusEl.textContent = 'Sugerencias basadas en tu perfil.';
        renderAiPills();
        return;
      }

      let profile = {};
      try { profile = InstaWorkEngine.getProfile() || {}; } catch (e) {}

      ai.suggestJobTitles({
        skills: S.cvSkills || [],
        cvText: S.cvText || '',
        country: S.country || 'Chile',
        profile
      }).then((list) => {
        S.aiTitleSuggestions = list;
        if (!S.titles.length && list.length) {
          S.titles = list.slice(0, 4);
          renderTitleChips();
        }
        statusEl.innerHTML = '✨ <b>Sugerencias listas.</b> Haz clic para agregar roles recomendados según tu CV.';
        renderAiPills();
        updateTitleSuggestions(input.value);
        persist();
      }).catch(() => {
        S.aiTitleSuggestions = ai.fallbackTitleSuggestions(S.cvSkills || [], S.cvText || '');
        statusEl.textContent = 'Sugerencias basadas en tu perfil.';
        renderAiPills();
      });
    };

    loadSuggestions();

    input.addEventListener('input', () => updateTitleSuggestions(input.value));
    input.addEventListener('focus', () => updateTitleSuggestions(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTitle(input.value);
      }
      if (e.key === 'Escape') suggestionsEl?.classList.add('hidden');
    });

    document.getElementById('addTitleBtn')?.addEventListener('click', () => addTitle(input.value));

    chipsEl?.addEventListener('click', (e) => {
      const btn = e.target.closest('.title-chip-x');
      if (btn) removeTitle(+btn.dataset.i);
    });

    suggestionsEl?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-idx]');
      if (btn && suggestionsEl._suggestList) addTitle(suggestionsEl._suggestList[+btn.dataset.idx]);
    });

    pillsEl?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-idx]');
      if (btn) {
        const selected = new Set(S.titles.map((x) => x.toLowerCase()));
        const pill = (S.aiTitleSuggestions || []).filter((t) => !selected.has(t.toLowerCase()))[+btn.dataset.idx];
        if (pill) addTitle(pill);
      }
    });
  }

  function persist() {
    try { localStorage.setItem('instawork_wizard', JSON.stringify({ S, step, loggedIn: true })); } catch (e) {}
  }

  function restore() {
    try {
      const w = JSON.parse(localStorage.getItem('instawork_wizard'));
      if (w && w.S) {
        Object.assign(S, w.S);
        step = (typeof w.step === 'number') ? w.step : 0;
        return true;
      }
    } catch (e) {}
    return false;
  }

  window.saveLinkedin = function () {
    const el = document.getElementById('linkedinUrl');
    const v = (el && el.value || '').trim();
    if (v && !/linkedin\.com/i.test(v)) {
      alert('Pega una URL válida de LinkedIn (linkedin.com/in/...)');
      return;
    }
    if (v) {
      S.linkedin = v;
      try { InstaWorkEngine.setProfile({ linkedin: v }); } catch (e) {}
    }
    next();
  };

  window.handlePhoto = function (input) {
    const f = input.files && input.files[0];
    if (f) {
      S.photo = f.name;
      try { InstaWorkEngine.setProfile({ photoName: f.name }); } catch (e) {}
      render();
    }
  };

  const SKILL_DICT = ['javascript', 'typescript', 'react', 'vue', 'angular', 'node.js', 'node', 'python', 'java', 'php', 'laravel', 'wordpress', 'shopify', 'woocommerce', 'sql', 'postgresql', 'mysql', 'mongodb', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'git', 'html', 'css', 'tailwind', 'bootstrap', 'django', 'flask', 'fastapi', 'spring', '.net', 'c#', 'c++', 'golang', 'go', 'rust', 'kotlin', 'swift', 'flutter', 'react native', 'figma', 'ux', 'ui', 'seo', 'sem', 'google analytics', 'google ads', 'meta ads', 'excel', 'power bi', 'tableau', 'scrum', 'agile', 'jira', 'notion', 'marketing', 'ventas', 'contabilidad', 'photoshop', 'illustrator', 'autocad', 'salesforce', 'hubspot'];

  function extractSkills(t) {
    try {
      if (window.InstaWorkAnalyzer) return window.InstaWorkAnalyzer.detectSkills(t).map(x => x.name);
    } catch (e) {}
    const low = (t || '').toLowerCase();
    const out = [];
    SKILL_DICT.forEach(s => { if (low.includes(s) && !out.includes(s)) out.push(s); });
    return out;
  }

  window.handleCv = async function (input) {
    const f = input.files && input.files[0];
    if (!f) return;
    S.cv = f.name;
    S.cvMsg = 'Leyendo…';
    render();
    let text = '';
    try {
      if (/\.pdf$/i.test(f.name) && window.pdfjsLib) {
        const buf = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const n = Math.min(pdf.numPages, 8);
        for (let i = 1; i <= n; i++) {
          const pg = await pdf.getPage(i);
          const tc = await pg.getTextContent();
          text += ' ' + tc.items.map(x => x.str).join(' ');
        }
      } else {
        try { text = await f.text(); } catch (e) { text = ''; }
      }
    } catch (e) { text = ''; }
    const skills = extractSkills(text);
    S.cvText = (text || '').slice(0, 8000);
    try {
      if (window.InstaWorkAnalyzer) {
        const a = window.InstaWorkAnalyzer.analyze(text || '');
        S.cvArea = a.areaLabel || null;
        S.cvRoles = a.titles || [];
        if ((!S.titles || !S.titles.length) && a.titles && a.titles.length) S.titles = a.titles.slice(0, 4);
      }
    } catch (e) {}
    S.cvSkills = skills;
    S.cvChars = (text || '').length;
    S.cvMsg = 'Leído ✓';
    try {
      InstaWorkEngine.setProfile({ cvName: f.name, cvSkills: skills, cvChars: S.cvChars });
      if (skills.length) InstaWorkEngine.setPreferences({ skills });
    } catch (e) {}
    render();
  };

  function genAnim() {
    const my = step;
    [0, 1, 2, 3].forEach(i => setTimeout(() => {
      const e = document.getElementById('g' + i);
      if (e) {
        e.innerHTML = e.innerHTML.replace('◦', '<span class="b">✓</span>');
        e.classList.add('done');
      }
    }, 600 * (i + 1)));
    setTimeout(() => { if (step === my) next(); }, 3000);
  }

  function captureCurrent() {
    const data = {};
    view.querySelectorAll('input,select,textarea').forEach(el => {
      if (el.type === 'file' || !el.value) return;
      const k = el.id || el.getAttribute('data-k');
      if (k) data[k] = el.value;
    });
    if (Object.keys(data).length) {
      S.form = { ...(S.form || {}), ...data };
      try { InstaWorkEngine.setProfile(data); } catch (e) {}
    }
  }

  function render() {
    view.innerHTML = STEPS[step]();
    if (S.form) {
      view.querySelectorAll('input,select,textarea').forEach(el => {
        if (el.type === 'file' || el.value) return;
        const k = el.id || el.getAttribute('data-k');
        if (k && S.form[k] != null) el.value = S.form[k];
      });
    }
    document.getElementById('bar').style.width = Math.round((step / (STEPS.length - 1)) * 100) + '%';
    document.getElementById('saved').textContent = 'Guardado hace instantes';
    persist();
    window.scrollTo(0, 0);
    if (step === TITLES_STEP) initTitlesStep();
  }

  window.next = function () {
    captureCurrent();
    if (step < STEPS.length - 1) { step++; render(); }
  };

  window.prev = function () {
    captureCurrent();
    if (step > 0) { step--; render(); }
    else { window.location.replace('/'); }
  };

  window.genKit = async function () {
    captureCurrent();
    const titles = (S.titles && S.titles.length) ? S.titles : ['Developer', 'Ingeniero de Software'];
    const skills = (S.cvSkills || []);
    next();
    try {
      InstaWorkEngine.setPreferences({ titles, country: (S.country || 'Chile'), remote: true, skills });
      InstaWorkEngine.setMode(S.mode);
      await InstaWorkEngine.search();
    } catch (e) {}
  };

  window.goDash = function () {
    try {
      const uid = InstaWorkEngine.getProfile().uid;
      if (uid) localStorage.setItem('instawork_done_' + uid, '1');
      else localStorage.setItem('instawork_done', '1');
    } catch (e) {}
    window.location.replace('dashboard.html');
  };

  document.addEventListener('click', e => {
    const chip = e.target.closest('#view .chip');
    if (chip) chip.classList.toggle('off');
    const add = e.target.closest('.addbtn');
    if (add) {
      e.preventDefault();
      const card = add.closest('.card');
      if (card) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.placeholder = 'Escribe aquí…';
        inp.style.cssText = 'width:100%;margin-top:8px';
        card.appendChild(inp);
        inp.focus();
      }
    }
  });

  restore();
  prefillFromProfile();
  render();

  function prefillFromProfile() {
    try {
      const p = InstaWorkEngine.getProfile();
      if (!p) return;
      S.form = S.form || {};
      if (p.fullname && !S.form.fullname) S.form.fullname = p.fullname;
      if (p.email && !S.form.email) S.form.email = p.email;
      if (p.linkedin && !S.form.linkedin) S.form.linkedin = p.linkedin;
    } catch (e) {}
  }
})();
