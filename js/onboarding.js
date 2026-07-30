(function () {
  'use strict';

  const FLOW = window.OnboardingFlow;
  if (!FLOW) { console.error('OnboardingFlow no cargado'); return; }

  const S = {
    source: 'resume', titles: [], mode: 'auto', notify: {},
    aiTitleSuggestions: [], answers: {}, form: {}
  };
  let stepIdx = 0;
  const view = document.getElementById('view');

  /* ── helpers ── */
  function esc(s) {
    return (s || '').toString().replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function activeSteps() {
    return FLOW.STEPS.filter(st => !st.show || st.show(S));
  }

  function currentStep() { return activeSteps()[stepIdx]; }

  function sectionLabel(id) {
    const s = FLOW.SECTIONS.find(x => x.id === id);
    return s ? s.label : '';
  }

  function sectionProgress() {
    const steps = activeSteps();
    const cur = steps[stepIdx];
    if (!cur) return { segments: [], current: 0, label: '' };
    const sectionIds = [...new Set(steps.map(s => s.section))];
    const segIdx = sectionIds.indexOf(cur.section);
    const segSteps = steps.filter(s => s.section === cur.section);
    const posInSeg = segSteps.findIndex(s => s.id === cur.id);
    return {
      segments: sectionIds.length,
      current: segIdx,
      posInSeg,
      segTotal: segSteps.length,
      label: sectionLabel(cur.section)
    };
  }

  function renderProgress() {
    const p = sectionProgress();
    let html = '<div class="wiz-segments">';
    for (let i = 0; i < p.segments; i++) {
      const done = i < p.current;
      const active = i === p.current;
      const fill = active ? Math.round(((p.posInSeg + 1) / p.segTotal) * 100) : (done ? 100 : 0);
      html += `<div class="wiz-seg${done ? ' done' : ''}${active ? ' active' : ''}"><i style="width:${fill}%"></i>${done ? '<span class="wiz-check">✓</span>' : ''}</div>`;
    }
    html += '</div>';
    if (p.label) html += `<p class="wiz-section-label">${esc(p.label)}</p>`;
    return html;
  }

  function getVal(key) {
    if (key === 'titles') return S.titles;
    return S.answers[key];
  }

  function setVal(key, val) {
    if (key === 'titles') { S.titles = val; return; }
    S.answers[key] = val;
  }

  function isSelected(key, v) {
    const val = getVal(key);
    if (Array.isArray(val)) return val.includes(v);
    return val === v;
  }

  function toggleMulti(key, v) {
    let arr = getVal(key) || [];
    if (!Array.isArray(arr)) arr = [];
    const i = arr.indexOf(v);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(v);
    setVal(key, arr);
    render();
  }

  function selectSingle(key, v) {
    setVal(key, v);
    render();
  }

  function showError(msg) {
    let el = document.getElementById('wizError');
    if (!el) {
      el = document.createElement('p');
      el.id = 'wizError';
      el.className = 'wiz-error';
      const main = document.getElementById('view');
      if (main) main.insertAdjacentElement('afterbegin', el);
    }
    el.textContent = msg;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearError() {
    const el = document.getElementById('wizError');
    if (el) el.remove();
  }

  /* ── validation ── */
  function validateStep(st) {
    if (!st) return null;
    if (st.type === 'info' || st.type === 'matching' || st.type === 'custom-generating' || st.type === 'custom-done') return null;
    if (st.type === 'custom-cv-reading') return null;

    if (st.type === 'custom-terms') return null;

    if (st.type === 'custom-cv') {
      if (!S.cv && S.source === 'resume') return 'Sube tu CV o haz clic en "Omitir por ahora" para continuar.';
      if (S.source === 'linkedin') {
        const v = (document.getElementById('linkedinUrl')?.value || '').trim();
        if (!v) return 'Pega tu URL de LinkedIn para continuar.';
        if (!/linkedin\.com/i.test(v)) return 'Pega una URL válida de LinkedIn (linkedin.com/in/...).';
      }
      return null;
    }

    if (st.type === 'custom-titles') {
      syncTitlesFromDom();
      if (!S.titles.length) return 'Agrega al menos un puesto objetivo para continuar.';
      return null;
    }

    if (st.type === 'custom-personal') {
      const fullname = (document.getElementById('fullname')?.value || '').trim();
      const phone = (document.getElementById('phone')?.value || '').trim();
      const dob = (document.getElementById('dob')?.value || '').trim();
      if (!fullname) return 'Ingresa tu nombre completo.';
      if (!phone) return 'Ingresa tu número de teléfono.';
      if (!dob) return 'Ingresa tu fecha de nacimiento.';
      return null;
    }

    if (st.type === 'custom-address') {
      const address = (document.getElementById('address')?.value || '').trim();
      const city = (document.getElementById('city')?.value || '').trim();
      const zip = (document.getElementById('zip')?.value || '').trim();
      if (!address) return 'Ingresa tu dirección.';
      if (!city) return 'Ingresa tu ciudad.';
      if (!zip) return 'Ingresa tu código postal.';
      return null;
    }

    if (st.type === 'custom-photo' || st.type === 'custom-experience' ||
        st.type === 'custom-references' || st.type === 'custom-exclude' ||
        st.type === 'custom-demographics' || st.type === 'custom-inbox') return null;

    if (st.type === 'slider') {
      const v = getVal(st.key);
      if (v == null && st.required) return 'Selecciona un salario mínimo.';
      return null;
    }

    if (st.type === 'auth') {
      const status = (document.getElementById('workAuthStatus')?.value || '').trim();
      if (!status || status === '') return 'Selecciona tu estado de autorización de trabajo.';
      return null;
    }

    if (st.type === 'locations') {
      const arr = getVal(st.key) || [];
      const min = st.min || 1;
      if (arr.length < min) return `Selecciona al menos ${min} ubicación${min > 1 ? 'es' : ''}.`;
      return null;
    }

    if (st.type === 'yesno') {
      if (st.required && getVal(st.key) == null) return 'Selecciona Sí o No para continuar.';
      return null;
    }

    if (st.type === 'single') {
      if (st.required && !getVal(st.key)) return 'Selecciona una opción para continuar.';
      return null;
    }

    if (st.type === 'multi') {
      const arr = getVal(st.key) || [];
      const min = st.min || 1;
      if (st.required && arr.length < min) return `Selecciona al menos ${min} opción${min > 1 ? 'es' : ''}.`;
      return null;
    }

    return null;
  }

  /* ── renderers by type ── */
  function renderInfo(st) {
    let body = '';
    if (st.icon) body += `<div class="info-icon">${st.icon}</div>`;
    if (st.body) body += st.body;
    if (st.bullets) {
      body += '<ul class="info-bullets">' + st.bullets.map(b => `<li>${esc(b)}</li>`).join('') + '</ul>';
    }
    return `${renderProgress()}<h1>${esc(st.title)}</h1>${st.subtitle ? `<p class="sub">${esc(st.subtitle)}</p>` : ''}${body ? `<div class="card info-card">${body}</div>` : ''}<button class="btn primary" onclick="wizNext()">Continuar</button>`;
  }

  function renderSingle(st) {
    const sel = getVal(st.key);
    const opts = (st.options || []).map(o => {
      const on = sel === o.v ? ' on' : '';
      const tag = o.tag ? `<span class="opt-tag">${esc(o.tag)}</span>` : '';
      const desc = o.d ? `<small>${esc(o.d)}</small>` : '';
      return `<button type="button" class="opt-card${on}" onclick="wizSelect('${st.key}','${o.v}')"><span class="opt-rd"></span><div><b>${esc(o.t)}</b>${tag}${desc}</div></button>`;
    }).join('');
    const disabled = !sel ? ' disabled' : '';
    return `${renderProgress()}<h1>${esc(st.title)}</h1>${st.subtitle ? `<p class="sub">${esc(st.subtitle)}</p>` : ''}<div class="opt-list">${opts}</div><button class="btn primary${disabled}" onclick="wizNext()"${disabled ? ' disabled' : ''}>Continuar</button>`;
  }

  function renderMulti(st) {
    const arr = getVal(st.key) || [];
    const opts = (st.options || []).map(o => {
      const on = arr.includes(o.v) ? ' on' : '';
      return `<button type="button" class="opt-card check${on}" onclick="wizToggle('${st.key}','${o.v}')"><span class="opt-chk">${on ? '✓' : ''}</span><b>${esc(o.t)}</b></button>`;
    }).join('');
    const min = st.min || 1;
    const disabled = arr.length < min ? ' disabled' : '';
    return `${renderProgress()}<h1>${esc(st.title)}</h1>${st.subtitle ? `<p class="sub">${esc(st.subtitle)}</p>` : ''}<div class="opt-list">${opts}</div><button class="btn primary${disabled}" onclick="wizNext()"${disabled ? ' disabled' : ''}>Continuar</button>`;
  }

  function renderYesNo(st) {
    const val = getVal(st.key);
    return `${renderProgress()}<h1>${esc(st.title)}</h1>
      <div class="card statement-card"><p>"${esc(st.statement)}"</p></div>
      <div class="yn-row">
        <button type="button" class="yn-btn${val === false ? ' on' : ''}" onclick="wizYesNo('${st.key}',false)">No</button>
        <button type="button" class="yn-btn${val === true ? ' on' : ''}" onclick="wizYesNo('${st.key}',true)">Sí</button>
      </div>`;
  }

  function renderSlider(st) {
    const v = getVal(st.key) ?? st.default ?? st.min;
    const pct = ((v - st.min) / (st.max - st.min)) * 100;
    const fmt = st.format ? st.format(v) : v;
    return `${renderProgress()}<h1>${esc(st.title)}</h1>
      <div class="card slider-card">
        <div class="slider-val">${esc(fmt)}</div>
        <input type="range" id="salarySlider" min="${st.min}" max="${st.max}" step="${st.step || 1000}" value="${v}"
          style="--pct:${pct}%" oninput="wizSlider('${st.key}',this.value,this)"/>
        <div class="slider-labels"><span>${st.format ? st.format(st.min) : st.min}</span><span>${st.format ? st.format(st.max) : st.max + '+'}</span></div>
      </div>
      <button class="btn primary" onclick="wizNext()">Continuar</button>`;
  }

  function renderLocations(st) {
    const arr = getVal(st.key) || [];
    const tags = arr.map((t, i) => `<span class="loc-tag">${esc(t)}<button type="button" onclick="wizRemoveLoc('${st.key}',${i})">×</button></span>`).join('');
    const presets = (st.presets || []).map(p =>
      `<button type="button" class="loc-preset" onclick="wizAddLoc('${st.key}','${p}')">${esc(p)}</button>`
    ).join('');
    return `${renderProgress()}<h1>${esc(st.title)}</h1>
      <div class="card">
        <div class="loc-tags" id="locTags">${tags || '<span class="hint">Ninguna ubicación seleccionada</span>'}</div>
        <div class="loc-presets">${presets}</div>
        <input type="text" id="locInput" placeholder="Escribe y presiona Enter…" onkeydown="if(event.key==='Enter'){event.preventDefault();wizAddLocFromInput('${st.key}')}"/>
      </div>
      <button class="btn primary" onclick="wizNext()">Continuar</button>`;
  }

  function renderAuth(st) {
    const country = getVal('workAuthCountry') || 'Chile';
    const status = getVal(st.key) || '';
    const countries = (st.countries || []).map(c =>
      `<option value="${esc(c)}"${c === country ? ' selected' : ''}>${esc(c)}</option>`
    ).join('');
    const statuses = (st.statuses || []).map(s =>
      `<option value="${esc(s)}"${s === status ? ' selected' : ''}>${esc(s)}</option>`
    ).join('');
    return `${renderProgress()}<h1>${esc(st.title)}</h1>${st.subtitle ? `<p class="sub">${esc(st.subtitle)}</p>` : ''}
      <div class="card">
        <label>País</label>
        <select id="workAuthCountry" onchange="wizAuthCountry(this.value)">${countries}</select>
        <label>Estado de autorización</label>
        <select id="workAuthStatus"><option value="">Seleccionar estado…</option>${statuses}</select>
      </div>
      <button class="btn primary" onclick="wizNext()">Continuar</button>`;
  }

  function renderMatching() {
    const checks = [
      { l: 'Categorías y salario', ok: !!(S.answers.workTypes && S.answers.minSalary != null) },
      { l: 'Experiencia', ok: !!S.answers.expYears },
      { l: 'Preferencias laborales', ok: !!(S.answers.workFormat && S.answers.teamSize) },
      { l: 'Ubicación y remoto', ok: !!(S.answers.remoteLocations || S.answers.onsiteLocations || S.answers.workFormat) },
      { l: 'Metas personales', ok: !!(S.answers.goals && S.answers.goals.length) }
    ];
    const done = checks.filter(c => c.ok).length;
    const pct = Math.round((done / checks.length) * 100);
    setTimeout(() => { if (currentStep()?.id === 'matching') wizNext(); }, 3500);
    const list = checks.map(c =>
      `<div class="match-check${c.ok ? ' ok' : ''}"><span class="match-dot">${c.ok ? '✓' : '○'}</span>${esc(c.l)}</div>`
    ).join('');
    return `${renderProgress()}<p class="wiz-section-label">Paso final</p>
      <h1>Emparejándote con trabajos según tu perfil</h1>
      <div class="match-pct">${pct}%</div>
      <div class="card">${list}</div>`;
  }

  /* ── custom steps (CV, datos, etc.) ── */
  function renderCustom(st) {
    switch (st.type) {
      case 'custom-terms': return renderTerms();
      case 'custom-cv': return renderCvUpload();
      case 'custom-cv-reading': return renderCvReading();
      case 'custom-titles': return renderTitles();
      case 'custom-photo': return renderPhoto();
      case 'custom-personal': return renderPersonal();
      case 'custom-address': return renderAddress();
      case 'custom-experience': return renderExperience();
      case 'custom-references': return renderReferences();
      case 'custom-exclude': return renderExclude();
      case 'custom-demographics': return renderDemographics();
      case 'custom-inbox': return renderInbox();
      case 'custom-mode': return renderMode();
      case 'custom-generating': return renderGenerating();
      case 'custom-done': return renderDone();
      default: return '<p>Paso no implementado</p>';
    }
  }

  function renderTerms() {
    return `${renderProgress()}<h1>Antes de continuar, revisa estos términos</h1>
      <div class="card"><b>instaWork — Acuerdo de Usuario y Términos de Auto-Apply</b>
      <p class="hint">Versión: v1.0 · Actualizado: hoy<br>Al continuar, confirmas que has leído, entendido y aceptas este Acuerdo.</p>
      <p style="font-size:13px"><b>1. Alcance.</b> Auto-Apply encuentra vacantes en plataformas de terceros y redacta postulaciones usando IA según tus instrucciones.</p>
      <p style="font-size:13px"><b>2. Límites.</b> Operamos con mejor esfuerzo. No garantizamos entrevistas ni ofertas.</p></div>
      <button class="btn primary" onclick="wizNext()">Continuar a Auto Apply</button>`;
  }

  function renderCvUpload() {
    const isLi = S.source === 'linkedin';
    return `${renderProgress()}<h1>Sube tu CV</h1><p class="sub">Tu CV muestra a los empleadores tus habilidades y experiencia.</p>
      <span class="reuse">ⓘ Hazlo una vez. Lo reutilizamos en cada postulación.</span>
      <div class="segw"><div class="seg">
        <button class="${!isLi ? 'on' : ''}" onclick="setSource('resume')">Subir CV</button>
        <button class="${isLi ? 'on' : ''}" onclick="setSource('linkedin')">LinkedIn</button>
      </div></div>
      ${isLi
        ? `<div class="card"><label>URL de LinkedIn</label>
          <input type="url" id="linkedinUrl" placeholder="https://www.linkedin.com/in/tu-perfil" value="${esc(S.linkedin || '')}"/>
          <p class="hint" style="margin-top:8px">Guardamos tu perfil para reutilizarlo en postulaciones.</p></div>
          <button class="btn primary" onclick="wizNext()">Continuar →</button>`
        : `<input type="file" id="cvInput" accept=".pdf,.doc,.docx" style="display:none" onchange="handleCv(this)"/>
          <div class="card"><div class="drop ${S.cv ? 'filled' : ''}" onclick="document.getElementById('cvInput').click()">
            <div class="ic">${S.cv ? '✓' : '⤓'}</div><b>${S.cv ? esc(S.cv) : 'Haz clic para subir tu CV'}</b>
            <small>${S.cvMsg || 'PDF, DOC o DOCX'}</small></div></div>
          ${S.cv ? '<button class="btn primary" onclick="wizNext()">Continuar →</button>' : '<button class="btn skip" onclick="wizNext()">Omitir por ahora</button>'}`
      }`;
  }

  function renderCvReading() {
    if (S.cvText && window.InstaWorkAnalyzer) {
      try {
        const a = window.InstaWorkAnalyzer.analyze(S.cvText);
        S.cvSkills = a.skills; S.cvArea = a.areaLabel; S.cvRoles = a.titles;
      } catch (e) {}
    }
    setTimeout(() => { if (currentStep()?.id === 'cv-reading') wizNext(); }, 5000);
    const sk = S.cvSkills || [];
    const body = sk.length
      ? `<b>Detectamos ${sk.length} habilidades${S.cvArea ? ' · Área: ' + esc(S.cvArea) : ''}:</b>
         <div class="chips" style="margin-top:8px">${sk.slice(0, 14).map(s => `<span class="chip">${esc(s)}</span>`).join('')}</div>`
      : (S.cv ? '<b>CV recibido.</b><p class="hint">No pudimos extraer habilidades (puede ser PDF escaneado).</p>' : '<b>Sin CV.</b>');
    return `${renderProgress()}<h1>Leyendo tu CV</h1><p class="sub">Extraemos información clave para priorizar tus postulaciones.</p>
      <div class="spin"></div><div class="card">${body}</div>`;
  }

  function renderTitles() {
    if (!S.titles.length) S.titles = inferTitles(S.cvSkills || []);
    return `${renderProgress()}<h1>¿Qué puestos buscas?</h1><p class="sub">Agrega, quita o escribe roles — la IA te sugiere opciones.</p>
      <div class="roles-step">
        <div class="roles-panel">
          <div class="roles-panel-head">
            <div class="roles-panel-copy"><strong>Tus puestos objetivo</strong><span>Los roles para buscar empleos</span></div>
            <span class="title-count hidden" id="titleCount"></span>
            <span class="ai-badge"><span class="ai-badge-dot"></span> IA</span>
          </div>
          <div class="title-chip-box" id="titleChipBox">
            <div class="title-chips" id="titleChips"></div>
            <div class="title-input-wrap">
              <span class="title-input-icon">${searchIconSvg()}</span>
              <input type="text" id="titleInput" placeholder="Buscar o escribir un puesto…" autocomplete="off"/>
              <button type="button" class="title-input-add" id="addTitleBtn">Agregar</button>
              <div class="title-suggestions hidden" id="titleSuggestions"></div>
            </div>
          </div>
        </div>
        <div class="roles-suggest-panel">
          <div class="ai-suggest-head hidden" id="aiSuggestHead"><div><span>Sugerencias para ti</span><small>Basado en tu CV</small></div></div>
          <div class="ai-suggest-row" id="aiSuggestPills"></div>
          <p class="hint ai-status" id="aiSuggestStatus"><span class="ai-status-spin"></span> Generando sugerencias…</p>
        </div>
        <div class="roles-country card">
          <label>País de búsqueda</label>
          <select id="paisBusqueda"><option>Chile</option><option>Argentina</option><option>Perú</option><option>Colombia</option><option>México</option><option>Remoto</option></select>
        </div>
      </div>
      <button class="btn primary" onclick="wizNext()">Continuar →</button>`;
  }

  function renderPhoto() {
    return `${renderProgress()}<h1>Sube una foto de perfil</h1><p class="sub">Algunas postulaciones pueden pedir una foto. PNG, JPG o JPEG.</p>
      <input type="file" id="photoInput" accept="image/*" style="display:none" onchange="handlePhoto(this)"/>
      <div class="card"><div class="drop ${S.photo ? 'filled' : ''}" onclick="document.getElementById('photoInput').click()">
        <div class="ic">${S.photo ? '✓' : '👤'}</div><b>${S.photo ? esc(S.photo) : 'Haz clic para subir'}</b></div></div>
      <button class="btn primary" onclick="wizNext()">Continuar →</button>
      <button class="btn skip" onclick="wizNext()">Omitir</button>`;
  }

  function renderPersonal() {
    const f = S.form || {};
    return `${renderProgress()}<h1>¿Cuáles son tus datos personales?</h1><p class="sub">Usamos esta información para emparejarte con empleos.</p>
      <span class="reuse">ⓘ Campos obligatorios marcados con *</span>
      <div class="card">
        <label>Nombre completo *</label><input type="text" id="fullname" value="${esc(f.fullname || '')}" placeholder="Nombre y apellidos"/>
        <label>URL de LinkedIn</label><input type="url" id="linkedin" value="${esc(f.linkedin || S.linkedin || '')}" placeholder="linkedin.com/in/tu-perfil"/>
        <label>Teléfono *</label><input type="tel" id="phone" value="${esc(f.phone || '')}" placeholder="+56 9 ..."/>
        <label>Fecha de nacimiento *</label><input type="date" id="dob" value="${esc(f.dob || '')}"/>
      </div>
      <button class="btn primary" onclick="wizNext()">Continuar →</button>`;
  }

  function renderAddress() {
    const f = S.form || {};
    return `${renderProgress()}<h1>¿Dónde vives?</h1><p class="sub">Tu dirección de residencia, requerida para postulaciones.</p>
      <div class="card">
        <label>Dirección *</label><input type="text" id="address" value="${esc(f.address || '')}" placeholder="Calle y número"/>
        <label>Ciudad *</label><input type="text" id="city" value="${esc(f.city || '')}" placeholder="Ciudad"/>
        <label>País</label><select id="pais"><option>Chile</option><option>Argentina</option><option>Perú</option><option>Colombia</option><option>México</option></select>
        <label>Código postal *</label><input type="text" id="zip" value="${esc(f.zip || '')}" placeholder="8320000"/>
      </div>
      <button class="btn primary" onclick="wizNext()">Continuar →</button>`;
  }

  function renderExperience() {
    return `${renderProgress()}<h1>Cuéntanos sobre tu experiencia</h1><p class="sub">Datos de tu CV para referenciar en postulaciones. <span class="hint">(Opcional)</span></p>
      <div class="card"><div class="top" style="display:flex;justify-content:space-between"><b>Experiencia</b><button class="addbtn">+ Agregar</button></div></div>
      <div class="card" style="margin-top:12px"><div class="top" style="display:flex;justify-content:space-between"><b>Educación</b><button class="addbtn">+ Agregar</button></div></div>
      <div class="card" style="margin-top:12px"><div class="top" style="display:flex;justify-content:space-between"><b>Habilidades</b><button class="addbtn">+ Agregar</button></div></div>
      <button class="btn primary" onclick="wizNext()">Continuar →</button>`;
  }

  function renderReferences() {
    return `${renderProgress()}<h1>¿Tienes referencias profesionales?</h1><p class="sub">Ayudan a verificar tu experiencia. <span class="hint">(Opcional)</span></p>
      <div class="card"><div class="top" style="display:flex;justify-content:space-between"><b>Referencias</b><button class="addbtn">+ Agregar</button></div></div>
      <button class="btn primary" onclick="wizNext()">Continuar →</button>
      <button class="btn skip" onclick="wizNext()">Omitir</button>`;
  }

  function renderExclude() {
    return `${renderProgress()}<h1>¿Quieres excluir ciertas empresas?</h1><p class="sub">No aparecerán en tus resultados. <span class="hint">(Opcional)</span></p>
      <div class="card"><label>Empresa</label><input type="text" id="exclude" placeholder='Por ejemplo "Google"'/></div>
      <button class="btn primary" onclick="wizNext()">Continuar →</button>
      <button class="btn skip" onclick="wizNext()">Omitir</button>`;
  }

  function renderDemographics() {
    return `${renderProgress()}<h1>Cuéntanos sobre ti</h1><p class="sub">Para promover contratación inclusiva. <span class="hint">(Opcional)</span></p>
      <div class="card">
        <label>Raza o etnia</label><select id="etnia"><option>Prefiero no decir</option><option>Latino/Hispano</option><option>Mestizo</option><option>Blanco</option><option>Afrodescendiente</option><option>Indígena</option><option>Asiático</option><option>Otra</option></select>
        <label>Nacionalidad</label><select id="nacionalidad"><option>Prefiero no decir</option><option>Chilena</option><option>Argentina</option><option>Peruana</option><option>Colombia</option><option>Mexicana</option><option>Otra</option></select>
      </div>
      <button class="btn primary" onclick="wizNext()">Continuar →</button>`;
  }

  function renderInbox() {
    return `${renderProgress()}<h1>Crea tu bandeja de Auto Apply</h1><p class="sub">Gestiona tu búsqueda sin saturar tu correo personal.</p>
      <div class="tiles">
        <div class="tile"><div class="ic">🛡</div><b>Anti-spam</b></div>
        <div class="tile"><div class="ic">▤</div><b>Auto-orden</b></div>
        <div class="tile"><div class="ic">🤖</div><b>Sin manos</b></div>
        <div class="tile"><div class="ic">🔔</div><b>Notificado</b></div>
      </div>
      <button class="btn primary" onclick="wizNext()">Guardar y continuar</button>`;
  }

  function renderMode() {
    return `${renderProgress()}<h1>¿Cómo debemos postular por ti?</h1>
      <div class="card">
        ${modeCard('hybrid', 'Modo Híbrido', 'Lo mejor de ambos', 'Auto-postulamos a roles de alto match (75%+). Tú decides el resto.')}
        ${modeCard('auto', 'Modo Auto', 'Ahorra tiempo', 'Totalmente automático. Máxima velocidad.')}
        ${modeCard('review', 'Modo Revisión', 'Aprueba cada empleo', 'Nada se envía sin tu aprobación.')}
      </div>
      <button class="btn primary" onclick="wizGenKit()">Continuar →</button>`;
  }

  function renderGenerating() {
    genAnim();
    return `${renderProgress()}<h1>Generando tu kit de postulación</h1><p class="sub">Esto suele tardar unos segundos</p>
      <div class="card"><div class="spin"></div><div class="tasklist" id="genlist">
        <div id="g0">◦ Generando carta de presentación</div><div id="g1">◦ Generando CV</div>
        <div id="g2">◦ Generando email de seguimiento</div><div id="g3">◦ Buscando empleos</div>
      </div></div>`;
  }

  function renderDone() {
    markOnboardingDoneLocal();
    return `${renderProgress()}<div class="check">✓</div><h1>¡Todo listo!</h1><p class="sub">Tu Auto-Apply está activo. Empezamos a buscar empleos de inmediato.</p>
      <div class="card"><b>Tu búsqueda ya está corriendo</b>
        <div class="tasklist"><div class="done"><b class="b">Ahora ·</b> Revisión de perfil</div>
        <div>~10 min · Primeras postulaciones</div><div>3–5 días · Respuestas en tu bandeja</div></div></div>
      <button class="btn primary" onclick="goDash()">Ir a mi tablero →</button>`;
  }

  function modeCard(id, t, tag, desc) {
    return `<div class="modecard ${S.mode === id ? 'on' : ''}" onclick="setMode('${id}')"><div class="rd"></div><div class="t">${t} <span class="tag">${tag}</span></div><p>${desc}</p></div>`;
  }

  /* ── main render ── */
  function renderStep() {
    const st = currentStep();
    if (!st) return;
    clearError();
    let html = '';
    if (st.type === 'info') html = renderInfo(st);
    else if (st.type === 'single') html = renderSingle(st);
    else if (st.type === 'multi') html = renderMulti(st);
    else if (st.type === 'yesno') html = renderYesNo(st);
    else if (st.type === 'slider') html = renderSlider(st);
    else if (st.type === 'locations') html = renderLocations(st);
    else if (st.type === 'auth') html = renderAuth(st);
    else if (st.type === 'matching') html = renderMatching();
    else if (st.type.startsWith('custom-')) html = renderCustom(st);
    else html = '<p>Paso desconocido</p>';

    view.innerHTML = html;
    restoreFormValues();
    const steps = activeSteps();
    const pct = steps.length > 1 ? Math.round((stepIdx / (steps.length - 1)) * 100) : 100;
    const bar = document.getElementById('bar');
    if (bar) bar.style.width = pct + '%';
    const saved = document.getElementById('saved');
    if (saved) saved.textContent = 'Guardado hace instantes';
    persist();
    window.scrollTo(0, 0);
    if (st.id === 'titles') initTitlesStep();
    if (st.id === 'done') markOnboardingDoneLocal();
  }

  function restoreFormValues() {
    if (!S.form) return;
    view.querySelectorAll('input,select,textarea').forEach(el => {
      if (el.type === 'file' || el.type === 'range') return;
      const k = el.id || el.getAttribute('data-k');
      if (k && S.form[k] != null) el.value = S.form[k];
    });
    const pais = document.getElementById('paisBusqueda');
    if (pais && S.country) pais.value = S.country;
    const pais2 = document.getElementById('pais');
    if (pais2 && S.form.pais) pais2.value = S.form.pais;
  }

  function captureCurrent() {
    view.querySelectorAll('input,select,textarea').forEach(el => {
      if (el.type === 'file' || el.type === 'range') return;
      const k = el.id || el.getAttribute('data-k');
      if (k && el.value) {
        S.form = S.form || {};
        S.form[k] = el.value;
      }
    });
    const authStatus = document.getElementById('workAuthStatus');
    if (authStatus) setVal('workAuth', authStatus.value);
    const authCountry = document.getElementById('workAuthCountry');
    if (authCountry) setVal('workAuthCountry', authCountry.value);
    const pais = document.getElementById('paisBusqueda');
    if (pais) S.country = pais.value;
    if (Object.keys(S.form).length) {
      try { InstaWorkEngine.setProfile(S.form); } catch (e) {}
    }
  }

  function syncPrefsToEngine() {
    try {
      InstaWorkEngine.setPreferences({
        titles: S.titles,
        country: S.country || 'Chile',
        remote: (S.answers.workFormat || []).includes('remote'),
        skills: S.cvSkills || [],
        minSalary: S.answers.minSalary,
        workTypes: S.answers.workTypes,
        workFormat: S.answers.workFormat,
        benefits: S.answers.benefits,
        companySize: S.answers.companySize,
        teamSize: S.answers.teamSize,
        education: S.answers.education,
        expYears: S.answers.expYears,
        profLevel: S.answers.profLevel
      });
      InstaWorkEngine.setProfile({ onboarding: S.answers, cvSkills: S.cvSkills });
    } catch (e) {}
  }

  /* ── window API ── */
  window.wizNext = function () {
    captureCurrent();
    const st = currentStep();
    const err = validateStep(st);
    if (err) { showError(err); return; }
    clearError();
    syncPrefsToEngine();
    const steps = activeSteps();
    if (stepIdx < steps.length - 1) { stepIdx++; renderStep(); }
  };

  window.wizSelect = function (key, v) { selectSingle(key, v); };
  window.wizToggle = function (key, v) { toggleMulti(key, v); };
  window.wizYesNo = function (key, v) { setVal(key, v); renderStep(); setTimeout(wizNext, 300); };
  window.wizSlider = function (key, v, el) {
    setVal(key, +v);
    const st = currentStep();
    const pct = ((+v - st.min) / (st.max - st.min)) * 100;
    el.style.setProperty('--pct', pct + '%');
    const valEl = document.querySelector('.slider-val');
    if (valEl && st.format) valEl.textContent = st.format(+v);
  };
  window.wizAddLoc = function (key, loc) {
    let arr = getVal(key) || [];
    if (!arr.includes(loc)) { arr.push(loc); setVal(key, arr); renderStep(); }
  };
  window.wizRemoveLoc = function (key, i) {
    let arr = getVal(key) || [];
    arr.splice(i, 1); setVal(key, arr); renderStep();
  };
  window.wizAddLocFromInput = function (key) {
    const inp = document.getElementById('locInput');
    const v = (inp?.value || '').trim();
    if (v) { wizAddLoc(key, v); if (inp) inp.value = ''; }
  };
  window.wizAuthCountry = function (v) { setVal('workAuthCountry', v); renderStep(); };

  window.prev = function () {
    captureCurrent();
    if (stepIdx > 0) { stepIdx--; renderStep(); }
    else window.location.replace('/');
  };
  window.next = window.wizNext;
  window.setMode = function (m) { S.mode = m; renderStep(); };
  window.setSource = function (s) { S.source = s; renderStep(); };

  window.wizGenKit = async function () {
    captureCurrent();
    syncPrefsToEngine();
    const steps = activeSteps();
    const genIdx = steps.findIndex(s => s.id === 'generating');
    if (genIdx >= 0) stepIdx = genIdx;
    renderStep();
    try {
      InstaWorkEngine.setMode(S.mode);
      await InstaWorkEngine.search();
    } catch (e) {}
  };

  window.goDash = function () {
    markOnboardingDoneLocal();
    window.location.replace('dashboard.html');
  };

  /* ── CV / titles logic (preserved) ── */
  const SKILL_DICT = ['javascript','typescript','react','vue','angular','node.js','node','python','java','php','laravel','wordpress','shopify','woocommerce','sql','postgresql','mysql','mongodb','aws','docker','git','html','css','figma','ux','ui','seo','marketing','excel','scrum'];

  function extractSkills(t) {
    try { if (window.InstaWorkAnalyzer) return window.InstaWorkAnalyzer.detectSkills(t).map(x => x.name); } catch (e) {}
    const low = (t || '').toLowerCase(); const out = [];
    SKILL_DICT.forEach(s => { if (low.includes(s) && !out.includes(s)) out.push(s); });
    return out;
  }

  function inferTitles(skills) {
    try {
      if (window.InstaWorkAnalyzer) {
        const t = window.InstaWorkAnalyzer.inferTitles(skills || [], S.cvText || '');
        if (t?.length) return t.slice(0, 6);
      }
    } catch (e) {}
    return ['Profesional', 'Analista', 'Asistente'];
  }

  window.handleCv = async function (input) {
    const f = input.files?.[0]; if (!f) return;
    S.cv = f.name; S.cvMsg = 'Leyendo…'; renderStep();
    let text = '';
    try {
      if (/\.pdf$/i.test(f.name) && window.pdfjsLib) {
        const buf = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        for (let i = 1; i <= Math.min(pdf.numPages, 8); i++) {
          const pg = await pdf.getPage(i);
          const tc = await pg.getTextContent();
          text += ' ' + tc.items.map(x => x.str).join(' ');
        }
      } else { try { text = await f.text(); } catch (e) { text = ''; } }
    } catch (e) { text = ''; }
    S.cvText = (text || '').slice(0, 8000);
    S.cvSkills = extractSkills(text);
    try {
      if (window.InstaWorkAnalyzer) {
        const a = window.InstaWorkAnalyzer.analyze(text || '');
        S.cvArea = a.areaLabel; S.cvRoles = a.titles;
        if (!S.titles.length && a.titles?.length) S.titles = a.titles.slice(0, 4);
      }
    } catch (e) {}
    S.cvChars = text.length; S.cvMsg = 'Leído ✓';
    try {
      InstaWorkEngine.setProfile({ cvName: f.name, cvSkills: S.cvSkills, cvChars: S.cvChars });
      if (S.cvSkills.length) InstaWorkEngine.setPreferences({ skills: S.cvSkills });
    } catch (e) {}
    renderStep();
  };

  window.handlePhoto = function (input) {
    const f = input.files?.[0];
    if (f) { S.photo = f.name; try { InstaWorkEngine.setProfile({ photoName: f.name }); } catch (e) {} renderStep(); }
  };

  function genAnim() {
    const my = stepIdx;
    [0,1,2,3].forEach(i => setTimeout(() => {
      const e = document.getElementById('g' + i);
      if (e) { e.innerHTML = e.innerHTML.replace('◦', '<span class="b">✓</span>'); e.classList.add('done'); }
    }, 600 * (i + 1)));
    setTimeout(() => { if (stepIdx === my) wizNext(); }, 3000);
  }

  function markOnboardingDoneLocal() {
    try {
      let uid = sessionStorage.getItem('instawork_uid') || InstaWorkEngine.getProfile()?.uid;
      if (uid) localStorage.setItem('instawork_done_' + uid, '1');
      localStorage.setItem('instawork_done', '1');
      const w = JSON.parse(localStorage.getItem('instawork_wizard') || '{}');
      w.completed = true; localStorage.setItem('instawork_wizard', JSON.stringify(w));
    } catch (e) {}
  }

  function persist() {
    try { localStorage.setItem('instawork_wizard', JSON.stringify({ S, stepIdx, loggedIn: true })); } catch (e) {}
  }

  function restore() {
    try {
      const w = JSON.parse(localStorage.getItem('instawork_wizard'));
      if (w?.S) {
        Object.assign(S, w.S);
        if (typeof w.stepIdx === 'number') stepIdx = w.stepIdx;
        else stepIdx = 0;
        return true;
      }
    } catch (e) {}
    return false;
  }

  function searchIconSvg() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  function syncTitlesFromDom() {
    const pending = (document.getElementById('titleInput')?.value || '').trim();
    if (pending) addTitle(pending);
  }

  function addTitle(title) {
    const t = (title || '').trim(); if (!t) return;
    if (S.titles.some(x => x.toLowerCase() === t.toLowerCase())) return;
    S.titles.push(t); renderTitleChips();
    const input = document.getElementById('titleInput'); if (input) input.value = '';
    renderAiPills(); persist();
  }

  function removeTitle(i) { S.titles.splice(i, 1); renderTitleChips(); renderAiPills(); persist(); }

  function formatTitle(t) {
    const low = (t || '').trim().toLowerCase();
    const sp = { wordpress: 'WordPress', javascript: 'JavaScript', seo: 'SEO' };
    if (sp[low]) return sp[low];
    return low.replace(/\b\w/g, c => c.toUpperCase());
  }

  function chipMeta(t) {
    const low = (t || '').toLowerCase();
    if (/wordpress|shopify/.test(low)) return 'cms';
    if (/ux|ui|diseñ/.test(low)) return 'design';
    if (/developer|desarroll|ingenier/.test(low)) return 'tech';
    return 'default';
  }

  function chipIconSvg(v) { return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="4" y="7" width="16" height="12" rx="2" stroke="currentColor" stroke-width="2"/></svg>'; }

  function renderTitleChips() {
    const el = document.getElementById('titleChips');
    const box = document.getElementById('titleChipBox');
    const countEl = document.getElementById('titleCount');
    if (!el) return;
    if (countEl) { countEl.textContent = S.titles.length ? `${S.titles.length} rol${S.titles.length > 1 ? 'es' : ''}` : ''; countEl.classList.toggle('hidden', !S.titles.length); }
    if (!S.titles.length) {
      el.innerHTML = '<div class="title-chips-empty"><span>✦</span><div><strong>Sin puestos aún</strong><p>Agrega roles desde las sugerencias.</p></div></div>';
      box?.classList.add('is-empty'); return;
    }
    box?.classList.remove('is-empty');
    el.innerHTML = S.titles.map((t, i) => {
      const v = chipMeta(t);
      return `<span class="title-chip title-chip--${v}"><span class="title-chip-text">${esc(formatTitle(t))}</span>
        <button type="button" class="title-chip-x" data-i="${i}">×</button></span>`;
    }).join('');
  }

  function renderAiPills() {
    const el = document.getElementById('aiSuggestPills');
    const head = document.getElementById('aiSuggestHead');
    if (!el) return;
    const sel = new Set(S.titles.map(x => x.toLowerCase()));
    const pills = (S.aiTitleSuggestions || []).filter(t => !sel.has(t.toLowerCase())).slice(0, 6);
    if (head) head.classList.toggle('hidden', !pills.length);
    el.innerHTML = pills.map((t, i) => `<button type="button" class="ai-suggest-pill" data-idx="${i}"><span class="ai-suggest-plus">+</span>${esc(formatTitle(t))}</button>`).join('');
  }

  function initTitlesStep() {
    renderTitleChips();
    const input = document.getElementById('titleInput');
    const statusEl = document.getElementById('aiSuggestStatus');
    if (!input) return;
    const ai = window.InstaWorkAITitles;
    if (ai) {
      ai.suggestJobTitles({ skills: S.cvSkills || [], cvText: S.cvText || '', country: S.country || 'Chile' })
        .then(list => { S.aiTitleSuggestions = list; if (!S.titles.length && list.length) S.titles = list.slice(0, 4); renderTitleChips(); renderAiPills(); if (statusEl) statusEl.innerHTML = '✨ <b>Sugerencias listas.</b>'; })
        .catch(() => { S.aiTitleSuggestions = ai.fallbackTitleSuggestions(S.cvSkills || [], S.cvText || ''); renderAiPills(); });
    } else { S.aiTitleSuggestions = inferTitles(S.cvSkills || []); renderAiPills(); }
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addTitle(input.value); } });
    document.getElementById('addTitleBtn')?.addEventListener('click', () => addTitle(input.value));
    document.getElementById('titleChips')?.addEventListener('click', e => { const b = e.target.closest('.title-chip-x'); if (b) removeTitle(+b.dataset.i); });
    document.getElementById('aiSuggestPills')?.addEventListener('click', e => {
      const b = e.target.closest('[data-idx]');
      if (b) { const sel = new Set(S.titles.map(x => x.toLowerCase())); const pill = (S.aiTitleSuggestions || []).filter(t => !sel.has(t.toLowerCase()))[+b.dataset.idx]; if (pill) addTitle(pill); }
    });
  }

  document.addEventListener('click', e => {
    const add = e.target.closest('.addbtn');
    if (add) { e.preventDefault(); const card = add.closest('.card'); if (card) { const inp = document.createElement('input'); inp.type = 'text'; inp.placeholder = 'Escribe aquí…'; inp.style.cssText = 'width:100%;margin-top:8px'; card.appendChild(inp); inp.focus(); } }
  });

  restore();
  try {
    const uid = sessionStorage.getItem('instawork_uid') || InstaWorkEngine.getProfile()?.uid;
    if ((uid && localStorage.getItem('instawork_done_' + uid) === '1') || localStorage.getItem('instawork_done') === '1') {
      window.location.replace('dashboard.html');
    }
  } catch (e) {}
  renderStep();
})();
