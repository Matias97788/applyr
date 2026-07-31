(function () {
  'use strict';

  const FLOW = window.OnboardingFlow;
  if (!FLOW) { console.error('OnboardingFlow no cargado'); return; }

  const S = {
    source: 'resume', titles: [], mode: 'auto', notify: {},
    aiTitleSuggestions: [], answers: {}, form: {},
    experience: [], education: [], skills: [], references: [], excludeList: []
  };

  /* Analyzer local si no existe InstaWorkAnalyzer en engine */
  if (!window.InstaWorkAnalyzer) {
    window.InstaWorkAnalyzer = {
      detectSkills(t) {
        const low = (t || '').toLowerCase();
        const dict = ['javascript','python','react','node','sql','excel','marketing','ventas','python','figma','seo','html','css','typescript','java','aws','docker','liderazgo','comunicacion','comunicación','gestión','gestion','agile','scrum','wordpress','shopify','salesforce','crm','inglés','ingles','english'];
        return dict.filter(s => low.includes(s)).map(name => ({ name }));
      },
      inferTitles(skills, cvText) {
        const low = ((cvText || '') + ' ' + (skills || []).join(' ')).toLowerCase();
        const out = [];
        if (/market|seo|content|brand/.test(low)) out.push('Marketing Specialist', 'Digital Marketing');
        if (/develop|javascript|react|python|software|engineer/.test(low)) out.push('Software Developer', 'Full Stack Developer');
        if (/design|figma|ux|ui/.test(low)) out.push('Product Designer', 'UX Designer');
        if (/sales|venta|account/.test(low)) out.push('Account Executive', 'Sales Representative');
        if (/data|analy|sql/.test(low)) out.push('Data Analyst');
        if (!out.length) out.push('Profesional', 'Analista', 'Especialista');
        return out.slice(0, 6);
      },
      analyze(t) {
        const skills = this.detectSkills(t).map(x => x.name);
        const titles = this.inferTitles(skills, t);
        let areaLabel = 'General';
        const low = (t || '').toLowerCase();
        if (/market|seo/.test(low)) areaLabel = 'Marketing';
        else if (/develop|software|engineer|javascript|python/.test(low)) areaLabel = 'Tecnología';
        else if (/design|ux|ui/.test(low)) areaLabel = 'Diseño';
        else if (/sales|venta/.test(low)) areaLabel = 'Ventas';
        return { skills, titles, areaLabel };
      }
    };
  }

  let stepIdx = 0;
  let advanceTimer = null;
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
    renderStep();
  }

  function selectSingle(key, v) {
    setVal(key, v);
    renderStep();
    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(() => goNext(), 180);
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

    if (st.type === 'custom-terms') {
      const accepted = document.getElementById('termsAccepted')?.checked || (S.form && S.form.termsAccepted);
      if (!accepted) return 'Debes aceptar los términos para continuar.';
      return null;
    }

    if (st.type === 'custom-inbox') {
      const a = (document.getElementById('inboxAlias')?.value || '').trim();
      if (!a || a.length < 3) return 'Elige un alias de al menos 3 caracteres.';
      if (!/^[a-zA-Z0-9._-]+$/.test(a)) return 'El alias solo puede tener letras, números, punto, guion o guion bajo.';
      return null;
    }

    if (st.type === 'custom-cv') {
      if (S.source === 'linkedin') {
        const v = (document.getElementById('linkedinUrl')?.value || S.linkedin || '').trim();
        if (!v) return 'Pega tu URL de LinkedIn o cambia a Subir CV.';
        if (!/linkedin\.com/i.test(v)) return 'Pega una URL válida de LinkedIn (linkedin.com/in/...).';
        return null;
      }
      if (!S.cv && !S.cvSkipped) return 'Sube tu CV o pulsa "Omitir por ahora".';
      return null;
    }

    if (st.type === 'custom-titles') {
      syncTitlesFromDom();
      if (!S.titles.length) return 'Agrega al menos un puesto objetivo para continuar.';
      return null;
    }

    if (st.type === 'custom-personal') {
      const fullname = (document.getElementById('fullname')?.value || '').trim();
      const email = (document.getElementById('email')?.value || '').trim();
      const phone = (document.getElementById('phone')?.value || '').trim();
      const dob = (document.getElementById('dob')?.value || '').trim();
      if (!fullname) return 'Ingresa tu nombre completo.';
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Ingresa un email válido.';
      if (!phone) return 'Ingresa tu número de teléfono.';
      if (!dob) return 'Ingresa tu fecha de nacimiento.';
      return null;
    }

    if (st.type === 'custom-linkedin-scan') return null;

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

  function goNext() {
    captureCurrent();
    const st = currentStep();
    const err = validateStep(st);
    if (err) { showError(err); return; }
    clearError();
    syncPrefsToEngine();
    const steps = activeSteps();
    if (stepIdx < steps.length - 1) { stepIdx++; renderStep(); }
  }

  /* ── renderers by type ── */
  function renderInfo(st) {
    let body = '';
    if (st.icon) {
      const iconKey = ({
        '🏃': 'run', '🚀': 'rocket', '🧭': 'compass', '😤': 'stress', '🧩': 'puzzle',
        '📊': 'chart', '🔍': 'search', '📋': 'list', '🖨️': 'print', '📝': 'edit', '📈': 'growth'
      })[st.icon] || 'spark';
      body += `<div class="info-icon info-icon--${iconKey}" aria-hidden="true"></div>`;
    }
    if (st.body) body += st.body;
    if (st.bullets) {
      body += '<ul class="info-bullets">' + st.bullets.map(b => `<li>${esc(b)}</li>`).join('') + '</ul>';
    }
    return `${renderProgress()}<h1 class="wiz-title">${esc(st.title)}</h1>${st.subtitle ? `<p class="sub">${esc(st.subtitle)}</p>` : ''}${body ? `<div class="card info-card">${body}</div>` : ''}<button type="button" class="btn primary" onclick="wizNext()">Continuar</button>`;
  }

    function renderSingle(st) {
    const product = st.layout === 'product' || st.id === 'service-path';
    const opts = (st.options || []).map(o => {
      const on = isSelected(st.key, o.v) ? ' on' : '';
      const tag = o.tag ? `<span class="opt-tag">${esc(o.tag)}</span>` : '';
      const desc = o.d ? `<small>${esc(o.d)}</small>` : '';
      if (product) {
        const prev = o.preview || o.v;
        return `<button type="button" class="product-card${on}" data-wiz-select="${esc(st.key)}" data-wiz-val="${esc(o.v)}">
          <div class="product-card-top">${tag}<span class="product-rd"></span></div>
          <div class="product-preview product-preview--${esc(prev)}" aria-hidden="true"></div>
          <div class="product-card-copy"><b>${esc(o.t)}</b>${desc}</div>
        </button>`;
      }
      return `<button type="button" class="opt-card${on}" data-wiz-select="${esc(st.key)}" data-wiz-val="${esc(o.v)}"><span class="opt-rd"></span><div><b>${esc(o.t)}</b>${tag}${desc}</div></button>`;
    }).join('');
    const list = `<div class="opt-list${product ? ' opt-list--product' : ''}">${opts}</div>`;
    return `${renderProgress()}<h1 class="wiz-title">${esc(st.title)}</h1>${st.subtitle ? `<p class="sub">${esc(st.subtitle)}</p>` : ''}${list}`;
  }

  function renderMulti(st) {
    const arr = getVal(st.key) || [];
    const opts = (st.options || []).map(o => {
      const on = arr.includes(o.v) ? ' on' : '';
      return `<button type="button" class="opt-card check${on}" data-wiz-toggle="${esc(st.key)}" data-wiz-val="${esc(o.v)}"><span class="opt-chk">${on ? '✓' : ''}</span><b>${esc(o.t)}</b></button>`;
    }).join('');
    const min = st.min || 1;
    const disabled = arr.length < min ? ' disabled' : '';
    return `${renderProgress()}<h1 class="wiz-title">${esc(st.title)}</h1>${st.subtitle ? `<p class="sub">${esc(st.subtitle)}</p>` : ''}<div class="opt-list">${opts}</div><button type="button" class="btn primary${disabled}" onclick="wizNext()"${disabled ? ' disabled' : ''}>Continuar</button>`;
  }

  function renderYesNo(st) {
    const val = getVal(st.key);
    return `${renderProgress()}<h1 class="wiz-title">${esc(st.title)}</h1>
      <div class="card statement-card"><p>“${esc(st.statement)}”</p></div>
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
    setTimeout(() => { if (currentStep()?.id === 'matching') goNext(); }, 3500);
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
      case 'custom-linkedin-scan': return renderLinkedinScan();
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
    const ok = !!(S.form && S.form.termsAccepted);
    return `${renderProgress()}
      <h1 class="wiz-title">Términos de Auto-Apply</h1>
      <p class="sub">Revisa y acepta para activar postulaciones automáticas.</p>
      <div class="card terms-card" style="text-align:left">
        <b>instaWork — Acuerdo de Usuario y Auto-Apply</b>
        <p class="hint">Versión 1.1</p>
        <div class="terms-scroll">
          <p><b>1. Alcance.</b> Auto-Apply busca vacantes en portales de terceros y completa postulaciones usando tu perfil, CV y preferencias.</p>
          <p><b>2. Autorización.</b> Nos autorizas a enviar postulaciones en tu nombre según el modo elegido (Auto, Híbrido o Revisión).</p>
          <p><b>3. Exactitud.</b> Eres responsable de que tu CV, datos y respuestas sean verídicos. Puedes editarlos cuando quieras.</p>
          <p><b>4. Límites.</b> No garantizamos entrevistas, ofertas ni respuestas de empleadores. El servicio es de mejor esfuerzo.</p>
          <p><b>5. Datos.</b> Tratamos tu información para operar el producto. Puedes pedir exportación o eliminación escribiendo a soporte.</p>
          <p><b>6. Terceros.</b> Los sitios de empleo tienen sus propias reglas; el rechazo o bloqueo de una plataforma está fuera de nuestro control.</p>
        </div>
        <label class="chk terms-check">
          <input type="checkbox" id="termsAccepted" ${ok?'checked':''}/>
          He leído y acepto los Términos y la Política de Privacidad *
        </label>
      </div>
      <button type="button" class="btn primary" onclick="wizNext()">Continuar a Auto-Apply</button>`;
  }

  function renderCvUpload() {
    const isLi = S.source === 'linkedin';
    return `${renderProgress()}
      <h1 class="wiz-title">Sube tu CV o conecta LinkedIn</h1>
      <p class="sub">Lo usamos una vez para personalizar cada postulación (ATS + carta).</p>
      <span class="reuse">ⓘ Hazlo una vez. Lo reutilizamos en cada postulación.</span>
      <div class="segw"><div class="seg">
        <button type="button" class="${!isLi ? 'on' : ''}" onclick="setSource('resume')">Subir CV</button>
        <button type="button" class="${isLi ? 'on' : ''}" onclick="setSource('linkedin')">Escanear LinkedIn</button>
      </div></div>
      ${isLi
        ? `<div class="card cv-card">
            <div class="cv-li-head">
              <div class="cv-li-badge" aria-hidden="true"></div>
              <div>
                <b>Importar desde LinkedIn</b>
                <p class="hint" style="margin:6px 0 0">Pega la URL pública de tu perfil. Escanearemos experiencia, educación y skills.</p>
              </div>
            </div>
            <label class="field-label" style="margin-top:16px">URL de LinkedIn *</label>
            <input type="url" id="linkedinUrl" placeholder="https://www.linkedin.com/in/tu-perfil" value="${esc(S.linkedin || '')}" autocomplete="url"/>
            <p class="hint" style="margin-top:8px">Ejemplo: linkedin.com/in/nombre-apellido</p>
          </div>
          <button type="button" class="btn primary" onclick="wizStartLinkedinScan()">Escanear perfil →</button>
          <button type="button" class="btn skip" onclick="setSource('resume')">Prefiero subir un CV</button>`
        : `<input type="file" id="cvInput" accept=".pdf,.doc,.docx,application/pdf" style="display:none" onchange="handleCv(this)"/>
          <div class="card"><div class="drop ${S.cv ? 'filled' : ''}" onclick="document.getElementById('cvInput').click()" ondragover="event.preventDefault()" ondrop="wizDropCv(event)">
            <div class="ic">${S.cv ? '✓' : '📄'}</div>
            <b>${S.cv ? esc(S.cv) : 'Arrastra tu CV o haz clic para subir'}</b>
            <small>${S.cvMsg || 'PDF, DOC o DOCX · máx. 10 MB'}</small>
          </div></div>
          ${S.cv
            ? '<button type="button" class="btn primary" onclick="wizNext()">Continuar →</button><button type="button" class="btn skip" onclick="document.getElementById(\'cvInput\').click()">Cambiar archivo</button>'
            : '<button type="button" class="btn skip" onclick="wizSkipCv()">Omitir por ahora</button>'}`
      }`;
  }


  function renderLinkedinScan() {
    if (!S._liScanStarted) {
      S._liScanStarted = true;
      runLinkedinScan();
    }
    const steps = [
      { id: 'li0', t: 'Conectando con el perfil' },
      { id: 'li1', t: 'Extrayendo experiencia laboral' },
      { id: 'li2', t: 'Leyendo educación y skills' },
      { id: 'li3', t: 'Armando tu base de postulaciones' }
    ];
    const list = steps.map((s, i) =>
      `<div class="tasklist-row" id="${s.id}"><span class="spin-mini"></span><span>${esc(s.t)}</span></div>`
    ).join('');
    return `${renderProgress()}
      <h1 class="wiz-title">Escaneando tu LinkedIn</h1>
      <p class="sub">${esc(S.linkedin || 'Tu perfil')}</p>
      <div class="card">
        <div class="spin" style="margin-bottom:16px"></div>
        <div class="tasklist" id="liScanList">${list}</div>
      </div>`;
  }

  function runLinkedinScan() {
    const my = stepIdx;
    const marks = ['li0', 'li1', 'li2', 'li3'];
    const labels = {
      li0: 'Conectando con el perfil',
      li1: 'Extrayendo experiencia laboral',
      li2: 'Leyendo educación y skills',
      li3: 'Armando tu base de postulaciones'
    };
    marks.forEach((id, i) => {
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<span class="b">✓</span><span>${labels[id] || ''}</span>`;
      }, 700 * (i + 1));
    });
    setTimeout(() => {
      if (stepIdx !== my) return;
      // Derive mock structure from URL slug if empty
      if (!S.experience.length) {
        const slug = (S.linkedin || '').split('/in/')[1] || '';
        const name = decodeURIComponent(slug.split(/[/?#]/)[0] || '').replace(/[-_]/g, ' ').trim();
        if (name && !S.form.fullname) { S.form = S.form || {}; S.form.fullname = name.replace(/\b\w/g, c => c.toUpperCase()); }
        S.experience = [{ company: 'Experiencia desde LinkedIn', title: 'Rol principal', start: '', end: 'Actualidad', desc: 'Importado desde tu perfil de LinkedIn. Edítalo en el siguiente paso si hace falta.' }];
        S.education = [{ school: 'Educación (LinkedIn)', degree: '', year: '' }];
        S.skills = S.cvSkills && S.cvSkills.length ? S.cvSkills.slice(0, 8) : ['Comunicación', 'Trabajo en equipo', 'Microsoft Office'];
        S.cv = S.cv || 'linkedin-import';
        S.cvMsg = 'Perfil LinkedIn escaneado ✓';
        S.cvText = [S.form.fullname, S.linkedin, ...S.skills].filter(Boolean).join(' ');
      }
      goNext();
    }, 3200);
  }

  function renderCvReading() {
    if (S.cvSkipped && !S.cv && !S.cvText) {
      setTimeout(() => { if (currentStep()?.id === 'cv-reading') goNext(); }, 50);
      return `${renderProgress()}<h1 class="wiz-title">Continuando…</h1>`;
    }
    if (S.cvText && window.InstaWorkAnalyzer) {
      try {
        const a = window.InstaWorkAnalyzer.analyze(S.cvText);
        S.cvSkills = a.skills; S.cvArea = a.areaLabel; S.cvRoles = a.titles;
        if (!S.skills?.length) S.skills = (a.skills || []).slice(0, 12);
        if (!S.titles.length && a.titles?.length) S.titles = a.titles.slice(0, 4);
      } catch (e) {}
    }
    const delay = (S.cvSkills && S.cvSkills.length) ? 2800 : 1600;
    setTimeout(() => { if (currentStep()?.id === 'cv-reading') goNext(); }, delay);
    const sk = S.cvSkills || [];
    const body = sk.length
      ? `<b>Detectamos ${sk.length} habilidades${S.cvArea ? ' · Área: ' + esc(S.cvArea) : ''}:</b>
         <div class="chips" style="margin-top:8px">${sk.slice(0, 14).map(s => `<span class="chip">${esc(s)}</span>`).join('')}</div>`
      : (S.cv
          ? '<b>CV recibido.</b><p class="hint">Extraeremos más detalle al generar tu kit. Puedes editar skills más adelante.</p>'
          : (S.linkedin
              ? '<b>Perfil LinkedIn listo.</b><p class="hint">Usaremos tu URL para personalizar postulaciones.</p>'
              : '<b>Sin archivo.</b><p class="hint">Puedes cargar un CV después desde el tablero.</p>'));
    return `${renderProgress()}
      <h1 class="wiz-title">Analizando tu perfil</h1>
      <p class="sub">Un momento mientras preparamos tu base de postulaciones…</p>
      <div class="card">
        <div class="spin" style="margin-bottom:14px"></div>
        ${body}
      </div>`;
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
    const preview = S.photoDataUrl
      ? `<img class="photo-preview" src="${S.photoDataUrl}" alt="Vista previa"/>`
      : `<div class="ic">${S.photo ? '✓' : '👤'}</div>`;
    return `${renderProgress()}
      <h1 class="wiz-title">Foto de perfil</h1>
      <p class="sub">Algunas postulaciones la piden. PNG o JPG, fondo simple funciona mejor.</p>
      <input type="file" id="photoInput" accept="image/png,image/jpeg,image/jpg,image/webp" style="display:none" onchange="handlePhoto(this)"/>
      <div class="card">
        <div class="drop ${S.photo ? 'filled' : ''}" onclick="document.getElementById('photoInput').click()">
          ${preview}
          <b>${S.photo ? esc(S.photo) : 'Haz clic para subir una foto'}</b>
          <small>${S.photo ? 'Toca para cambiar' : 'PNG, JPG o WEBP'}</small>
        </div>
      </div>
      ${S.photo
        ? '<button type="button" class="btn primary" onclick="wizNext()">Continuar →</button><button type="button" class="btn skip" onclick="wizClearPhoto()">Quitar foto</button>'
        : '<button type="button" class="btn skip" onclick="wizNext()">Omitir por ahora</button>'}
      ${S.photo ? '' : '<button type="button" class="btn primary" onclick="document.getElementById(\'photoInput\').click()">Elegir archivo</button>'}`;
  }

  function renderPersonal() {
    const f = S.form || {};
    return `${renderProgress()}
      <h1 class="wiz-title">Tus datos personales</h1>
      <p class="sub">Los usamos para completar formularios de postulación automáticamente.</p>
      <span class="reuse">ⓘ Campos obligatorios marcados con *</span>
      <div class="card">
        <label>Nombre completo *</label>
        <input type="text" id="fullname" value="${esc(f.fullname || '')}" placeholder="Nombre y apellidos" autocomplete="name"/>
        <label>Email *</label>
        <input type="email" id="email" value="${esc(f.email || '')}" placeholder="tu@email.com" autocomplete="email"/>
        <label>Teléfono *</label>
        <input type="tel" id="phone" value="${esc(f.phone || '')}" placeholder="+56 9 1234 5678" autocomplete="tel"/>
        <label>Fecha de nacimiento *</label>
        <input type="date" id="dob" value="${esc(f.dob || '')}"/>
        <label>URL de LinkedIn</label>
        <input type="url" id="linkedin" value="${esc(f.linkedin || S.linkedin || '')}" placeholder="https://www.linkedin.com/in/..."/>
        <label>Portfolio / sitio web</label>
        <input type="url" id="website" value="${esc(f.website || '')}" placeholder="https://..."/>
        <label>Género</label>
        <select id="gender">
          <option value="">Prefiero no decir</option>
          <option value="f"${f.gender==='f'?' selected':''}>Femenino</option>
          <option value="m"${f.gender==='m'?' selected':''}>Masculino</option>
          <option value="nb"${f.gender==='nb'?' selected':''}>No binario</option>
          <option value="other"${f.gender==='other'?' selected':''}>Otro</option>
        </select>
      </div>
      <button type="button" class="btn primary" onclick="wizNext()">Continuar →</button>`;
  }

  function renderAddress() {
    const f = S.form || {};
    const countries = ['Chile','Argentina','Perú','Colombia','México','España','Estados Unidos','Otro'];
    const opts = countries.map(c => `<option value="${esc(c)}"${(f.pais||'Chile')===c?' selected':''}>${esc(c)}</option>`).join('');
    return `${renderProgress()}
      <h1 class="wiz-title">¿Dónde vives?</h1>
      <p class="sub">Dirección de residencia para formularios de postulación.</p>
      <div class="card" style="text-align:left">
        <label>Dirección (calle y número) *</label>
        <input type="text" id="address" value="${esc(f.address || '')}" placeholder="Av. Ejemplo 123" autocomplete="street-address"/>
        <label>Depto / oficina / casa</label>
        <input type="text" id="address2" value="${esc(f.address2 || '')}" placeholder="Depto 4B (opcional)"/>
        <div class="form-row2">
          <div>
            <label>Ciudad *</label>
            <input type="text" id="city" value="${esc(f.city || '')}" placeholder="Santiago" autocomplete="address-level2"/>
          </div>
          <div>
            <label>Comuna / región</label>
            <input type="text" id="region" value="${esc(f.region || '')}" placeholder="Providencia" autocomplete="address-level1"/>
          </div>
        </div>
        <div class="form-row2">
          <div>
            <label>País</label>
            <select id="pais">${opts}</select>
          </div>
          <div>
            <label>Código postal *</label>
            <input type="text" id="zip" value="${esc(f.zip || '')}" placeholder="8320000" autocomplete="postal-code"/>
          </div>
        </div>
      </div>
      <button type="button" class="btn primary" onclick="wizNext()">Continuar →</button>`;
  }

  function renderExperience() {
    if (!Array.isArray(S.experience)) S.experience = [];
    if (!Array.isArray(S.education)) S.education = [];
    if (!Array.isArray(S.skills)) S.skills = (S.cvSkills || []).slice(0, 12);

    const expRows = S.experience.length
      ? S.experience.map((e, i) => `<div class="rowcard" data-exp="${i}">
          <div class="top"><span>${esc(e.title || 'Puesto')} · ${esc(e.company || 'Empresa')}</span>
          <button type="button" class="addbtn" onclick="wizRemoveExp(${i})">Eliminar</button></div>
          <small class="hint">${esc(e.start || '')} — ${esc(e.end || '')}</small>
          ${e.desc ? `<p class="hint" style="margin-top:6px">${esc(e.desc)}</p>` : ''}
        </div>`).join('')
      : '<p class="hint">Aún no agregaste experiencia.</p>';

    const eduRows = S.education.length
      ? S.education.map((e, i) => `<div class="rowcard" data-edu="${i}">
          <div class="top"><span>${esc(e.school || 'Institución')}${e.degree ? ' · ' + esc(e.degree) : ''}</span>
          <button type="button" class="addbtn" onclick="wizRemoveEdu(${i})">Eliminar</button></div>
          <small class="hint">${esc(e.year || '')}</small>
        </div>`).join('')
      : '<p class="hint">Aún no agregaste educación.</p>';

    const skillChips = (S.skills || []).map((s, i) =>
      `<span class="chip">${esc(s)} <button type="button" class="chip-x" onclick="wizRemoveSkill(${i})" aria-label="Quitar">×</button></span>`
    ).join('') || '<span class="hint">Sin habilidades aún</span>';

    return `${renderProgress()}
      <h1 class="wiz-title">Experiencia, educación y skills</h1>
      <p class="sub">Completa o corrige lo importado de tu CV / LinkedIn.</p>
      <div class="card">
        <div class="top" style="display:flex;justify-content:space-between;align-items:center"><b>Experiencia laboral</b>
          <button type="button" class="addbtn" onclick="wizAddExp()">+ Agregar</button></div>
        <div id="expList" style="margin-top:10px">${expRows}</div>
        <div id="expForm" class="inline-form hidden">
          <label>Puesto *</label><input type="text" id="expTitle" placeholder="Ej. Analista de marketing"/>
          <label>Empresa *</label><input type="text" id="expCompany" placeholder="Ej. Mercado Libre"/>
          <div class="form-row2">
            <div><label>Desde</label><input type="month" id="expStart"/></div>
            <div><label>Hasta</label><input type="month" id="expEnd"/><label class="chk"><input type="checkbox" id="expCurrent"/> Actualidad</label></div>
          </div>
          <label>Descripción</label><textarea id="expDesc" rows="3" placeholder="Logros y responsabilidades"></textarea>
          <button type="button" class="btn primary" style="margin-top:12px" onclick="wizSaveExp()">Guardar experiencia</button>
        </div>
      </div>
      <div class="card" style="margin-top:12px">
        <div class="top" style="display:flex;justify-content:space-between;align-items:center"><b>Educación</b>
          <button type="button" class="addbtn" onclick="wizAddEdu()">+ Agregar</button></div>
        <div id="eduList" style="margin-top:10px">${eduRows}</div>
        <div id="eduForm" class="inline-form hidden">
          <label>Institución *</label><input type="text" id="eduSchool" placeholder="Universidad / Instituto"/>
          <label>Título / carrera</label><input type="text" id="eduDegree" placeholder="Ej. Ingeniería comercial"/>
          <label>Año</label><input type="text" id="eduYear" placeholder="2019 — 2023"/>
          <button type="button" class="btn primary" style="margin-top:12px" onclick="wizSaveEdu()">Guardar educación</button>
        </div>
      </div>
      <div class="card" style="margin-top:12px">
        <b>Habilidades</b>
        <div class="chips" style="margin-top:10px" id="skillChips">${skillChips}</div>
        <div class="title-input-wrap" style="margin-top:12px">
          <input type="text" id="skillInput" placeholder="Agregar skill y Enter"/>
          <button type="button" class="title-input-add" onclick="wizAddSkill()">Añadir</button>
        </div>
      </div>
      <button type="button" class="btn primary" onclick="wizNext()">Continuar →</button>
      <button type="button" class="btn skip" onclick="wizNext()">Omitir por ahora</button>`;
  }

  function renderReferences() {
    if (!Array.isArray(S.references)) S.references = [];
    const rows = S.references.length
      ? S.references.map((r, i) => `<div class="rowcard">
          <div class="top"><span>${esc(r.name || 'Referencia')}${r.role ? ' · ' + esc(r.role) : ''}</span>
          <button type="button" class="addbtn" onclick="wizRemoveRef(${i})">Eliminar</button></div>
          <small class="hint">${esc(r.company || '')} ${r.email ? '· ' + esc(r.email) : ''} ${r.phone ? '· ' + esc(r.phone) : ''}</small>
        </div>`).join('')
      : '<p class="hint">Sin referencias todavía.</p>';
    return `${renderProgress()}
      <h1 class="wiz-title">Referencias profesionales</h1>
      <p class="sub">Opcional, pero ayuda en postulaciones que las piden.</p>
      <div class="card">
        <div class="top" style="display:flex;justify-content:space-between;align-items:center"><b>Referencias</b>
          <button type="button" class="addbtn" onclick="wizAddRef()">+ Agregar</button></div>
        <div style="margin-top:10px">${rows}</div>
        <div id="refForm" class="inline-form hidden">
          <label>Nombre *</label><input type="text" id="refName" placeholder="Nombre completo"/>
          <label>Cargo</label><input type="text" id="refRole" placeholder="Ej. Jefe directo"/>
          <label>Empresa</label><input type="text" id="refCompany" placeholder="Empresa"/>
          <label>Email</label><input type="email" id="refEmail" placeholder="correo@empresa.com"/>
          <label>Teléfono</label><input type="tel" id="refPhone" placeholder="+56 9 ..."/>
          <button type="button" class="btn primary" style="margin-top:12px" onclick="wizSaveRef()">Guardar referencia</button>
        </div>
      </div>
      <button type="button" class="btn primary" onclick="wizNext()">Continuar →</button>
      <button type="button" class="btn skip" onclick="wizNext()">Omitir</button>`;
  }

  function renderExclude() {
    if (!Array.isArray(S.excludeList)) S.excludeList = [];
    const chips = S.excludeList.map((c, i) =>
      `<span class="chip">${esc(c)} <button type="button" class="chip-x" onclick="wizRemoveExclude(${i})">×</button></span>`
    ).join('') || '<span class="hint">Ninguna empresa excluida</span>';
    return `${renderProgress()}
      <h1 class="wiz-title">¿Excluir empresas?</h1>
      <p class="sub">No postularemos ahí. Opcional.</p>
      <div class="card">
        <div class="chips" id="excludeChips">${chips}</div>
        <div class="title-input-wrap" style="margin-top:12px">
          <input type="text" id="exclude" placeholder='Ej. "Empresa actual"'/>
          <button type="button" class="title-input-add" onclick="wizAddExclude()">Añadir</button>
        </div>
      </div>
      <button type="button" class="btn primary" onclick="wizNext()">Continuar →</button>
      <button type="button" class="btn skip" onclick="wizNext()">Omitir</button>`;
  }

  function renderDemographics() {
    const f = S.form || {};
    const sel = (id, val, options) => {
      const opts = options.map(([v,l]) => `<option value="${esc(v)}"${val===v?' selected':''}>${esc(l)}</option>`).join('');
      return `<label>${esc(id)}</label><select id="${esc(id)}">${opts}</select>`;
    };
    // simpler explicit
    return `${renderProgress()}
      <h1 class="wiz-title">Datos demográficos</h1>
      <p class="sub">Opcional. Ayuda a empleadores con contratación inclusiva; puedes omitir.</p>
      <div class="card" style="text-align:left">
        <label>Raza o etnia</label>
        <select id="etnia">
          <option value=""${!f.etnia?' selected':''}>Prefiero no decir</option>
          <option value="latino"${f.etnia==='latino'?' selected':''}>Latino/Hispano</option>
          <option value="mestizo"${f.etnia==='mestizo'?' selected':''}>Mestizo</option>
          <option value="blanco"${f.etnia==='blanco'?' selected':''}>Blanco</option>
          <option value="afro"${f.etnia==='afro'?' selected':''}>Afrodescendiente</option>
          <option value="indigena"${f.etnia==='indigena'?' selected':''}>Indígena</option>
          <option value="asiatico"${f.etnia==='asiatico'?' selected':''}>Asiático</option>
          <option value="otra"${f.etnia==='otra'?' selected':''}>Otra</option>
        </select>
        <label>Nacionalidad</label>
        <select id="nacionalidad">
          <option value=""${!f.nacionalidad?' selected':''}>Prefiero no decir</option>
          <option value="cl"${f.nacionalidad==='cl'?' selected':''}>Chilena</option>
          <option value="ar"${f.nacionalidad==='ar'?' selected':''}>Argentina</option>
          <option value="pe"${f.nacionalidad==='pe'?' selected':''}>Peruana</option>
          <option value="co"${f.nacionalidad==='co'?' selected':''}>Colombiana</option>
          <option value="mx"${f.nacionalidad==='mx'?' selected':''}>Mexicana</option>
          <option value="otra"${f.nacionalidad==='otra'?' selected':''}>Otra</option>
        </select>
        <label>¿Tienes alguna discapacidad?</label>
        <select id="disability">
          <option value=""${!f.disability?' selected':''}>Prefiero no decir</option>
          <option value="no"${f.disability==='no'?' selected':''}>No</option>
          <option value="yes"${f.disability==='yes'?' selected':''}>Sí</option>
        </select>
        <label>¿Requieres ajuste razonable en el trabajo?</label>
        <select id="accommodation">
          <option value=""${!f.accommodation?' selected':''}>Prefiero no decir</option>
          <option value="no"${f.accommodation==='no'?' selected':''}>No</option>
          <option value="yes"${f.accommodation==='yes'?' selected':''}>Sí</option>
        </select>
      </div>
      <button type="button" class="btn primary" onclick="wizNext()">Continuar →</button>
      <button type="button" class="btn skip" onclick="wizNext()">Omitir</button>`;
  }

  function renderInbox() {
    const f = S.form || {};
    const alias = f.inboxAlias || (f.email ? String(f.email).split('@')[0] : '') || 'candidato';
    return `${renderProgress()}
      <h1 class="wiz-title">Crea tu bandeja Auto-Apply</h1>
      <p class="sub">Centraliza respuestas de empleadores sin saturar tu correo personal.</p>
      <div class="tiles">
        <div class="tile"><div class="ic">🛡</div><b>Anti-spam</b><small>Filtro de ruido</small></div>
        <div class="tile"><div class="ic">▤</div><b>Auto-orden</b><small>Por empresa</small></div>
        <div class="tile"><div class="ic">🤖</div><b>Sin manos</b><small>IA clasifica</small></div>
        <div class="tile"><div class="ic">🔔</div><b>Alertas</b><small>Solo lo importante</small></div>
      </div>
      <div class="card" style="margin-top:16px;text-align:left">
        <label>Tu alias de postulaciones *</label>
        <div class="inbox-alias">
          <input type="text" id="inboxAlias" value="${esc(alias)}" placeholder="tu.nombre" autocomplete="off"/>
          <span class="inbox-domain">@instawork.mail</span>
        </div>
        <p class="hint" style="margin-top:8px">Las respuestas de reclutadores llegarán aquí y te avisaremos.</p>
        <label class="chk" style="margin-top:14px">
          <input type="checkbox" id="inboxForward" ${f.inboxForward!==false?'checked':''}/>
          Reenviar copias a mi email personal
        </label>
        <label class="chk">
          <input type="checkbox" id="inboxNotify" ${f.inboxNotify!==false?'checked':''}/>
          Notificarme de respuestas y entrevistas
        </label>
      </div>
      <button type="button" class="btn primary" onclick="wizNext()">Guardar y continuar</button>`;
  }

  function renderMode() {
    return `${renderProgress()}
      <h1 class="wiz-title">¿Cómo debemos postular por ti?</h1>
      <p class="sub">Puedes cambiar el modo después en el tablero.</p>
      <div class="mode-list">
        ${modeCard('hybrid', 'Modo Híbrido', 'Recomendado', 'Auto-postulamos roles con alto match (75%+). Tú decides el resto.')}
        ${modeCard('auto', 'Modo Auto', 'Máxima velocidad', 'Totalmente automático según tus filtros. Ideal si quieres volumen.')}
        ${modeCard('review', 'Modo Revisión', 'Control total', 'Nada se envía sin tu aprobación explícita.')}
      </div>
      <button type="button" class="btn primary" onclick="wizGenKit()">Activar y continuar →</button>`;
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
    if (st.id === 'experience') {
      document.getElementById('skillInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); wizAddSkill(); }
      });
    }
    if (st.id === 'exclude') {
      document.getElementById('exclude')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); wizAddExclude(); }
      });
    }
    if (st.id === 'done') markOnboardingDoneLocal();
    bindStepEvents();
  }

  function bindStepEvents() {
    if (view._wizBound) return;
    view._wizBound = true;
    view.addEventListener('click', (e) => {
      const sel = e.target.closest('[data-wiz-select]');
      if (sel) {
        e.preventDefault();
        selectSingle(sel.dataset.wizSelect, sel.dataset.wizVal);
        return;
      }
      const tog = e.target.closest('[data-wiz-toggle]');
      if (tog) {
        e.preventDefault();
        toggleMulti(tog.dataset.wizToggle, tog.dataset.wizVal);
      }
    });
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
    const li = document.getElementById('linkedinUrl');
    if (li && li.value.trim()) { S.linkedin = li.value.trim(); S.form = S.form || {}; S.form.linkedin = S.linkedin; }
    const li2 = document.getElementById('linkedin');
    if (li2 && li2.value.trim()) { S.linkedin = li2.value.trim(); S.form = S.form || {}; S.form.linkedin = S.linkedin; }
    const terms = document.getElementById('termsAccepted');
    if (terms) { S.form = S.form || {}; S.form.termsAccepted = !!terms.checked; }
    const alias = document.getElementById('inboxAlias');
    if (alias) { S.form = S.form || {}; S.form.inboxAlias = alias.value.trim(); }
    const fwd = document.getElementById('inboxForward');
    if (fwd) { S.form = S.form || {}; S.form.inboxForward = !!fwd.checked; }
    const ntf = document.getElementById('inboxNotify');
    if (ntf) { S.form = S.form || {}; S.form.inboxNotify = !!ntf.checked; }
    if (Object.keys(S.form || {}).length) {
      try { InstaWorkEngine.setProfile(S.form); } catch (e) {}
    }
  }

  function syncPrefsToEngine() {
    try {
      const a = S.answers || {};
      InstaWorkEngine.setPreferences({
        titles: S.titles,
        country: S.country || S.form?.pais || 'Chile',
        remote: (a.workFormat || []).includes('remote'),
        skills: S.skills?.length ? S.skills : (S.cvSkills || []),
        minSalary: a.minSalary,
        workTypes: a.workTypes,
        workFormat: a.workFormat,
        benefits: a.benefits,
        companySize: a.companySize,
        teamSize: a.teamSize,
        education: a.education,
        expYears: a.expYears,
        profLevel: a.profLevel,
        goals: a.goals,
        schedule: a.schedule,
        servicePath: a.servicePath,
        remoteLocations: a.remoteLocations,
        onsiteLocations: a.onsiteLocations,
        workAuth: a.workAuth,
        workAuthCountry: a.workAuthCountry || 'Chile',
        excludeCompanies: S.excludeList || [],
        mode: S.mode,
        source: S.source
      });
      const profile = Object.assign({}, S.form || {}, {
        linkedin: S.linkedin || S.form?.linkedin || '',
        cvName: S.cv || '',
        photoName: S.photo || '',
        experience: S.experience || [],
        educationHistory: S.education || [],
        skills: S.skills?.length ? S.skills : (S.cvSkills || []),
        references: S.references || [],
        inboxAlias: S.form?.inboxAlias || '',
        onboardingComplete: false
      });
      InstaWorkEngine.setProfile(profile);
      try {
        localStorage.setItem('instawork_onboarding_answers', JSON.stringify({
          answers: a,
          titles: S.titles,
          mode: S.mode,
          experience: S.experience,
          education: S.education,
          skills: S.skills,
          excludeList: S.excludeList,
          form: S.form,
          linkedin: S.linkedin,
          savedAt: Date.now()
        }));
      } catch (e2) {}
    } catch (e) {}
  }

  /* ── window API ── */
  window.wizNext = goNext;
  window.next = goNext;

  window.wizSelect = function (key, v) { selectSingle(key, v); };
  window.wizToggle = function (key, v) { toggleMulti(key, v); };
  window.wizYesNo = function (key, v) { setVal(key, v); renderStep(); setTimeout(goNext, 300); };
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


  window.wizDropCv = function (e) {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    const input = document.getElementById('cvInput');
    if (!input) return;
    const dt = new DataTransfer();
    dt.items.add(f);
    input.files = dt.files;
    handleCv(input);
  };

  window.wizSkipCv = function () {
    S.cvSkipped = true;
    S.cv = S.cv || '';
    S.cvMsg = 'Omitido';
    clearError();
    // skip reading animation if nothing to parse
    const steps = activeSteps();
    const idx = steps.findIndex(s => s.id === 'work-status');
    if (idx >= 0) { stepIdx = idx; persist(); renderStep(); }
    else goNext();
  };

  window.wizStartLinkedinScan = function () {
    captureCurrent();
    const v = (document.getElementById('linkedinUrl')?.value || S.linkedin || '').trim();
    if (!v) { showError('Pega tu URL de LinkedIn para continuar.'); return; }
    if (!/linkedin\.com/i.test(v)) { showError('Pega una URL válida de LinkedIn (linkedin.com/in/...).'); return; }
    S.source = 'linkedin';
    S.linkedin = v;
    S.form = S.form || {};
    S.form.linkedin = v;
    S._liScanStarted = false;
    clearError();
    // advance to linkedin-scan step
    const steps = activeSteps();
    const idx = steps.findIndex(s => s.id === 'linkedin-scan');
    if (idx >= 0) { stepIdx = idx; renderStep(); }
    else goNext();
  };

  window.wizAddExp = function () {
    const f = document.getElementById('expForm');
    if (f) f.classList.remove('hidden');
  };
  window.wizSaveExp = function () {
    const title = (document.getElementById('expTitle')?.value || '').trim();
    const company = (document.getElementById('expCompany')?.value || '').trim();
    if (!title || !company) { showError('Puesto y empresa son obligatorios.'); return; }
    const cur = document.getElementById('expCurrent')?.checked;
    S.experience.push({
      title, company,
      start: document.getElementById('expStart')?.value || '',
      end: cur ? 'Actualidad' : (document.getElementById('expEnd')?.value || ''),
      desc: document.getElementById('expDesc')?.value || ''
    });
    clearError();
    renderStep();
  };
  window.wizRemoveExp = function (i) { S.experience.splice(i, 1); renderStep(); };

  window.wizAddEdu = function () {
    const f = document.getElementById('eduForm');
    if (f) f.classList.remove('hidden');
  };
  window.wizSaveEdu = function () {
    const school = (document.getElementById('eduSchool')?.value || '').trim();
    if (!school) { showError('La institución es obligatoria.'); return; }
    S.education.push({
      school,
      degree: document.getElementById('eduDegree')?.value || '',
      year: document.getElementById('eduYear')?.value || ''
    });
    clearError();
    renderStep();
  };
  window.wizRemoveEdu = function (i) { S.education.splice(i, 1); renderStep(); };

  window.wizAddSkill = function () {
    const input = document.getElementById('skillInput');
    const v = (input?.value || '').trim();
    if (!v) return;
    if (!Array.isArray(S.skills)) S.skills = [];
    if (!S.skills.map(x => x.toLowerCase()).includes(v.toLowerCase())) S.skills.push(v);
    if (input) input.value = '';
    renderStep();
  };
  window.wizRemoveSkill = function (i) { S.skills.splice(i, 1); renderStep(); };

  window.wizAddRef = function () {
    const f = document.getElementById('refForm');
    if (f) f.classList.remove('hidden');
  };
  window.wizSaveRef = function () {
    const name = (document.getElementById('refName')?.value || '').trim();
    if (!name) { showError('El nombre de la referencia es obligatorio.'); return; }
    S.references.push({
      name,
      role: document.getElementById('refRole')?.value || '',
      company: document.getElementById('refCompany')?.value || '',
      email: document.getElementById('refEmail')?.value || '',
      phone: document.getElementById('refPhone')?.value || ''
    });
    clearError();
    renderStep();
  };
  window.wizRemoveRef = function (i) { S.references.splice(i, 1); renderStep(); };

  window.wizAddExclude = function () {
    const input = document.getElementById('exclude');
    const v = (input?.value || '').trim();
    if (!v) return;
    if (!Array.isArray(S.excludeList)) S.excludeList = [];
    if (!S.excludeList.map(x => x.toLowerCase()).includes(v.toLowerCase())) S.excludeList.push(v);
    if (input) input.value = '';
    renderStep();
  };
  window.wizRemoveExclude = function (i) { S.excludeList.splice(i, 1); renderStep(); };

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
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { showError('La foto debe pesar menos de 8 MB.'); return; }
    S.photo = f.name;
    const reader = new FileReader();
    reader.onload = () => { S.photoDataUrl = reader.result; try { InstaWorkEngine.setProfile({ photoName: f.name }); } catch (e) {} renderStep(); };
    reader.readAsDataURL(f);
  };

  window.wizClearPhoto = function () {
    S.photo = '';
    S.photoDataUrl = '';
    renderStep();
  };

  function genAnim() {
    const my = stepIdx;
    [0,1,2,3].forEach(i => setTimeout(() => {
      const e = document.getElementById('g' + i);
      if (e) { e.innerHTML = e.innerHTML.replace('◦', '<span class="b">✓</span>'); e.classList.add('done'); }
    }, 600 * (i + 1)));
    setTimeout(() => { if (stepIdx === my) goNext(); }, 3000);
  }

  function markOnboardingDoneLocal() {
    try {
      syncPrefsToEngine();
      let uid = sessionStorage.getItem('instawork_uid') || InstaWorkEngine.getProfile()?.uid;
      if (uid) localStorage.setItem('instawork_done_' + uid, '1');
      localStorage.setItem('instawork_done', '1');
      const w = JSON.parse(localStorage.getItem('instawork_wizard') || '{}');
      w.completed = true; localStorage.setItem('instawork_wizard', JSON.stringify(w));
      try { InstaWorkEngine.setProfile({ onboardingComplete: true }); } catch (e2) {}
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


  restore();
  try {
    const prof = InstaWorkEngine.getProfile() || {};
    S.form = S.form || {};
    if (prof.fullname && !S.form.fullname) S.form.fullname = prof.fullname;
    if (prof.displayName && !S.form.fullname) S.form.fullname = prof.displayName;
    if (prof.name && !S.form.fullname) S.form.fullname = prof.name;
    if (prof.email && !S.form.email) S.form.email = prof.email;
    if (prof.phone && !S.form.phone) S.form.phone = prof.phone;
    if (prof.linkedin && !S.linkedin) S.linkedin = prof.linkedin;
    if (Array.isArray(prof.cvSkills) && !S.cvSkills?.length) S.cvSkills = prof.cvSkills;
  } catch (e) {}
  try {
    const uid = sessionStorage.getItem('instawork_uid') || InstaWorkEngine.getProfile()?.uid;
    if ((uid && localStorage.getItem('instawork_done_' + uid) === '1') || localStorage.getItem('instawork_done') === '1') {
      window.location.replace('dashboard.html');
    }
  } catch (e) {}
  // Reset wizard to start if corrupted step index
  try {
    const steps = activeSteps();
    if (stepIdx < 0 || stepIdx >= steps.length) stepIdx = 0;
  } catch (e) { stepIdx = 0; }
  renderStep();
})();
