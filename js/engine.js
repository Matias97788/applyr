/* instaWork Engine — bolsa ATS + estado local (AIApply-style) */
(function (global) {
  'use strict';
  const LS = 'instawork_state_v1';
  const H = { headers: { accept: 'application/json' } };
  const norm = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const toks = s => norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 1);
  const settle = p => p.then(r => r, () => []);
  const esc = s => (s || '').toString().replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);

  const GREENHOUSE = ['gitlab', 'doordash', 'airbnb', 'stripe', 'coinbase', 'discord', 'figma', 'brex'];
  const ASHBY = ['Ashby', 'openai', 'ramp', 'linear', 'runway', 'posthog', 'deel', 'mercury'];
  const LEVER = ['leverdemo', 'plaid', 'kraken'];

  const COMMON_QA = [
    { q: '¿En qué región te encuentras?', key: 'region', def: 'América Latina' },
    { q: '¿En qué país te encuentras?', key: 'country', def: 'Chile' },
    { q: '¿Cuándo podrías empezar?', key: 'start', def: 'Inmediatamente' },
    { q: '¿Requieres patrocinio de visa en EE.UU.?', key: 'sponsorship', def: 'No' },
    { q: 'Compensación esperada (USD anual)', key: 'salary', def: '36000' },
    { q: 'URL de LinkedIn', key: 'linkedin', def: '' }
  ];

  function toIso(v) { if (!v) return null; let ms; if (typeof v === 'number') ms = v < 1e12 ? v * 1000 : v; else { const t = Date.parse(v); if (isNaN(t)) return null; ms = t; } return new Date(ms).toISOString(); }
  function ageDays(iso) { return iso == null ? null : Math.floor((Date.now() - Date.parse(iso)) / 86400000); }

  async function gh(token) { const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=false`, H); if (!r.ok) return []; const d = await r.json();
    return (d.jobs || []).map(j => { const pub = toIso(j.first_published || j.updated_at); return { id: 'gh_' + j.id, job_link: j.absolute_url, company_name: j.company_name || token, job_title: j.title, published_at: pub, age_days: ageDays(pub), ats: 'Greenhouse', full_location: j.location && j.location.name || null, is_remote: /remote/i.test(j.location && j.location.name || ''), skills: [] }; }); }
  async function ashby(token) { const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${token}`, H); if (!r.ok) return []; const d = await r.json();
    return (d.jobs || []).filter(j => j.isListed !== false).map(j => { const pub = toIso(j.publishedAt); return { id: 'ashby_' + j.id, job_link: j.jobUrl || j.applyUrl, company_name: token, job_title: j.title, department: j.department || j.team, published_at: pub, age_days: ageDays(pub), ats: 'Ashby', is_remote: !!j.isRemote, full_location: j.location || null, skills: [] }; }); }
  async function lever(token) { const r = await fetch(`https://api.lever.co/v0/postings/${token}?mode=json`, H); if (!r.ok) return []; const a = await r.json();
    return (a || []).map(j => { const pub = toIso(j.createdAt); const c = j.categories || {}; return { id: 'lever_' + j.id, job_link: j.hostedUrl, company_name: token, job_title: j.text, department: c.department || c.team, published_at: pub, age_days: ageDays(pub), ats: 'Lever', is_remote: /remote/i.test(c.location || ''), full_location: c.location || null, skills: [] }; }); }
  async function getonbrd(query) {
    const url = `https://www.getonbrd.com/api/v0/search/jobs?query=${encodeURIComponent(query)}&per_page=30&expand%5B%5D=company`;
    const r = await fetch(url, H);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.data || []).map(row => {
      const a = row.attributes || {};
      const pub = toIso(a.published_at);
      const link = (row.links && row.links.public_url) || ('https://www.getonbrd.com/jobs/' + row.id);
      const co = a.company && a.company.data && a.company.data.attributes;
      return {
        id: 'gob_' + row.id, job_link: link,
        company_name: (co && co.name) || 'GetOnBoard',
        job_title: a.title, published_at: pub, age_days: ageDays(pub),
        ats: 'GetOnBoard', seniority: a.seniority || null, is_remote: !!a.remote,
        countries: a.countries || [], cities: a.location_cities || [],
        skills: Array.isArray(a.tags) ? a.tags : [], department: a.category_name || null,
        _skipTitleFilter: true, _query: query
      };
    });
  }

  async function remotive(query) {
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query || 'developer')}&limit=50`;
    const r = await fetch(url, H);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.jobs || []).map(j => {
      const pub = toIso(j.publication_date);
      return {
        id: 'rem_' + j.id, job_link: j.url, company_name: j.company_name,
        job_title: j.title, published_at: pub, age_days: ageDays(pub),
        ats: 'Remotive', is_remote: true,
        skills: (j.tags || []).map(t => t.name).filter(Boolean),
        full_location: j.candidate_required_location || 'Remote',
        _skipTitleFilter: true, _query: query
      };
    });
  }

  async function remoteok() {
    const r = await fetch('https://remoteok.com/api', H);
    if (!r.ok) return [];
    const a = await r.json();
    return (a || []).filter(j => j && j.id && j.position).map(j => {
      const pub = toIso(j.epoch || j.date);
      return {
        id: 'rok_' + j.id, job_link: j.url, company_name: j.company, job_title: j.position,
        published_at: pub, age_days: ageDays(pub), ats: 'RemoteOK', is_remote: true,
        skills: Array.isArray(j.tags) ? j.tags : [], full_location: j.location || 'Remote',
        _skipTitleFilter: true
      };
    });
  }

  function buildSearchQueries(titles) {
    const q = new Set();
    (titles || []).forEach(t => {
      const s = (t || '').trim();
      if (!s) return;
      q.add(s);
      toks(s).filter(w => w.length > 3).forEach(w => q.add(w));
    });
    q.add('developer');
    q.add('desarrollador');
    return [...q].slice(0, 8);
  }

  function passesFilters(job, pref, titles, rejectionReasons, maxAge, minFit) {
    if (!job || !job.job_link || !job.job_title) return false;
    if (!job._skipTitleFilter && !titleMatches(job.job_title, titles)) return false;
    if (job.age_days != null && job.age_days > maxAge) return false;
    if ((pref.exclude_companies || []).some(c => norm(job.company_name).includes(norm(c)))) return false;
    const sc = scoreJob(job, pref, rejectionReasons);
    job.fit_score = sc.fit_score;
    job.key_matches = sc.key_matches;
    job.key_gaps = sc.key_gaps;
    job.status = job.status || 'ready';
    return job.fit_score >= minFit;
  }

  function ingestJobs(s, jobs, titles) {
    const pref = s.preferences;
    const maxAge = s.max_age_days;
    const minFit = s.min_fit;
    const seen = new Set(s.jobs.map(x => x.job_link));
    let added = 0;
    for (const j of jobs) {
      if (!passesFilters(j, pref, titles, s.rejection_reasons, maxAge, minFit)) continue;
      const key = j.job_link + '|' + norm(j.company_name) + '|' + norm(j.job_title);
      if (seen.has(key) || seen.has(j.job_link)) continue;
      seen.add(j.job_link);
      seen.add(key);
      delete j._skipTitleFilter;
      delete j._query;
      s.jobs.unshift(j);
      added++;
    }
    return added;
  }

  function scoreJob(job, pref, rejectionReasons) {
    const titles = (pref.titles || []).map(norm); const jt = norm(job.job_title); const jset = new Set(toks(job.job_title));
    const matches = [], gaps = []; let title = 0;
    for (const t of titles) { if (!t) continue; if (jt.includes(t) || t.includes(jt)) { title = 45; matches.push('Título: "' + t + '"'); break; } const tt = toks(t); const ov = tt.filter(w => jset.has(w)).length; if (tt.length) title = Math.max(title, Math.round(ov / tt.length * 40)); }
    if (!title && titles.length) gaps.push('El título no coincide');
    let loc = 5; if (job.is_remote && pref.remote !== false) { loc = 20; matches.push('Remoto'); }
    else if (pref.country && (job.countries || []).map(norm).includes(norm(pref.country))) { loc = 18; matches.push('País: ' + pref.country); }
    let sk = 0; const ws = (pref.skills || []).map(norm); const js = (Array.isArray(job.skills) ? job.skills : []).map(norm);
    if (ws.length && js.length) { const hit = ws.filter(s => js.some(x => x.includes(s))); sk = Math.min(12, hit.length * 4); if (hit.length) matches.push('Skills: ' + hit.slice(0, 3).join(', ')); }
    let fr = 0; const a = job.age_days; if (a != null) { fr = a <= 3 ? 12 : a <= 7 ? 9 : a <= 14 ? 5 : a <= 21 ? 2 : 0; if (a <= 7) matches.push('Publicado hace ' + a + 'd'); else if (a > 21) gaps.push('Antiguo (' + a + 'd)'); }
    let penalty = 0;
    (rejectionReasons || []).forEach(r => {
      const pat = norm(r.pattern || r);
      if (pat && (norm(job.company_name).includes(pat) || norm(job.job_title).includes(pat))) penalty += 15;
    });
    const sen = 8; const fit = Math.max(0, Math.min(100, title + loc + sk + fr + sen + 10 - penalty));
    return { fit_score: fit, key_matches: matches.slice(0, 5), key_gaps: gaps.slice(0, 4) };
  }

  function titleMatches(title, titles) { const t = norm(title); return titles.some(q => { const n = norm(q); return t.includes(n) || toks(n).some(w => w.length > 2 && t.includes(w)); }); }

  function migrate(st) {
    if (!st) return null;
    if (!st.inbox) st.inbox = [];
    if (!st.notifications) st.notifications = [];
    if (!st.resumes) st.resumes = [];
    if (!st.cover_letters) st.cover_letters = [];
    if (!st.application_kits) st.application_kits = [];
    if (!st.mock_interviews) st.mock_interviews = [];
    if (!st.rejection_reasons) st.rejection_reasons = [];
    if (st.queue_active == null) st.queue_active = false;
    if (st.daily_limit == null) st.daily_limit = 10;
    if (!st.settings) st.settings = { language: 'es', marketing_cookies: true, plan: 'free', plan_renews: null };
    if (!st.proxy_email) st.proxy_email = null;
    if (!st.board_results) st.board_results = [];
    if (st.max_age_days != null && st.max_age_days < 30) st.max_age_days = 45;
    if (st.min_fit != null && st.min_fit > 45) st.min_fit = 40;
    return st;
  }

  function fresh() {
    return migrate({
      status: 'idle', apply_mode: 'review', max_age_days: 45, min_fit: 40, credits: 72,
      queue_active: false, daily_limit: 10,
      profile: {}, preferences: { titles: [], country: 'Chile', remote: true, skills: [], exclude_companies: [] },
      jobs: [], run: null, total_applied: 0, total_declined: 0, updated_at: new Date().toISOString(),
      answers: [], inbox: [], notifications: [], resumes: [], cover_letters: [],
      application_kits: [], mock_interviews: [], rejection_reasons: [],
      settings: { language: 'es', marketing_cookies: true, plan: 'trial', plan_renews: null },
      proxy_email: null
    });
  }

  function load() { try { return migrate(JSON.parse(localStorage.getItem(LS)) || null); } catch (e) { return null; } }
  function save(st) { localStorage.setItem(LS, JSON.stringify(st)); }
  function findJob(s, id) { return s.jobs.find(j => j.id === id); }

  function getState() { let s = load(); if (!s) { s = fresh(); save(s); } return s; }

  function proxyEmail(s) {
    if (s.proxy_email) return s.proxy_email;
    const p = s.profile || {};
    const base = norm(p.fullname || p.email || 'user').replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.').slice(0, 24) || 'usuario';
    s.proxy_email = base + '@candidatos.instawork.app';
    save(s);
    return s.proxy_email;
  }

  function profileName(s) {
    const p = s.profile || {};
    return p.fullname || (p.email ? p.email.split('@')[0] : 'Candidato');
  }

  function generateCoverLetter(job, s) {
    const name = profileName(s);
    const co = job.company_name || 'la empresa';
    const role = job.job_title || 'el puesto';
    const skills = (s.preferences.skills || s.profile.skills || []).slice(0, 3).join(', ') || 'desarrollo web y e-commerce';
    return `Estimado equipo de reclutamiento de ${co},

