(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = s => (s || '').toString().replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fitClass = f => f >= 80 ? '' : (f >= 65 ? 'mid' : 'low');
  const ageTxt = a => a == null ? '' : (a === 0 ? 'hoy' : 'hace ' + a + 'd');
  const PAGE_SIZE = 20;
  let curStatus = '', curTab = 'jobs', qrIndex = 0, jobsPage = 1;

  const TITLES = {
    dashboard: ['Auto Apply', 'Postula a empleos que cumplen tus criterios · mercado CL'],
    buscar: ['Buscar empleos', 'Explora la bolsa agregada con la regla de oro'],
    guardados: ['Guardados', 'Los empleos que marcaste con ★'],
    answers: ['Answer Library', 'Respuestas comunes reutilizables'],
    prefs: ['Preferencias', 'Tu perfil de búsqueda'],
    inbox: ['Inbox', 'Buzón dedicado'],
    docs: ['Documentos', 'CV, cartas y kits'],
    entrevista: ['Entrevista', 'Coaching con IA']
  };

  function show(view) {
    ['dashboard', 'buscar', 'guardados', 'answers', 'prefs', 'inbox', 'docs', 'entrevista'].forEach(v => {
      const el = $('v-' + v);
      if (el) el.classList.toggle('hidden', v !== view);
    });
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    $('viewTitle').textContent = TITLES[view][0];
    $('viewSub').innerHTML = TITLES[view][1];
    $('side').classList.remove('open');
    if (view === 'guardados') renderSaved();
    if (view === 'answers') renderAnswers();
    if (view === 'prefs') renderPrefs();
  }

  document.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', () => show(a.dataset.view)));
  $('hamb').addEventListener('click', () => $('side').classList.toggle('open'));

  function refreshTop() {
    const s = InstaWorkEngine.getState();
    $('credits').textContent = s.credits;
    $('mode').value = s.apply_mode;
    $('kApplied').textContent = s.total_applied || 0;
    $('kFound').textContent = s.jobs.length;
    $('stateVal').textContent = ({ idle: 'Inactivo', searching: 'Buscando…' })[s.status] || s.status;
    $('cAll').textContent = s.jobs.length;
    $('nSaved').textContent = InstaWorkEngine.getSaved().length;
    $('statePill').className = 'pill' + (s.status === 'searching' ? ' on' : '');
    $('statePill').innerHTML = '<span class="g"></span> ' + (s.status === 'searching' ? 'Buscando' : 'Inactivo');
  }

  $('mode').addEventListener('change', () => { InstaWorkEngine.setMode($('mode').value); renderQR(); });

  async function runSearch(btn) {
    const s = InstaWorkEngine.getState();
    if (!(s.preferences.titles || []).length) InstaWorkEngine.setPreferences({ titles: ['Developer', 'Ingeniero de Software'] });
    if (btn) { btn.disabled = true; btn.textContent = 'Buscando…'; }
    $('statePill').className = 'pill on';
    $('statePill').innerHTML = '<span class="g"></span> Buscando';
    try { await InstaWorkEngine.search(); } catch (e) {}
    if (btn) { btn.disabled = false; btn.textContent = 'Buscar y postular'; }
    qrIndex = 0;
    jobsPage = 1;
    refreshTop();
    renderJobs();
    renderQR();
  }

  $('searchBtn').addEventListener('click', () => runSearch($('searchBtn')));

  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    curTab = b.dataset.tab;
    $('tab-jobs').classList.toggle('hidden', curTab !== 'jobs');
    $('tab-review').classList.toggle('hidden', curTab !== 'review');
    if (curTab === 'review') renderQR();
  }));

  document.querySelectorAll('.subtabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.subtabs button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    curStatus = b.dataset.st;
    jobsPage = 1;
    renderJobs();
  }));

  $('q').addEventListener('input', () => { jobsPage = 1; renderJobs(); });
  $('sort').addEventListener('change', () => { jobsPage = 1; renderJobs(); });

  function paginate(list, page) {
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return {
      items: list.slice(start, start + PAGE_SIZE),
      page: safePage,
      totalPages,
      total,
      from: total ? start + 1 : 0,
      to: Math.min(start + PAGE_SIZE, total)
    };
  }

  function pageButtons(current, totalPages) {
    const pages = [];
    const add = (n) => { if (n >= 1 && n <= totalPages && !pages.includes(n)) pages.push(n); };
    add(1);
    add(current - 1);
    add(current);
    add(current + 1);
    add(totalPages);
    pages.sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < pages.length; i++) {
      if (i > 0 && pages[i] - pages[i - 1] > 1) out.push('…');
      out.push(pages[i]);
    }
    return out;
  }

  function renderPager(elId, info) {
    const el = $(elId);
    if (!el) return;
    if (!info.total) {
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }
    el.classList.remove('hidden');
    const buttons = pageButtons(info.page, info.totalPages).map((item) => {
      if (item === '…') return '<span class="pager-ellipsis">…</span>';
      return `<button type="button" class="pager-btn${item === info.page ? ' active' : ''}" data-page="${item}">${item}</button>`;
    }).join('');
    el.innerHTML = `
      <div class="pager-meta">Mostrando <b>${info.from}–${info.to}</b> de <b>${info.total}</b></div>
      <div class="pager-controls">
        <button type="button" class="pager-btn pager-nav" data-page="${info.page - 1}" ${info.page <= 1 ? 'disabled' : ''}>‹ Anterior</button>
        ${buttons}
        <button type="button" class="pager-btn pager-nav" data-page="${info.page + 1}" ${info.page >= info.totalPages ? 'disabled' : ''}>Siguiente ›</button>
      </div>`;
  }

  function jobRow(x) {
    const stc = { ready: 'ready', applied: 'applied', declined: 'declined' }[x.status] || 'ready';
    const stl = { ready: 'En cola', applied: 'Postulado', declined: 'Descartado' }[x.status] || x.status;
    const ini = (x.company_name || '?').trim().charAt(0).toUpperCase();
    return `<tr><td><div class="co"><div class="avatar">${ini}</div><div><div style="font-weight:600">${esc(x.company_name || '—')}</div><span class="st ${stc}">${stl}</span></div></div></td>
      <td>${esc(x.job_title || '')} <span class="match ${fitClass(x.fit_score)}">▲ ${x.fit_score}</span><span class="src">${esc(x.ats || '')}</span></td>
      <td class="fresh">${ageTxt(x.age_days)}</td>
      <td><button class="linkbtn" data-open="${esc(x.job_link)}">Abrir ↗</button> · <button class="linkbtn" data-save="${x.id}">${x.saved ? '★' : '☆'}</button></td></tr>`;
  }

  function renderJobs() {
    const s = InstaWorkEngine.getState();
    const term = ($('q').value || '').toLowerCase();
    const sort = $('sort').value;
    let list = s.jobs.filter(x => !curStatus || x.status === curStatus);
    if (term) list = list.filter(x => ((x.job_title || '') + ' ' + (x.company_name || '')).toLowerCase().includes(term));
    list = [...list].sort((a, b) => sort === 'published_at' ? (a.age_days - b.age_days) : (b.fit_score - a.fit_score));
    const paged = paginate(list, jobsPage);
    jobsPage = paged.page;
    $('rows').innerHTML = paged.items.length
      ? paged.items.map(jobRow).join('')
      : '<tr><td colspan="4" class="empty">Sin empleos en esta vista.</td></tr>';
    renderPager('jobsPager', paged);
  }

  function renderQR() {
    const ready = InstaWorkEngine.getReady();
    const s = InstaWorkEngine.getState();
    if (!ready.length) {
      $('qr').innerHTML = '<div class="qrcard empty">No hay empleos por revisar. Pulsa <b>Buscar y postular</b>.</div>';
      return;
    }
    if (qrIndex >= ready.length) qrIndex = 0;
    const j = ready[qrIndex];
    const modeNote = s.apply_mode === 'auto'
      ? '<div class="note">⚡ <b>Auto mode:</b> los de alto fit (≥75) van marcados como recomendados. El envío 100% automático al formulario del ATS llega en la Fase 2; por ahora confírmalos aquí (te abrimos la oferta real).</div>'
      : s.apply_mode === 'hybrid'
        ? '<div class="note">🔀 <b>Hybrid:</b> te recomendamos los de fit ≥75; tú decides el resto.</div>' : '';
    const matches = (j.key_matches || []).map(m => `<div class="li">✓ ${esc(m)}</div>`).join('') || '<div class="li gap">—</div>';
    const gaps = (j.key_gaps || []).map(m => `<div class="li gap">• ${esc(m)}</div>`).join('') || '<div class="li gap">Sin brechas relevantes</div>';
    $('qr').innerHTML = `${modeNote}<div class="qrcard">
      <div class="qrhead"><div><h2>${esc(j.job_title)}${j.recommended ? ' <span class="src" style="border-color:var(--green);color:var(--green)">recomendado</span>' : ''}</h2><div class="cmp">${esc(j.company_name || '—')} · <span class="src">${esc(j.ats)}</span> · ${ageTxt(j.age_days)}</div></div>
        <div class="fitbig ${fitClass(j.fit_score)}">${j.fit_score}/100<br><small>${j.fit_score >= 80 ? 'Buen match' : j.fit_score >= 65 ? 'Match medio' : 'Match bajo'}</small></div></div>
      <div class="cols"><div><h4>✓ Coincidencias</h4>${matches}</div><div><h4>Brechas</h4>${gaps}</div></div>
      <div class="qractions">
        <button class="btn decline" data-act="decline" data-id="${j.id}">Descartar</button>
        <button class="btn skip" data-act="skip" data-id="${j.id}">Saltar</button>
        <button class="btn ghost" data-act="save" data-id="${j.id}">${j.saved ? '★ Guardado' : '☆ Guardar'}</button>
        <button class="btn apply" data-act="apply" data-id="${j.id}" data-link="${esc(j.job_link)}">Postular (1 crédito) ↗</button>
      </div>
      <p class="sub" style="text-align:center;margin-top:10px">${qrIndex + 1} de ${ready.length} · al postular te abrimos la oferta real para completar el envío en el portal.</p></div>`;
  }

  document.addEventListener('click', e => {
    const pageBtn = e.target.closest('#jobsPager [data-page]');
    if (pageBtn && !pageBtn.disabled) {
      const nextPage = +pageBtn.dataset.page;
      if (nextPage >= 1) {
        jobsPage = nextPage;
        renderJobs();
        $('rows')?.closest('.card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      return;
    }

    const t = e.target.closest('[data-act],[data-open],[data-save]');
    if (!t) return;
    if (t.dataset.open) { window.open(t.dataset.open, '_blank', 'noopener'); return; }
    if (t.dataset.save) { InstaWorkEngine.toggleSave(t.dataset.save); refreshTop(); renderJobs(); renderSaved(); return; }
    const id = t.dataset.id;
    const act = t.dataset.act;
    if (act === 'apply') {
      const r = InstaWorkEngine.applyJob(id);
      if (!r.ok && r.error === 'sin_creditos') { alert('Sin créditos. (En el producto final se compran o se ganan por referidos.)'); return; }
      if (t.dataset.link) window.open(t.dataset.link, '_blank', 'noopener');
      refreshTop();
      renderJobs();
      renderQR();
    } else if (act === 'decline') {
      InstaWorkEngine.declineJob(id);
      refreshTop();
      renderJobs();
      renderQR();
    } else if (act === 'skip') {
      InstaWorkEngine.skipJob(id);
      qrIndex++;
      renderQR();
    } else if (act === 'save') {
      InstaWorkEngine.toggleSave(id);
      renderQR();
      refreshTop();
    }
  });

  $('bsearch').addEventListener('click', async () => {
    const q = ($('bq').value || '').split(',').map(x => x.trim()).filter(Boolean);
    InstaWorkEngine.setPreferences({ titles: q.length ? q : ['Developer'], country: $('bcountry').value || 'Chile', remote: true });
    $('bsearch').disabled = true;
    $('bsearch').textContent = 'Buscando…';
    try { await InstaWorkEngine.search(); } catch (e) {}
    $('bsearch').disabled = false;
    $('bsearch').textContent = 'Buscar';
    const list = InstaWorkEngine.getState().jobs.slice(0, 50);
    $('brows').innerHTML = list.length ? list.map(jobRow).join('') : '<tr><td colspan="4" class="empty">Sin resultados.</td></tr>';
    refreshTop();
    renderJobs();
    renderQR();
  });

  function renderSaved() {
    const list = InstaWorkEngine.getSaved();
    $('srows').innerHTML = list.length ? list.map(jobRow).join('') : '<tr><td colspan="4" class="empty">Aún no guardas empleos.</td></tr>';
  }

  function renderAnswers() {
    const a = InstaWorkEngine.getAnswers();
    $('qalist').innerHTML = a.length
      ? a.map((x, i) => `<div class="qa"><b style="flex:1">${esc(x.q)}</b><span style="flex:1;color:var(--muted)">${esc(x.a)}</span><button class="linkbtn" data-delqa="${i}">✕</button></div>`).join('')
      : '<p class="sub">Aún no agregas respuestas.</p>';
  }

  $('qaadd').addEventListener('click', () => {
    const q = $('qaq').value.trim();
    const a = $('qaa').value.trim();
    if (!q || !a) return;
    const arr = InstaWorkEngine.getAnswers();
    arr.push({ q, a });
    InstaWorkEngine.setAnswers(arr);
    $('qaq').value = '';
    $('qaa').value = '';
    renderAnswers();
  });

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-delqa]');
    if (!t) return;
    const arr = InstaWorkEngine.getAnswers();
    arr.splice(+t.dataset.delqa, 1);
    InstaWorkEngine.setAnswers(arr);
    renderAnswers();
  });

  function renderPrefs() {
    const s = InstaWorkEngine.getState();
    const p = s.preferences;
    const pr = s.profile || {};
    $('prefbody').innerHTML = `<b>Nombre:</b> ${esc(pr.fullname || '—')}<br><b>Roles:</b> ${esc((p.titles || []).join(', ') || '—')}<br><b>País:</b> ${esc(p.country || '—')} · <b>Remoto:</b> ${p.remote ? 'sí' : 'no'}<br><b>Modo:</b> ${esc(s.apply_mode)} · <b>Frescura máx:</b> ${s.max_age_days} días · <b>Fit mínimo:</b> ${s.min_fit}<br><b>Créditos:</b> ${s.credits}`;
  }

  refreshTop();
  renderJobs();
  renderQR();
})();
