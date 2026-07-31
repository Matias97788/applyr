/* Hydrate onboarding prefs into engine (instaWork) */
(function hydrateOnboardingPrefs() {
  try {
    var raw = localStorage.getItem('instawork_onboarding_answers');
    if (!raw || !window.InstaWorkEngine) return;
    var o = JSON.parse(raw);
    var prefs = Object.assign({}, o.answers || {}, {
      titles: o.titles || [],
      mode: o.mode,
      skills: o.skills || [],
      excludeCompanies: o.excludeList || []
    });
    InstaWorkEngine.setPreferences(prefs);
    if (o.form || o.experience || o.linkedin) {
      InstaWorkEngine.setProfile(Object.assign({}, o.form || {}, {
        experience: o.experience || [],
        educationHistory: o.education || [],
        skills: o.skills || [],
        linkedin: o.linkedin || (o.form && o.form.linkedin) || ''
      }));
    }
  } catch (e) {}
})();

(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = s => (s || '').toString().replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fitClass = f => f >= 80 ? '' : (f >= 65 ? 'mid' : 'low');
  const ageTxt = a => a == null ? '' : (a === 0 ? 'hoy' : 'hace ' + a + 'd');
  const PAGE_SIZE = 20;

  let curStatus = '', curTab = 'jobs', qrIndex = 0, jobsPage = 1;
  let drawerJobId = null, drawerTab = 'overview', kitView = 'list', buscarWm = 'all';

  const TITLES = {
    dashboard: ['Auto Apply', 'Postula automáticamente a empleos que coinciden contigo'],
    buscar: ['Buscar empleos', 'Bolsa interna con scraper de +1M empleos/mes'],
    guardados: ['Guardados', 'Empleos que marcaste con ★'],
    answers: ['Preferencias', 'Answer Library y ajustes de Auto Apply'],
    prefs: ['Preferencias', 'Tu perfil de búsqueda y comportamiento'],
    cuenta: ['Mi cuenta', 'Perfil, configuración y sesión'],
    inbox: ['Inbox', 'Respuestas de reclutadores y confirmaciones'],
    jobhub: ['Job Hub', 'Application Kits y pipeline'],
    resumes: ['Mis currículums', 'CVs para tus postulaciones'],
    coverletters: ['Cartas de presentación', 'Genera y reutiliza cartas con IA'],
    buddy: ['Interview Buddy', 'Asistencia en entrevistas en tiempo real'],
    mock: ['Mock Interviews', 'Practica entrevistas simuladas'],
    settings: ['Configuración', 'Cuenta, notificaciones y facturación']
  };

  const MODE_LABELS = {
    auto: '⚡ Auto mode',
    hybrid: '🔀 Hybrid mode',
    review: '👁 Review mode'
  };

  function showToast(msg, type) {
    let el = document.getElementById('iwToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'iwToast';
      el.className = 'iw-toast';
      document.body.appendChild(el);
    }
    el.className = 'iw-toast' + (type === 'error' ? ' iw-toast--error' : type === 'ok' ? ' iw-toast--ok' : '');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.remove('show'), 4500);
  }

  function setSearchUI(busy, hint) {
    const btn = $('searchBtn');
    const refresh = $('refreshJobsBtn');
    if (btn) { btn.disabled = busy; btn.textContent = busy ? 'Buscando…' : 'Buscar empleos'; }
    if (refresh) refresh.disabled = busy;
    if (hint && $('statusHint')) $('statusHint').textContent = hint;
  }

  function syncPrefsFromWizard() {
    try {
      const w = JSON.parse(localStorage.getItem('instawork_wizard') || '{}');
      const s = InstaWorkEngine.getState();
      if (w.titles && w.titles.length && !(s.preferences.titles || []).length) {
        InstaWorkEngine.setPreferences({ titles: w.titles, country: w.country || w.pais_busqueda || 'Chile', remote: true, skills: w.cvSkills || [] });
      }
    } catch (e) {}
  }

  function show(view) {
    Object.keys(TITLES).forEach(v => {
      const el = $('v-' + v);
      if (el) el.classList.toggle('hidden', v !== view);
    });
    document.querySelectorAll('.nav a[data-view]').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    document.querySelectorAll('.bottom-nav button[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    if (TITLES[view]) {
      $('viewTitle').textContent = TITLES[view][0];
      $('viewSub').textContent = TITLES[view][1];
    }
    $('side')?.classList.remove('open');
    const renderers = {
      guardados: renderSaved, answers: renderAnswersView, prefs: renderPrefs,
      cuenta: () => { renderAccount(); window.iwPaintUser?.(); },
      inbox: renderInbox, jobhub: renderJobHub, resumes: renderResumes,
      coverletters: renderCoverLetters, mock: renderMockInterviews, settings: renderSettings,
      dashboard: () => { renderJobs(); renderQR(); }
    };
    renderers[view]?.();
    refreshTop();
  }

  window.iwShowView = show;
  window.iwRefreshUI = refreshTop;

  document.querySelectorAll('.nav a[data-view]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); show(a.dataset.view); }));
  document.querySelectorAll('.bottom-nav button[data-view]').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
  $('hamb')?.addEventListener('click', () => $('side').classList.toggle('open'));
  document.querySelectorAll('[data-view-jump]').forEach(b => b.addEventListener('click', () => show(b.dataset.viewJump)));

  function refreshTop() {
    const s = InstaWorkEngine.getState();
    $('credits').textContent = s.credits ?? 0;
    $('modeBtn').textContent = MODE_LABELS[s.apply_mode] || MODE_LABELS.review;
    $('kApplied').textContent = s.total_applied || 0;
    $('kFound').textContent = s.jobs.length;
    $('cAll').textContent = s.jobs.length;
    $('cReview').textContent = s.jobs.filter(j => j.status === 'ready').length;
    $('cApplied').textContent = s.jobs.filter(j => j.status === 'applied').length;
    $('cDeclined').textContent = s.jobs.filter(j => j.status === 'declined').length;
    $('nSaved').textContent = InstaWorkEngine.getSaved().length;

    const active = s.queue_active;
    $('statusLabel').textContent = active ? 'Activo' : 'Pausado';
    $('statusHint').textContent = active ? 'Auto Apply está buscando y postulando' : 'Pulsa Iniciar para seguir postulando';
    $('statusDot').classList.toggle('on', active);
    $('queueToggle').textContent = active ? '⏸' : '▶';
    $('queueToggle').classList.toggle('is-pause', active);
    $('queueToggle').setAttribute('aria-label', active ? 'Pausar' : 'Iniciar');

    const unreadInbox = (s.inbox || []).filter(m => !m.read).length;
    const unreadNotif = (s.notifications || []).filter(n => !n.read).length;
    $('nInbox').textContent = unreadInbox;
    $('bnInbox').textContent = unreadInbox;
    $('bnNotif').textContent = unreadNotif;
    $('bnInbox').style.display = unreadInbox ? '' : 'none';
    $('bnNotif').style.display = unreadNotif ? '' : 'none';

    const pending = InstaWorkEngine.getPendingAnswersCount();
    const badge = $('pendingAnswersBadge');
    if (badge) { badge.textContent = pending; badge.style.display = pending ? '' : 'none'; }
    renderAgent();
  }

  function paginate(list, page) {
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return { items: list.slice(start, start + PAGE_SIZE), page: safePage, totalPages, total, from: total ? start + 1 : 0, to: Math.min(start + PAGE_SIZE, total) };
  }

  function renderPager(elId, info, onPage) {
    const el = $(elId);
    if (!el) return;
    if (!info.total) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    el.classList.remove('hidden');
    el.innerHTML = `<div class="pager-meta">${info.from}–${info.to} de <b>${info.total}</b></div>
      <div class="pager-controls">
        <button type="button" class="pager-btn pager-nav" data-pg="${info.page - 1}" ${info.page <= 1 ? 'disabled' : ''}>←</button>
        <span class="pager-meta">${info.page} de ${info.totalPages}</span>
        <button type="button" class="pager-btn pager-nav" data-pg="${info.page + 1}" ${info.page >= info.totalPages ? 'disabled' : ''}>→</button>
      </div>`;
    el.querySelectorAll('[data-pg]').forEach(btn => btn.addEventListener('click', () => {
      const p = +btn.dataset.pg;
      if (p >= 1 && p <= info.totalPages) onPage(p);
    }));
  }

  function jobCard(x) {
    const ini = (x.company_name || '?').trim().charAt(0).toUpperCase();
    const stl = { ready: 'En cola', applied: 'Auto-aplicado', declined: 'Descartado' }[x.status] || x.status;
    const badge = x.status === 'applied' ? '<span class="badge-auto">Auto-aplicado</span>' : `<span class="st ${x.status}">${stl}</span>`;
    return `<article class="job-card" data-job="${esc(x.id)}">
      <div>
        <div class="job-card-top"><div class="avatar">${ini}</div><div><strong>${esc(x.company_name || '—')}</strong></div>${badge}</div>
        <h3>${esc(x.job_title || '')}</h3>
        <div class="job-card-meta">
          <span class="match-pill ${fitClass(x.fit_score)}">▲ ${x.fit_score}</span>
          <span>${ageTxt(x.age_days)}</span>
          <span class="src">${esc(x.ats || '')}</span>
        </div>
      </div>
      <div class="job-card-actions">
        <button type="button" class="btn ghost sm" data-open-job="${esc(x.id)}">Abrir</button>
        <button type="button" class="linkbtn" data-save="${esc(x.id)}">${x.saved ? '★' : '☆'}</button>
      </div>
    </article>`;
  }

  function renderJobs() {
    const s = InstaWorkEngine.getState();
    const term = ($('q')?.value || '').toLowerCase();
    const sort = $('sort')?.value || 'fit_score';
    let list = s.jobs.filter(x => !curStatus || x.status === curStatus);
    if (term) list = list.filter(x => ((x.job_title || '') + ' ' + (x.company_name || '')).toLowerCase().includes(term));
    list = [...list].sort((a, b) => sort === 'published_at' ? (a.age_days - b.age_days) : (b.fit_score - a.fit_score));
    const paged = paginate(list, jobsPage);
    jobsPage = paged.page;
    const el = $('jobList');
    if (!el) return;
    el.innerHTML = paged.items.length ? paged.items.map(jobCard).join('') : '<div class="empty-state"><p>Sin empleos en esta vista. Pulsa <b>Buscar empleos</b>.</p></div>';
    renderPager('jobsPager', paged, p => { jobsPage = p; renderJobs(); });
  }

  function renderQR() {
    const s = InstaWorkEngine.getState();
    const working = $('qrWorking');
    const qr = $('qr');
    if (s.queue_active && s.apply_mode === 'auto') {
      working?.classList.remove('hidden');
      qr?.classList.add('hidden');
      return;
    }
    working?.classList.add('hidden');
    qr?.classList.remove('hidden');
    const ready = InstaWorkEngine.getReady();
    if (!ready.length) {
      if (qr) qr.innerHTML = '<div class="qrcard empty">No hay empleos por revisar. Pulsa <b>Buscar empleos</b> o <b>Iniciar</b>.</div>';
      return;
    }
    if (qrIndex >= ready.length) qrIndex = 0;
    const j = ready[qrIndex];
    const modeNote = {
      auto: '⚡ <b>Auto mode:</b> postulamos automáticamente a matches ≥75.',
      hybrid: '🔀 <b>Hybrid:</b> recomendamos ≥75; tú decides el resto.',
      review: '👁 <b>Review mode:</b> nada se envía sin tu aprobación.'
    }[s.apply_mode] || '';
    const matches = (j.key_matches || []).map(m => `<div class="li">✓ ${esc(m)}</div>`).join('') || '<div class="li gap">—</div>';
    const gaps = (j.key_gaps || []).map(m => `<div class="li gap">• ${esc(m)}</div>`).join('') || '<div class="li gap">Sin brechas relevantes</div>';
    if (qr) qr.innerHTML = `<div class="note">${modeNote}</div><div class="qrcard">
      <div class="qrhead"><div><h2>${esc(j.job_title)}${j.recommended ? ' <span class="src" style="border-color:var(--green);color:var(--green)">recomendado</span>' : ''}</h2>
        <div class="cmp">${esc(j.company_name || '—')} · ${ageTxt(j.age_days)}</div></div>
        <div class="fitbig ${fitClass(j.fit_score)}">${j.fit_score}/100</div></div>
      <div class="cols"><div><h4>✓ Coincidencias</h4>${matches}</div><div><h4>Brechas</h4>${gaps}</div></div>
      <div class="qractions">
        <button class="btn decline" data-act="decline" data-id="${esc(j.id)}">Descartar</button>
        <button class="btn skip" data-act="skip" data-id="${esc(j.id)}">Saltar</button>
        <button class="btn ghost" data-act="save" data-id="${esc(j.id)}">${j.saved ? '★ Guardado' : '☆ Guardar'}</button>
        <button class="btn apply" data-act="apply" data-id="${esc(j.id)}">Postular (1 crédito)</button>
      </div>
      <p class="sub" style="text-align:center;margin-top:10px">${qrIndex + 1} de ${ready.length}</p></div>`;
  }

  function openJobDrawer(id) {
    const s = InstaWorkEngine.getState();
    const j = s.jobs.find(x => x.id === id);
    if (!j) return;
    drawerJobId = id;
    drawerTab = 'overview';
    $('drawerTitle').textContent = j.job_title || '—';
    $('drawerMeta').textContent = `${j.company_name || '—'} · ${j.is_remote ? 'Remoto' : (j.full_location || '—')}`;
    $('drawerBackdrop').classList.remove('hidden');
    $('jobDrawer').classList.remove('hidden');
    document.querySelectorAll('.drawer-tabs button').forEach(b => b.classList.toggle('active', b.dataset.dtab === 'overview'));
    renderDrawerBody();
  }

  function closeDrawer() {
    drawerJobId = null;
    $('drawerBackdrop')?.classList.add('hidden');
    $('jobDrawer')?.classList.add('hidden');
  }

  function renderDrawerBody() {
    const s = InstaWorkEngine.getState();
    const j = s.jobs.find(x => x.id === drawerJobId);
    const body = $('drawerBody');
    if (!j || !body) return;

    if (drawerTab === 'overview') {
      body.innerHTML = `<div class="drawer-section">
        <p><span class="badge-auto">${j.status === 'applied' ? 'Auto-aplicado' : j.status}</span></p>
        <p class="match-pill ${fitClass(j.fit_score)}" style="display:inline-block;margin-top:8px">Match ${j.fit_score}/100</p>
        <p style="margin-top:12px"><a href="${esc(j.job_link)}" target="_blank" rel="noopener" class="linkbtn">Ver oferta original ↗</a></p>
      </div>`;
    } else if (drawerTab === 'application') {
      if (j.status !== 'applied') {
        body.innerHTML = '<p class="sub">Aún no se ha enviado la postulación. Pulsa <b>Postular</b> en Quick Review.</p>';
        return;
      }
      const cl = j.cover_letter || InstaWorkEngine.generateCoverLetter(j, s);
      const answers = j.application_answers || InstaWorkEngine.buildApplicationAnswers(j, s);
      body.innerHTML = `<div class="drawer-section"><h4>Carta de presentación</h4><div class="cover-letter-box">${esc(cl)}</div></div>
        <div class="drawer-section"><h4>Currículum</h4><p>📄 ${esc(j.resume_name || 'CV optimizado')}.pdf</p></div>
        <div class="drawer-section"><h4>Preguntas de la postulación</h4>
          ${answers.map(a => `<div class="qa-row"><span>${esc(a.q)}</span><strong>${esc(a.a)}</strong></div>`).join('')}
        </div>`;
    } else {
      const matches = (j.key_matches || []).map(m => `<div class="li">✓ ${esc(m)}</div>`).join('') || '—';
      const gaps = (j.key_gaps || []).map(m => `<div class="li gap">• ${esc(m)}</div>`).join('') || 'Sin brechas';
      body.innerHTML = `<div class="fitbig ${fitClass(j.fit_score)}" style="display:inline-block;margin-bottom:16px">${j.fit_score}/100</div>
        <div class="cols"><div><h4>Coincidencias</h4>${matches}</div><div><h4>Brechas</h4>${gaps}</div></div>`;
    }
  }

  function renderInbox() {
    const s = InstaWorkEngine.getState();
    $('proxyEmailLine').textContent = InstaWorkEngine.getProxyEmail();
    const unreadOnly = $('inboxUnreadOnly')?.checked;
    const label = $('inboxLabelFilter')?.value;
    let list = s.inbox || [];
    if (unreadOnly) list = list.filter(m => !m.read);
    if (label) list = list.filter(m => m.label === label);
    const el = $('inboxList');
    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><p>Sin mensajes aún. Al postular, las confirmaciones aparecerán aquí.</p></div>';
      return;
    }
    el.innerHTML = list.map(m => {
      const lbl = (m.label || '').toLowerCase();
      const cls = lbl.includes('assessment') ? 'assessment' : lbl.includes('no') ? 'reject' : '';
      const d = new Date(m.at);
      const time = d.toLocaleDateString('es', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `<div class="inbox-item${m.read ? '' : ' unread'}" data-inbox="${esc(m.id)}">
        <span class="inbox-label ${cls}">${esc(m.label || 'Email')}</span>
        <div><strong>${esc(m.from)}</strong><div>${esc(m.subject)}</div><p class="sub">${esc(m.preview)}</p></div>
        <small>${time}</small>
      </div>`;
    }).join('');
  }

  function renderAnswersView() {
    const s = InstaWorkEngine.getState();
    const pending = InstaWorkEngine.getPendingAnswersCount();
    const alert = $('answersAlert');
    if (pending) {
      alert?.classList.remove('hidden');
      $('answersAlertText').textContent = `${pending} preguntas comunes sin responder`;
    } else alert?.classList.add('hidden');

    const modes = [
      { id: 'auto', t: 'Auto mode', d: 'Totalmente automático. Máxima velocidad.' },
      { id: 'hybrid', t: 'Hybrid mode', d: 'Auto-aplica si match ≥75%. Tú decides el resto.' },
      { id: 'review', t: 'Review mode', d: 'Nada se envía sin tu aprobación.' }
    ];
    $('modeCards').innerHTML = modes.map(m => `<div class="mode-card${s.apply_mode === m.id ? ' active' : ''}" data-set-mode="${m.id}"><strong>${m.t}</strong><small>${m.d}</small></div>`).join('');
    $('prefTitles').innerHTML = (s.preferences.titles || []).map(t => `<span>${esc(t)}</span>`).join('') || '<span class="sub">Sin roles definidos</span>';
    renderAnswers();
    renderRejections();
    renderCommonQa();
  }

  function renderCommonQa() {
    const s = InstaWorkEngine.getState();
    const answered = {};
    (s.answers || []).forEach(a => { answered[a.q] = a.a; });
    $('commonQaList').innerHTML = InstaWorkEngine.getCommonQuestions().map(q => {
      const a = answered[q.q];
      return `<div class="common-qa${a ? '' : ' missing'}"><strong>${esc(q.q)}</strong><p>${a ? esc(a) : 'Sin responder'}</p></div>`;
    }).join('');
  }

  function renderRejections() {
    const list = InstaWorkEngine.getRejectionReasons();
    $('rejectList').innerHTML = list.length
      ? list.map(r => `<div class="qa"><b>${esc(r.pattern)}</b><button class="linkbtn" data-delreject="${esc(r.id)}">✕</button></div>`).join('')
      : '<p class="sub">Sin filtros de rechazo aún.</p>';
  }

  function renderAnswers() {
    const a = InstaWorkEngine.getAnswers();
    $('qalist').innerHTML = a.length
      ? a.map((x, i) => `<div class="qa"><b style="flex:1">${esc(x.q)}</b><span style="flex:1;color:var(--muted)">${esc(x.a)}</span><button class="linkbtn" data-delqa="${i}">✕</button></div>`).join('')
      : '';
  }

  function renderSaved() {
    const list = InstaWorkEngine.getSaved();
    $('savedEmpty').classList.toggle('hidden', !!list.length);
    $('savedList').classList.toggle('hidden', !list.length);
    if (list.length) $('savedList').innerHTML = list.map(jobCard).join('');
  }

  function renderJobHub() {
    const kits = InstaWorkEngine.getApplicationKits();
    const applied = InstaWorkEngine.getApplied();
    $('kitListView').classList.toggle('hidden', kitView === 'kanban');
    $('kitKanbanView').classList.toggle('hidden', kitView !== 'kanban');
    if (kitView === 'list') {
      const items = kits.length ? kits : applied.slice(0, 5).map(j => ({ id: j.id, name: j.job_title, stage: 'applied', company: j.company_name }));
      $('kitListView').innerHTML = items.length
        ? items.map(k => `<div class="kit-card"><strong>${esc(k.name)}</strong><p class="sub">${esc(k.company || '')} · ${esc(k.stage || 'applied')}</p></div>`).join('')
        : '<div class="empty-state"><p>Sin Application Kits. Crea uno o postula a empleos.</p></div>';
    } else {
      const cols = ['En cola', 'Postulado', 'Entrevista', 'Oferta'];
      $('kitKanbanView').innerHTML = cols.map((c, i) => {
        const stageJobs = applied.filter((_, idx) => idx % 4 === i);
        return `<div class="kanban-col"><h4>${c}</h4>${stageJobs.map(j => `<div class="kanban-card">${esc(j.job_title)}<br><small>${esc(j.company_name)}</small></div>`).join('') || '<p class="sub">Vacío</p>'}</div>`;
      }).join('');
    }
  }

  function renderResumes() {
    const list = InstaWorkEngine.getResumes();
    $('resumeGrid').innerHTML = list.map(r => `<div class="resume-card${r.used ? ' active' : ''}">
      <strong>${esc(r.name)}</strong>
      <p class="sub">${r.type === 'optimized' ? 'CV optimizado con IA' : 'CV original'} · ${r.views || 0} vistas</p>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        ${!r.used ? `<button class="btn ghost sm" data-use-resume="${esc(r.id)}">Usar este CV</button>` : '<span class="badge-auto">En uso</span>'}
        <button class="btn ghost sm">Descargar PDF</button>
      </div>
    </div>`).join('');
  }

  function renderCoverLetters() {
    const list = InstaWorkEngine.getCoverLetters();
    $('coverList').innerHTML = list.length
      ? list.map(c => `<div class="doc-card"><strong>${esc(c.title)}</strong><p class="sub">${new Date(c.created_at).toLocaleDateString('es')}</p></div>`).join('')
      : '<div class="empty-state"><h3>Sin cartas</h3><p>Crea tu primera carta de presentación.</p></div>';
  }

  function renderMockInterviews() {
    const list = InstaWorkEngine.getMockInterviews();
    $('mockList').innerHTML = list.length
      ? list.map(m => `<div class="doc-card"><strong>${esc(m.role)}</strong><p class="sub">${new Date(m.created_at).toLocaleDateString('es')}</p></div>`).join('')
      : '<div class="empty-state"><h3>Sin mock interviews</h3><p>Crea tu primera sesión de práctica.</p></div>';
  }

  function renderSettings() {
    const s = InstaWorkEngine.getState();
    $('setProxyEmail').value = InstaWorkEngine.getProxyEmail();
    $('setLang').value = s.settings?.language || 'es';
    $('setMarketing').checked = s.settings?.marketing_cookies !== false;
    renderPrefGrid('settingsPersonal');
    const notifs = s.notifications || [];
    $('notifList').innerHTML = notifs.length
      ? notifs.map(n => `<div class="notif-item${n.read ? '' : ' unread'}"><strong>${esc(n.title)}</strong><p class="sub">${esc(n.body)}</p></div>`).join('')
      : '<p class="sub">Sin notificaciones.</p>';
  }

  function renderAgent() {
    const s = InstaWorkEngine.getState();
    const p = s.profile || {};
    const name = p.fullname || p.email?.split('@')[0] || 'Usuario';
    const roles = (s.preferences.titles || []).slice(0, 2).join(', ') || 'tus roles objetivo';
    const msg = s.queue_active
      ? `¡Hola ${esc(name)}! 👋 Tu cola está <b>activa</b>. Estamos buscando empleos para ${esc(roles)}.`
      : `¡Hola ${esc(name)}! 👋 Tu cola está <b>pausada</b>. ¿Reanudamos postulaciones para ${esc(roles)}?`;
    $('agentMessages').innerHTML = `<div class="agent-bubble">${msg}</div>`;
  }

  function accountRows() {
    const s = InstaWorkEngine.getState();
    const p = s.profile || {};
    const pref = s.preferences || {};
    const provider = p.provider === 'google.com' ? 'Google' : (p.provider === 'password' ? 'Email' : '—');
    return [
      ['Nombre', p.fullname || '—'], ['Email', p.email || '—'], ['Acceso', provider],
      ['Email de postulaciones', InstaWorkEngine.getProxyEmail()],
      ['Roles', (pref.titles || []).join(', ') || '—'], ['País', pref.country || '—'],
      ['Modo', s.apply_mode || '—'], ['Créditos', String(s.credits ?? '—')],
      ['Límite diario', String(s.daily_limit || 10)]
    ];
  }

  function renderPrefGrid(targetId) {
    const el = $(targetId);
    if (!el) return;
    el.innerHTML = accountRows().map(([k, v]) => `<div class="pref-row"><span class="pref-key">${esc(k)}</span><span class="pref-val">${esc(v)}</span></div>`).join('');
  }

  function renderPrefs() {
    const s = InstaWorkEngine.getState();
    $('dailyLimit').value = s.daily_limit || 10;
    renderPrefGrid('prefbody');
  }

  function renderAccount() { renderPrefGrid('accountBody'); }

  async function runSearch() {
    const s = InstaWorkEngine.getState();
    if (!(s.preferences.titles || []).length) {
      syncPrefsFromWizard();
      const s2 = InstaWorkEngine.getState();
      if (!(s2.preferences.titles || []).length) {
        InstaWorkEngine.setPreferences({ titles: ['developer', 'desarrollador'], country: 'Chile', remote: true });
      }
    }
    setSearchUI(true, 'Buscando empleos en varias fuentes…');
    try {
      const result = await InstaWorkEngine.search(msg => setSearchUI(true, msg));
      qrIndex = 0;
      jobsPage = 1;
      refreshTop();
      renderJobs();
      renderQR();
      if (result.added > 0) {
        showToast('+' + result.added + ' empleos nuevos (' + result.collected + ' revisados)', 'ok');
      } else if (result.collected > 0) {
        showToast('Se revisaron ' + result.collected + ' empleos pero ninguno nuevo pasó los filtros.', 'error');
      } else {
        showToast('No se obtuvieron resultados. Revisa tu conexión.', 'error');
      }
      if (InstaWorkEngine.getState().queue_active) {
        const batch = InstaWorkEngine.autoApplyBatch();
        if (batch.applied) showToast('Auto-aplicado a ' + batch.applied + ' empleos.', 'ok');
        refreshTop();
        renderJobs();
      }
    } catch (e) {
      showToast('Error al buscar: ' + (e.message || 'desconocido'), 'error');
    } finally {
      setSearchUI(false, InstaWorkEngine.getState().queue_active ? 'Auto Apply activo' : 'Pulsa Iniciar para seguir postulando');
    }
  }

  // Events
  $('searchBtn')?.addEventListener('click', () => runSearch());
  $('refreshJobsBtn')?.addEventListener('click', () => runSearch());
  $('queueToggle')?.addEventListener('click', async () => {
    const on = InstaWorkEngine.toggleQueue();
    if (on) { await runSearch(); InstaWorkEngine.autoApplyBatch(); }
    refreshTop(); renderJobs(); renderQR();
  });
  $('viewAllJobsBtn')?.addEventListener('click', () => {
    document.querySelector('.tabs button[data-tab="jobs"]')?.click();
  });

  $('modeBtn')?.addEventListener('click', e => { e.stopPropagation(); $('modeMenu').classList.toggle('hidden'); });
  document.addEventListener('click', () => $('modeMenu')?.classList.add('hidden'));
  $('modeMenu')?.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    InstaWorkEngine.setMode(b.dataset.mode);
    refreshTop(); renderQR(); renderAnswersView();
  }));

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

  $('q')?.addEventListener('input', () => { jobsPage = 1; renderJobs(); });
  $('sort')?.addEventListener('change', () => { jobsPage = 1; renderJobs(); });
  $('inboxUnreadOnly')?.addEventListener('change', renderInbox);
  $('inboxLabelFilter')?.addEventListener('change', renderInbox);

  document.querySelectorAll('.pref-tab').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.pref-tab').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    ['quick', 'answers', 'reject'].forEach(t => $('ptab-' + t)?.classList.toggle('hidden', b.dataset.ptab !== t));
  }));
  document.querySelectorAll('[data-ptab-jump]').forEach(b => b.addEventListener('click', () => {
    document.querySelector('.pref-tab[data-ptab="answers"]')?.click();
  }));

  document.querySelectorAll('.settings-tab').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.stab === 'logout') return;
    document.querySelectorAll('.settings-tab').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    ['prefs', 'personal', 'notif', 'billing'].forEach(t => $('stab-' + t)?.classList.toggle('hidden', b.dataset.stab !== t));
  }));

  document.querySelectorAll('.drawer-tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.drawer-tabs button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    drawerTab = b.dataset.dtab;
    renderDrawerBody();
  }));

  $('drawerClose')?.addEventListener('click', closeDrawer);
  $('drawerBackdrop')?.addEventListener('click', closeDrawer);

  $('agentToggle')?.addEventListener('click', () => $('agentInner').classList.toggle('hidden'));
  $('agentClose')?.addEventListener('click', () => $('agentInner').classList.add('hidden'));
  $('agentResumeBtn')?.addEventListener('click', async () => {
    if (!InstaWorkEngine.getState().queue_active) InstaWorkEngine.toggleQueue();
    await runSearch();
    InstaWorkEngine.autoApplyBatch();
    refreshTop(); renderJobs(); renderQR();
  });

  $('getCreditsBtn')?.addEventListener('click', () => {
    InstaWorkEngine.addCredits(10);
    alert('+10 créditos añadidos (demo).');
    refreshTop();
  });
  $('freeCreditsBtn')?.addEventListener('click', () => {
    InstaWorkEngine.addCredits(5);
    alert('+5 créditos gratis por referido (demo).');
    refreshTop();
  });

  $('newKitBtn')?.addEventListener('click', () => {
    const name = prompt('Nombre del Application Kit:');
    if (name) { InstaWorkEngine.createApplicationKit(name); renderJobHub(); }
  });
  $('newResumeBtn')?.addEventListener('click', () => alert('Sube tu CV desde el onboarding o Preferencias.'));
  $('newCoverBtn')?.addEventListener('click', () => {
    const t = prompt('Título de la carta:');
    if (t) { InstaWorkEngine.createCoverLetter(t); renderCoverLetters(); }
  });
  $('newMockBtn')?.addEventListener('click', () => {
    const r = prompt('Rol para la entrevista:');
    if (r) { InstaWorkEngine.createMockInterview(r); renderMockInterviews(); }
  });
  $('unlockBuddyBtn')?.addEventListener('click', () => alert('Interview Buddy requiere plan premium. Disponible en Windows y macOS.'));
  $('upgradePlanBtn')?.addEventListener('click', () => alert('Plan Pro: $49/mes — 1 auto-apply job/mes + créditos extra.'));

  $('savePrefsBtn')?.addEventListener('click', () => {
    InstaWorkEngine.setDailyLimit($('dailyLimit').value);
    alert('Preferencias guardadas.');
    refreshTop();
  });
  $('saveSettingsBtn')?.addEventListener('click', () => {
    InstaWorkEngine.setSettings({ language: $('setLang').value, marketing_cookies: $('setMarketing').checked });
    alert('Configuración guardada.');
  });

  $('rejectAdd')?.addEventListener('click', () => {
    InstaWorkEngine.addRejectionReason($('rejectInput').value);
    $('rejectInput').value = '';
    renderRejections();
  });

  $('qaadd')?.addEventListener('click', () => {
    const q = $('qaq').value.trim(), a = $('qaa').value.trim();
    if (!q || !a) return;
    const arr = InstaWorkEngine.getAnswers();
    arr.push({ q, a });
    InstaWorkEngine.setAnswers(arr);
    $('qaq').value = ''; $('qaa').value = '';
    renderAnswers(); renderCommonQa(); renderAnswersView();
  });

  $('bsearch')?.addEventListener('click', async () => {
    const q = ($('bq').value || '').trim() || 'developer';
    const country = $('bcountry').value || 'Chile';
    const btn = $('bsearch');
    btn.disabled = true;
    btn.textContent = 'Buscando…';
    const opts = { country, onProgress: msg => { btn.textContent = msg.slice(0, 24); } };
    if (buscarWm === 'remote') opts.remoteOnly = true;
    if (buscarWm === 'onsite') opts.onsiteOnly = true;
    try {
      const result = await InstaWorkEngine.searchBoard(q, opts);
      $('browsList').innerHTML = result.jobs.length
        ? result.jobs.map(jobCard).join('')
        : '<div class="empty-state"><p>Sin resultados para «' + esc(q) + '». Prueba con «developer» o «desarrollador».</p></div>';
      showToast(result.total + ' empleos encontrados', result.total ? 'ok' : 'error');
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
      $('browsList').innerHTML = '<div class="empty-state"><p>Error al buscar. Intenta de nuevo.</p></div>';
    }
    btn.disabled = false;
    btn.textContent = 'Buscar';
  });

  document.querySelectorAll('.chip-filter').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.chip-filter').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    buscarWm = b.dataset.wm;
  }));

  document.querySelectorAll('.view-toggle').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.view-toggle').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    kitView = b.dataset.kview;
    renderJobHub();
  }));

  $('notifBtn')?.addEventListener('click', e => {
    e.stopPropagation();
    const dd = $('notifDropdown');
    const s = InstaWorkEngine.getState();
    dd.innerHTML = (s.notifications || []).slice(0, 12).map(n =>
      `<div class="notif-item${n.read ? '' : ' unread'}"><strong>${esc(n.title)}</strong><p class="sub">${esc(n.body)}</p></div>`
    ).join('') || '<p class="sub">Sin notificaciones</p>';
    dd.classList.toggle('hidden');
  });
  document.addEventListener('click', () => $('notifDropdown')?.classList.add('hidden'));

  $('moreNavBtn')?.addEventListener('click', () => $('side').classList.add('open'));

  document.addEventListener('click', e => {
    const job = e.target.closest('[data-open-job]');
    if (job) { openJobDrawer(job.dataset.openJob); return; }
    const card = e.target.closest('.job-card[data-job]');
    if (card && !e.target.closest('button')) { openJobDrawer(card.dataset.job); return; }
    const inbox = e.target.closest('[data-inbox]');
    if (inbox) { InstaWorkEngine.markInboxRead(inbox.dataset.inbox); renderInbox(); refreshTop(); return; }

    const t = e.target.closest('[data-act],[data-save],[data-set-mode],[data-use-resume],[data-delqa],[data-delreject]');
    if (!t) return;

    if (t.dataset.setMode) { InstaWorkEngine.setMode(t.dataset.setMode); renderAnswersView(); refreshTop(); return; }
    if (t.dataset.useResume) { InstaWorkEngine.setResumeActive(t.dataset.useResume); renderResumes(); return; }
    if (t.dataset.delreject) { InstaWorkEngine.removeRejectionReason(t.dataset.delreject); renderRejections(); return; }
    if (t.dataset.delqa) {
      const arr = InstaWorkEngine.getAnswers();
      arr.splice(+t.dataset.delqa, 1);
      InstaWorkEngine.setAnswers(arr);
      renderAnswers(); renderCommonQa();
      return;
    }
    if (t.dataset.save) { InstaWorkEngine.toggleSave(t.dataset.save); refreshTop(); renderJobs(); renderSaved(); return; }

    const id = t.dataset.id, act = t.dataset.act;
    if (act === 'apply') {
      const r = InstaWorkEngine.applyJob(id);
      if (!r.ok && r.error === 'sin_creditos') { alert('Sin créditos. Pulsa "Obtener más".'); return; }
      refreshTop(); renderJobs(); renderQR();
      openJobDrawer(id);
      drawerTab = 'application';
      document.querySelectorAll('.drawer-tabs button').forEach(b => b.classList.toggle('active', b.dataset.dtab === 'application'));
      renderDrawerBody();
    } else if (act === 'decline') {
      const reason = prompt('¿Motivo del rechazo? (opcional)') || '';
      InstaWorkEngine.declineJob(id, reason);
      refreshTop(); renderJobs(); renderQR();
    } else if (act === 'skip') { InstaWorkEngine.skipJob(id); qrIndex++; renderQR(); }
    else if (act === 'save') { InstaWorkEngine.toggleSave(id); renderQR(); refreshTop(); }
  });

  syncPrefsFromWizard();
  const s0 = InstaWorkEngine.getState();
  if ($('bq') && (s0.preferences.titles || [])[0]) $('bq').value = s0.preferences.titles[0];
  refreshTop();
  renderJobs();
  renderQR();
})();