Me interesa mucho la posición de ${role}. Mi experiencia en ${skills} encaja con lo que buscan, especialmente en entornos remotos y equipos ágiles.

En roles recientes lideré proyectos de alto impacto: optimicé rendimiento web, integré analítica y automatización, y coordiné equipos multidisciplinarios para entregar resultados medibles.

Me entusiasma aportar a ${co} con un enfoque práctico, orientado a datos y con capacidad de ejecutar de punta a punta.

Saludos cordiales,
${name}`;
  }

  function buildApplicationAnswers(job, s) {
    const p = s.profile || {};
    const pref = s.preferences || {};
    const saved = {};
    (s.answers || []).forEach(a => { saved[norm(a.q)] = a.a; });
    const defaults = {
      region: 'América Latina', country: pref.country || 'Chile', start: 'Inmediatamente',
      sponsorship: 'No', salary: String(pref.salary_min || 36000),
      linkedin: p.linkedin || '—', first: (p.fullname || '').split(' ')[0] || '—',
      last: (p.fullname || '').split(' ').slice(1).join(' ') || '—',
      email: proxyEmail(s)
    };
    return COMMON_QA.map(q => ({
      q: q.q, a: saved[norm(q.q)] || defaults[q.key] || q.def
    }));
  }

  function pushInbox(s, msg) {
    s.inbox.unshift({ id: 'in_' + uid(), read: false, ...msg, at: msg.at || new Date().toISOString() });
    if (s.inbox.length > 80) s.inbox.length = 80;
  }

  function pushNotification(s, n) {
    s.notifications.unshift({ id: 'n_' + uid(), read: false, ...n, at: n.at || new Date().toISOString() });
    if (s.notifications.length > 50) s.notifications.length = 50;
  }

  function onJobApplied(s, j) {
    const co = j.company_name || 'Empresa';
    pushInbox(s, {
      from: co, subject: `Recibimos tu postulación — ${j.job_title}`,
      preview: `Hola ${profileName(s)}, gracias por postularte a ${j.job_title}. Revisaremos tu perfil pronto.`,
      label: 'Confirmación'
    });
    pushNotification(s, { title: 'Postulación enviada', body: `${co} · ${j.job_title}` });
    if (Math.random() < 0.35) {
      setTimeout(() => {
        const st = getState(); const jj = findJob(st, j.id);
        if (!jj || jj.status !== 'applied') return;
        const labels = ['Assessment', 'Confirmación', 'No esta vez'];
        const label = labels[Math.floor(Math.random() * labels.length)];
        const subjects = {
          Assessment: `[Acción requerida] Completa tu evaluación para ${j.job_title}`,
          'No esta vez': `Actualización sobre tu postulación — ${j.job_title}`,
          Confirmación: `Seguimiento de tu postulación en ${co}`
        };
        pushInbox(st, { from: co, subject: subjects[label], preview: 'Mensaje del reclutador sobre tu proceso.', label });
        pushNotification(st, { title: label === 'No esta vez' ? 'Actualización de postulación' : 'Nuevo mensaje en Inbox', body: co });
        save(st);
        if (global.iwRefreshUI) global.iwRefreshUI();
      }, 800);
    }
  }

  function ensureDefaultResume(s) {
    if (s.resumes.length) return;
    const name = profileName(s);
    s.resumes.push({
      id: 'res_orig', name: 'CV original', type: 'original', created_at: new Date().toISOString(),
      used: false, views: 0
    });
    s.resumes.push({
      id: 'res_opt', name: 'CV optimizado', type: 'optimized', created_at: new Date().toISOString(),
      used: true, views: 0
    });
  }

  const Engine = {
    getState, save,
    setPreferences(p) { const s = getState(); s.preferences = { ...s.preferences, ...p }; save(s); return s.preferences; },
    setMode(m) { const s = getState(); s.apply_mode = m; save(s); },
    setSettings(p) { const s = getState(); s.settings = { ...s.settings, ...p }; save(s); },
    setDailyLimit(n) { const s = getState(); s.daily_limit = Math.max(1, Math.min(50, +n || 10)); save(s); },
    toggleQueue() {
      const s = getState();
      s.queue_active = !s.queue_active;
      s.status = s.queue_active ? 'searching' : 'idle';
      if (s.queue_active) {
        pushNotification(s, { title: 'Auto Apply activado', body: 'Buscando y postulando empleos que coincidan contigo.' });
      }
      save(s);
      return s.queue_active;
    },
    getProxyEmail() { return proxyEmail(getState()); },
    getCredits() { return getState().credits; },
    addCredits(n) { const s = getState(); s.credits = (s.credits || 0) + (+n || 0); save(s); return s.credits; },
    getJobs() { return getState().jobs; },
    getInbox() { return getState().inbox; },
    getNotifications() { return getState().notifications; },
    markInboxRead(id) { const s = getState(); const m = s.inbox.find(x => x.id === id); if (m) m.read = true; save(s); },
    markAllInboxRead() { const s = getState(); s.inbox.forEach(m => { m.read = true; }); save(s); },
    markNotificationRead(id) { const s = getState(); const n = s.notifications.find(x => x.id === id); if (n) n.read = true; save(s); },
    getResumes() { const s = getState(); ensureDefaultResume(s); save(s); return s.resumes; },
    getCoverLetters() { return getState().cover_letters; },
    getApplicationKits() { return getState().application_kits; },
    getMockInterviews() { return getState().mock_interviews; },
    getRejectionReasons() { return getState().rejection_reasons; },
    addRejectionReason(pattern) {
      const s = getState(); const p = (pattern || '').trim();
      if (!p) return;
      if (!s.rejection_reasons.some(r => norm(r.pattern) === norm(p))) {
        s.rejection_reasons.push({ id: 'rr_' + uid(), pattern: p, created_at: new Date().toISOString() });
      }
      save(s);
    },
    removeRejectionReason(id) { const s = getState(); s.rejection_reasons = s.rejection_reasons.filter(r => r.id !== id); save(s); },
    createCoverLetter(title) {
      const s = getState();
      const cl = { id: 'cl_' + uid(), title: title || 'Carta sin título', body: '', created_at: new Date().toISOString() };
      s.cover_letters.unshift(cl); save(s); return cl;
    },
    deleteCoverLetter(id) { const s = getState(); s.cover_letters = s.cover_letters.filter(c => c.id !== id); save(s); },
    createApplicationKit(name) {
      const s = getState();
      const k = { id: 'kit_' + uid(), name: name || 'Nuevo kit', stage: 'applied', jobs: [], created_at: new Date().toISOString() };
      s.application_kits.unshift(k); save(s); return k;
    },
    createMockInterview(role) {
      const s = getState();
      const m = { id: 'mi_' + uid(), role: role || 'Entrevista general', created_at: new Date().toISOString(), status: 'draft' };
      s.mock_interviews.unshift(m); save(s); return m;
    },
    setResumeActive(id) { const s = getState(); s.resumes.forEach(r => { r.used = r.id === id; }); save(s); },
    getPendingAnswersCount() {
      const s = getState();
      const answered = new Set((s.answers || []).map(a => norm(a.q)));
      return COMMON_QA.filter(q => !answered.has(norm(q.q))).length;
    },
    getCommonQuestions: () => COMMON_QA,
    generateCoverLetter, buildApplicationAnswers,
    async search(onProgress) {
      const s = getState();
      const pref = s.preferences;
      const titles = (pref.titles && pref.titles.length) ? pref.titles : ['developer', 'desarrollador'];
      const queries = buildSearchQueries(titles);
      s.status = 'searching';
      s.last_search_error = null;
      save(s);
      if (onProgress) onProgress('Buscando en GetOnBoard, Remotive y más…');

      const tasks = [];
      queries.forEach(q => {
        tasks.push(settle(getonbrd(q)));
        tasks.push(settle(remotive(q)));
      });
      tasks.push(settle(remoteok()));
      GREENHOUSE.slice(0, 4).forEach(b => tasks.push(settle(gh(b))));
      ASHBY.slice(0, 3).forEach(b => tasks.push(settle(ashby(b))));
      LEVER.slice(0, 2).forEach(b => tasks.push(settle(lever(b))));

      let collected = [];
      try {
        collected = (await Promise.all(tasks)).flat().filter(Boolean);
      } catch (err) {
        s.last_search_error = err.message || 'Error de red';
        s.status = s.queue_active ? 'searching' : 'idle';
        save(s);
        throw err;
      }

      if (onProgress) onProgress('Evaluando ' + collected.length + ' empleos…');
      const added = ingestJobs(s, collected, titles);
      s.run = {
        finished_at: new Date().toISOString(),
        selected_job_titles: titles,
        queries_used: queries,
        hits_initial: collected.length,
        jobs_added_total: added,
        finish_reason: added ? 'success' : (collected.length ? 'filtered' : 'empty')
      };
      s.status = s.queue_active ? 'searching' : 'idle';
      s.updated_at = new Date().toISOString();
      save(s);
      if (s.apply_mode !== 'review') {
        s.jobs.forEach(j => { if (j.status === 'ready' && j.fit_score >= 75) j.recommended = true; });
        save(s);
      }
      if (added) pushNotification(s, { title: 'Nuevos empleos encontrados', body: added + ' coincidencias añadidas.' });
      save(s);
      return { run: s.run, added, total: s.jobs.length, collected: collected.length };
    },

    async searchBoard(query, opts) {
      const s = getState();
      const q = (query || '').trim() || 'developer';
      const country = (opts && opts.country) || s.preferences.country || 'Chile';
      const onProgress = opts && opts.onProgress;

      if (onProgress) onProgress('Buscando «' + q + '»…');
      const tasks = [settle(getonbrd(q)), settle(remotive(q)), settle(getonbrd(q + ' ' + country))];
      if (!(opts && opts.onsiteOnly)) tasks.push(settle(remoteok()));

      const collected = (await Promise.all(tasks)).flat().filter(Boolean);
      let list = collected.filter(j => {
        if (opts && opts.remoteOnly && !j.is_remote) return false;
        if (opts && opts.onsiteOnly && j.is_remote) return false;
        if (j.age_days != null && j.age_days > (s.max_age_days || 45)) return false;
        const sc = scoreJob(j, s.preferences, s.rejection_reasons);
        j.fit_score = sc.fit_score;
        j.key_matches = sc.key_matches;
        j.key_gaps = sc.key_gaps;
        j.status = 'ready';
        return true;
      });

      const seen = new Set();
      list = list.filter(j => {
        if (seen.has(j.job_link)) return false;
        seen.add(j.job_link);
        delete j._skipTitleFilter;
        delete j._query;
        return true;
      }).sort((a, b) => (b.fit_score - a.fit_score) || ((a.age_days || 99) - (b.age_days || 99)));

      s.board_results = list;
      s.board_query = q;
      save(s);
      if (onProgress) onProgress(list.length + ' empleos encontrados');
      return { jobs: list, total: list.length, query: q };
    },

    getBoardResults() { return getState().board_results || []; },

    addBoardJobToQueue(job) {
      const s = getState();
      if (s.jobs.some(x => x.job_link === job.job_link)) return false;
      s.jobs.unshift({ ...job, status: 'ready' });
      save(s);
      return true;
    },
    setProfile(p) { const s = getState(); s.profile = { ...s.profile, ...p }; save(s); return s.profile; },
    getProfile() { return getState().profile || {}; },
    applyJob(id) {
      const s = getState(); const j = findJob(s, id); if (!j) return { ok: false, error: 'no existe' };
      if (j.status === 'applied') return { ok: true, job: j, already: true };
      if ((s.credits || 0) < 1) return { ok: false, error: 'sin_creditos' };
      j.status = 'applied'; j.applied_at = new Date().toISOString(); j.recommended = false;
      j.auto_applied = true;
      j.cover_letter = generateCoverLetter(j, s);
      j.application_answers = buildApplicationAnswers(j, s);
      j.resume_name = (s.resumes.find(r => r.used) || {}).name || 'CV optimizado';
      s.credits--; s.total_applied = (s.total_applied || 0) + 1;
      ensureDefaultResume(s);
      onJobApplied(s, j);
      save(s);
      return { ok: true, job: j, credits: s.credits };
    },
    autoApplyBatch() {
      const s = getState();
      if (!s.queue_active) return { applied: 0 };
      const mode = s.apply_mode;
      let applied = 0;
      const today = s.jobs.filter(j => j.applied_at && ageDays(j.applied_at) === 0).length;
      const limit = Math.min(s.daily_limit || 10, s.credits || 0);
      if (today >= limit) return { applied: 0, reason: 'daily_limit' };
      const ready = s.jobs.filter(j => j.status === 'ready' && !j.skipped);
      for (const j of ready) {
        if (applied + today >= limit) break;
        if (mode === 'review') break;
        if (mode === 'hybrid' && j.fit_score < 75) continue;
        const r = Engine.applyJob(j.id);
        if (r.ok && !r.already) applied++;
      }
      save(s);
      return { applied };
    },
    declineJob(id, reason) {
      const s = getState(); const j = findJob(s, id); if (!j) return;
      j.status = 'declined'; j.recommended = false;
      s.total_declined = (s.total_declined || 0) + 1;
      if (reason) Engine.addRejectionReason(reason);
      save(s);
    },
    skipJob(id) { const s = getState(); const j = findJob(s, id); if (!j) return; j.skipped = true; save(s); },
    toggleSave(id) { const s = getState(); const j = findJob(s, id); if (!j) return false; j.saved = !j.saved; save(s); return j.saved; },
    getReady() { return getState().jobs.filter(j => j.status === 'ready' && !j.skipped); },
    getSaved() { return getState().jobs.filter(j => j.saved); },
    getApplied() { return getState().jobs.filter(j => j.status === 'applied'); },
    getAnswers() { return getState().answers || []; },
    setAnswers(a) { const s = getState(); s.answers = a; save(s); },
    reset() { save(fresh()); }
  };
  global.InstaWorkEngine = Engine;
})(window);
