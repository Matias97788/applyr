/* Applyr Engine (client-side) — corre en el navegador, sin servidor.
   Bolsa ATS (GetOnBoard CL, RemoteOK, Greenhouse, Ashby, Lever) + JQM + regla de oro.
   Estado en localStorage. Mismas reglas que el motor Node. */
(function (global) {
  'use strict';
  const LS = 'applyr_state_v1';
  const H = { headers: { accept: 'application/json' } };
  const norm = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const toks = s => norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 1);
  const settle = p => p.then(r => r, () => []);

  const GREENHOUSE = ['gitlab', 'doordash', 'airbnb', 'stripe', 'coinbase', 'discord', 'figma', 'brex'];
  const ASHBY = ['Ashby', 'openai', 'ramp', 'linear', 'runway', 'posthog', 'deel', 'mercury'];
  const LEVER = ['leverdemo', 'plaid', 'kraken'];

  function toIso(v){ if(!v) return null; let ms; if(typeof v==='number') ms=v<1e12?v*1000:v; else {const t=Date.parse(v); if(isNaN(t)) return null; ms=t;} return new Date(ms).toISOString(); }
  function ageDays(iso){ return iso==null?null:Math.floor((Date.now()-Date.parse(iso))/86400000); }

  // ---- adaptadores (normalizan al mismo shape) ----
  async function gh(token){ const r=await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=false`,H); if(!r.ok) return []; const d=await r.json();
    return (d.jobs||[]).map(j=>{const pub=toIso(j.first_published||j.updated_at);return {id:'gh_'+j.id,job_link:j.absolute_url,company_name:j.company_name||token,job_title:j.title,published_at:pub,age_days:ageDays(pub),ats:'Greenhouse',full_location:j.location&&j.location.name||null,is_remote:/remote/i.test(j.location&&j.location.name||''),skills:[]};}); }
  async function ashby(token){ const r=await fetch(`https://api.ashbyhq.com/posting-api/job-board/${token}`,H); if(!r.ok) return []; const d=await r.json();
    return (d.jobs||[]).filter(j=>j.isListed!==false).map(j=>{const pub=toIso(j.publishedAt);return {id:'ashby_'+j.id,job_link:j.jobUrl||j.applyUrl,company_name:token,job_title:j.title,department:j.department||j.team,published_at:pub,age_days:ageDays(pub),ats:'Ashby',is_remote:!!j.isRemote,full_location:j.location||null,skills:[]};}); }
  async function lever(token){ const r=await fetch(`https://api.lever.co/v0/postings/${token}?mode=json`,H); if(!r.ok) return []; const a=await r.json();
    return (a||[]).map(j=>{const pub=toIso(j.createdAt);const c=j.categories||{};return {id:'lever_'+j.id,job_link:j.hostedUrl,company_name:token,job_title:j.text,department:c.department||c.team,published_at:pub,age_days:ageDays(pub),ats:'Lever',is_remote:/remote/i.test(c.location||''),full_location:c.location||null,skills:[]};}); }
  async function getonbrd(query){ const r=await fetch(`https://www.getonbrd.com/api/v0/search/jobs?query=${encodeURIComponent(query)}&per_page=30&expand=["company"]`,H); if(!r.ok) return []; const d=await r.json();
    return (d.data||[]).map(row=>{const a=row.attributes||{};const pub=toIso(a.published_at);const link=(row.links&&row.links.public_url)||('https://www.getonbrd.com/jobs/'+row.id);
      return {id:'gob_'+row.id,job_link:link,company_name:(a.company&&a.company.data&&a.company.data.attributes&&a.company.data.attributes.name)||null,job_title:a.title,published_at:pub,age_days:ageDays(pub),ats:'GetOnBoard',seniority:a.seniority||null,is_remote:!!a.remote,countries:a.countries||[],cities:a.location_cities||[],min_salary:a.min_salary,max_salary:a.max_salary,skills:Array.isArray(a.tags)?a.tags:[],department:a.category_name||null};}); }
  async function remoteok(){ const r=await fetch('https://remoteok.com/api',H); if(!r.ok) return []; const a=await r.json();
    return (a||[]).filter(j=>j&&j.id&&j.position).map(j=>{const pub=toIso(j.epoch||j.date);return {id:'rok_'+j.id,job_link:j.url,company_name:j.company,job_title:j.position,published_at:pub,age_days:ageDays(pub),ats:'RemoteOK',is_remote:true,skills:Array.isArray(j.tags)?j.tags:[],full_location:j.location||'Remote'};}); }

  // ---- scoring (fit + frescura) ----
  function scoreJob(job, pref){
    const titles=(pref.titles||[]).map(norm); const jt=norm(job.job_title); const jset=new Set(toks(job.job_title));
    const matches=[],gaps=[]; let title=0;
    for(const t of titles){ if(!t) continue; if(jt.includes(t)||t.includes(jt)){title=45;matches.push('Título: "'+t+'"');break;} const tt=toks(t);const ov=tt.filter(w=>jset.has(w)).length; if(tt.length) title=Math.max(title,Math.round(ov/tt.length*40)); }
    if(!title&&titles.length) gaps.push('El título no coincide');
    let loc=5; if(job.is_remote&&pref.remote!==false){loc=20;matches.push('Remoto');}
      else if(pref.country&&(job.countries||[]).map(norm).includes(norm(pref.country))){loc=18;matches.push('País: '+pref.country);}
    let sk=0; const ws=(pref.skills||[]).map(norm); const js=(Array.isArray(job.skills)?job.skills:[]).map(norm);
      if(ws.length&&js.length){const hit=ws.filter(s=>js.some(x=>x.includes(s)));sk=Math.min(12,hit.length*4);if(hit.length)matches.push('Skills: '+hit.slice(0,3).join(', '));}
    let fr=0; const a=job.age_days; if(a!=null){ fr=a<=3?12:a<=7?9:a<=14?5:a<=21?2:0; if(a<=7)matches.push('Publicado hace '+a+'d'); else if(a>21)gaps.push('Antiguo ('+a+'d)'); }
    const sen=8; const fit=Math.max(0,Math.min(100,title+loc+sk+fr+sen+10));
    return { fit_score:fit, key_matches:matches.slice(0,5), key_gaps:gaps.slice(0,4) };
  }

  function titleMatches(title, titles){ const t=norm(title); return titles.some(q=>{const n=norm(q);return t.includes(n)||toks(n).some(w=>w.length>2&&t.includes(w));}); }

  // ---- estado ----
  function load(){ try{return JSON.parse(localStorage.getItem(LS))||null;}catch(e){return null;} }
  function save(st){ localStorage.setItem(LS, JSON.stringify(st)); }
  function fresh(){ return { status:'idle', apply_mode:'review', max_age_days:21, min_fit:55, credits:20,
    profile:{},
    preferences:{titles:[],country:'Chile',remote:true,skills:[],exclude_companies:[]},
    jobs:[], run:null, total_applied:0, total_declined:0, updated_at:new Date().toISOString() }; }
  function findJob(s,id){ return s.jobs.find(j=>j.id===id); }
  function getState(){ let s=load(); if(!s){s=fresh();save(s);} return s; }

  const Engine = {
    getState, save,
    setPreferences(p){ const s=getState(); s.preferences={...s.preferences,...p}; save(s); return s.preferences; },
    setMode(m){ const s=getState(); s.apply_mode=m; save(s); },
    getJobs(){ return getState().jobs; },
    getCredits(){ return getState().credits; },
    async search(onProgress){
      const s=getState(); const pref=s.preferences; const titles=(pref.titles&&pref.titles.length)?pref.titles:['developer'];
      s.status='searching'; save(s); if(onProgress)onProgress('Buscando en las fuentes…');
      const tasks=[];
      titles.slice(0,4).forEach(q=>tasks.push(settle(getonbrd(q))));
      tasks.push(settle(remoteok()));
      GREENHOUSE.forEach(b=>tasks.push(settle(gh(b))));
      ASHBY.forEach(b=>tasks.push(settle(ashby(b))));
      LEVER.forEach(b=>tasks.push(settle(lever(b))));
      const collected=(await Promise.all(tasks)).flat();
      if(onProgress)onProgress('Evaluando '+collected.length+' empleos…');
      const maxAge=s.max_age_days, minFit=s.min_fit, seen=new Set(); let evaluated=0;
      const passed=[];
      for(const j of collected){
        if(!j||!j.job_link||!j.job_title) continue;
        if(!titleMatches(j.job_title,titles)) continue;
        if(j.age_days==null||j.age_days>maxAge) continue;            // REGLA DE ORO
        if((pref.exclude_companies||[]).some(c=>norm(j.company_name).includes(norm(c)))) continue;
        const key=j.job_link+'|'+norm(j.company_name)+'|'+norm(j.job_title); if(seen.has(key)) continue; seen.add(key);
        evaluated++;
        const sc=scoreJob(j,pref); j.fit_score=sc.fit_score; j.key_matches=sc.key_matches; j.key_gaps=sc.key_gaps; j.status='ready';
        if(j.fit_score>=minFit) passed.push(j);
      }
      passed.sort((a,b)=>(b.fit_score-a.fit_score)||(a.age_days-b.age_days));
      // merge (dedupe con lo existente)
      const existing=new Set(s.jobs.map(x=>x.job_link)); const added=passed.filter(j=>!existing.has(j.job_link));
      s.jobs=[...added,...s.jobs];
      s.run={ finished_at:new Date().toISOString(), selected_job_titles:titles, hits_initial:collected.length, hits_evaluated:evaluated, jobs_added_total:added.length, finish_reason:'success' };
      s.status='idle'; s.updated_at=new Date().toISOString(); save(s);
      // Modo Auto/Hybrid: pre-selecciona los de alto fit (≥75) como "recomendados"
      if(s.apply_mode!=='review'){ s.jobs.forEach(j=>{ if(j.status==='ready'&&j.fit_score>=75) j.recommended=true; }); save(s); }
      return { run:s.run, added:added.length, total:s.jobs.length };
    },
    // --- Perfil (onboarding) ---
    setProfile(p){ const s=getState(); s.profile={...s.profile,...p}; save(s); return s.profile; },
    getProfile(){ return getState().profile||{}; },
    // --- Acciones sobre empleos ---
    applyJob(id){ const s=getState(); const j=findJob(s,id); if(!j) return {ok:false,error:'no existe'};
      if(j.status==='applied') return {ok:true, job:j, already:true};
      if((s.credits||0)<1) return {ok:false, error:'sin_creditos'};
      j.status='applied'; j.applied_at=new Date().toISOString(); j.recommended=false;
      s.credits--; s.total_applied=(s.total_applied||0)+1; save(s);
      return {ok:true, job:j, credits:s.credits}; },
    declineJob(id){ const s=getState(); const j=findJob(s,id); if(!j) return; j.status='declined'; j.recommended=false; s.total_declined=(s.total_declined||0)+1; save(s); },
    skipJob(id){ const s=getState(); const j=findJob(s,id); if(!j) return; j.skipped=true; save(s); },
    toggleSave(id){ const s=getState(); const j=findJob(s,id); if(!j) return false; j.saved=!j.saved; save(s); return j.saved; },
    getReady(){ return getState().jobs.filter(j=>j.status==='ready'&&!j.skipped); },
    getSaved(){ return getState().jobs.filter(j=>j.saved); },
    getApplied(){ return getState().jobs.filter(j=>j.status==='applied'); },
    // --- Answer Library (respuestas comunes) ---
    getAnswers(){ return getState().answers||[]; },
    setAnswers(a){ const s=getState(); s.answers=a; save(s); },
    reset(){ save(fresh()); }
  };
  global.ApplyrEngine = Engine;
})(window);
