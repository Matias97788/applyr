/* instaWork — definición de pasos del onboarding (referencia AIApply) */
(function () {
  'use strict';

  const SECTIONS = [
    { id: 'start', label: 'Comenzar' },
    { id: 'status', label: 'Situación actual' },
    { id: 'goals', label: 'Tus objetivos' },
    { id: 'ai', label: 'Experiencia IA' },
    { id: 'prefs', label: 'Preferencias laborales' },
    { id: 'background', label: 'Tu perfil' },
    { id: 'help', label: 'Cómo ayudamos' },
    { id: 'data', label: 'Tu información' },
    { id: 'final', label: 'Paso final' }
  ];

  const STEPS = [
    /* ── COMENZAR ── */
    {
      id: 'service-path', section: 'start', type: 'single',
      title: '¿Qué te gustaría hacer?',
      subtitle: 'Elige el camino que mejor se adapte a ti.',
      key: 'servicePath', required: true,
      options: [
        { v: 'resume', t: 'Crear CV y cartas de presentación', d: 'Genera documentos optimizados para cada empleo.' },
        { v: 'auto', t: 'Postular automáticamente', d: 'Encuentra empleos y postula por ti.', tag: 'Más popular' },
        { v: 'interview', t: 'Ayuda en entrevistas en vivo', d: 'Practica y recibe coaching en tiempo real.' }
      ]
    },

    /* ── SITUACIÓN ACTUAL ── */
    {
      id: 'work-status', section: 'status', type: 'single',
      title: '¿Cuál es tu situación laboral actual?',
      key: 'workStatus', required: true,
      options: [
        { v: 'unemployed', t: 'Desempleado' },
        { v: 'employed', t: 'Empleado' },
        { v: 'freelance', t: 'Autónomo / freelance' },
        { v: 'student', t: 'Estudiante / primer empleo' }
      ]
    },
    {
      id: 'search-focus', section: 'status', type: 'single',
      title: '¿Cómo estás enfocando tu búsqueda de empleo?',
      key: 'searchFocus', required: true,
      options: [
        { v: 'active', t: 'Búsqueda activa' },
        { v: 'open', t: 'Abierto a oportunidades' },
        { v: 'exploring', t: 'Solo explorando' }
      ]
    },
    {
      id: 'search-duration', section: 'status', type: 'single',
      title: '¿Cuánto tiempo llevas buscando trabajo?',
      key: 'searchDuration', required: true,
      options: [
        { v: 'new', t: 'Recién empecé (< 1 mes)' },
        { v: '1-3', t: '1–3 meses' },
        { v: '3-6', t: '3–6 meses' },
        { v: '6+', t: '6+ meses' },
        { v: 'not', t: 'No busco activamente' }
      ]
    },
    {
      id: 'success-rate', section: 'status', type: 'info',
      title: 'El 65% de nuestros miembros encuentran trabajo en el primer mes',
      subtitle: 'Nuestros miembros reciben respuestas mucho más rápido.',
      body: '<div class="stat-compare"><div class="stat-col"><div class="stat-bar" style="height:90%"></div><span>Miembros instaWork</span><b>~90%</b><small>en 7 semanas</small></div><div class="stat-col"><div class="stat-bar muted" style="height:30%"></div><span>Candidato promedio</span><b>~30%</b><small>en 7 semanas</small></div></div>'
    },

    /* ── OBJETIVOS ── */
    {
      id: 'goals', section: 'goals', type: 'multi',
      title: '¿Qué estás buscando?',
      key: 'goals', required: true, min: 1,
      options: [
        { v: 'urgent', t: 'Ingreso urgente' },
        { v: 'first', t: 'Primer empleo' },
        { v: 'extra', t: 'Ingreso extra' },
        { v: 'balance', t: 'Mejor equilibrio vida-trabajo' },
        { v: 'stable', t: 'Empleo estable a largo plazo' },
        { v: 'grow', t: 'Ascender en mi carrera' },
        { v: 'change', t: 'Cambio de carrera' }
      ]
    },
    {
      id: 'goals-thanks', section: 'goals', type: 'info',
      title: '¡Gracias por compartir tus objetivos!',
      subtitle: 'Ahora responde unas breves preguntas y nuestra IA elegirá los trabajos perfectos para ti.',
      icon: '🏃'
    },

    /* ── EXPERIENCIA IA ── */
    {
      id: 'ai-experience', section: 'ai', type: 'single',
      title: '¿Has probado herramientas de IA para tu búsqueda de empleo?',
      key: 'aiExperience', required: true,
      options: [
        { v: 'yes', t: 'Sí' },
        { v: 'unsure', t: 'No estoy seguro' },
        { v: 'no', t: 'No' }
      ]
    },
    {
      id: 'ai-benefits', section: 'ai', type: 'info',
      title: 'La IA puede hacer tu búsqueda más fácil y rápida',
      subtitle: 'Postula a cientos de empleos, supera filtros ATS y accede a empleos ocultos.',
      bullets: ['Postular a cientos de empleos relevantes', 'Superar filtros ATS automáticamente', 'Acceder a empleos que no ves en portales públicos', 'Ahorrar 30+ minutos por cada postulación'],
      icon: '🚀'
    },

    /* ── PREFERENCIAS LABORALES ── */
    {
      id: 'work-type', section: 'prefs', type: 'multi',
      title: '¿A qué tipo de trabajo estás abierto?',
      key: 'workTypes', required: true, min: 1,
      options: [
        { v: 'full', t: 'Tiempo completo' },
        { v: 'part', t: 'Medio tiempo' },
        { v: 'contract', t: 'Contrato' },
        { v: 'intern', t: 'Pasantía' }
      ]
    },
    {
      id: 'salary', section: 'prefs', type: 'slider',
      title: '¿Cuál es tu salario mínimo deseado?',
      key: 'minSalary', required: true,
      min: 0, max: 5000000, step: 50000, default: 800000, currency: 'CLP',
      format: (v) => v >= 5000000 ? '$5.000.000+' : '$' + Number(v).toLocaleString('es-CL')
    },
    {
      id: 'work-format', section: 'prefs', type: 'multi',
      title: '¿Qué tipo de trabajos prefieres?',
      key: 'workFormat', required: true, min: 1,
      options: [
        { v: 'remote', t: 'Totalmente remoto' },
        { v: 'hybrid', t: 'Híbrido' },
        { v: 'onsite', t: 'Presencial' }
      ]
    },
    {
      id: 'remote-benefits', section: 'prefs', type: 'multi',
      title: '¿Qué es lo que más te gusta del trabajo remoto?',
      key: 'remoteBenefits', required: true, min: 1,
      show: (S) => (S.workFormat || []).includes('remote'),
      options: [
        { v: 'commute', t: 'Sin desplazamiento' },
        { v: 'flex', t: 'Horario flexible' },
        { v: 'anywhere', t: 'Trabajar desde cualquier lugar' },
        { v: 'focus', t: 'Mejor concentración' },
        { v: 'family', t: 'Más tiempo con la familia' }
      ]
    },
    {
      id: 'remote-locations', section: 'prefs', type: 'locations',
      title: '¿Dónde te gustaría trabajar remotamente?',
      key: 'remoteLocations', required: true, min: 1,
      show: (S) => (S.workFormat || []).includes('remote'),
      presets: ['Chile', 'Latinoamérica', 'Europa', 'Norteamérica', 'Mundial']
    },
    {
      id: 'onsite-locations', section: 'prefs', type: 'locations',
      title: '¿Dónde te gustaría trabajar de forma presencial?',
      key: 'onsiteLocations', required: true, min: 1,
      show: (S) => (S.workFormat || []).includes('onsite') || (S.workFormat || []).includes('hybrid'),
      presets: ['Santiago', 'Valparaíso', 'Concepción', 'Remoto en Chile']
    },
    {
      id: 'work-auth', section: 'prefs', type: 'auth',
      title: '¿Cuál es tu estado de autorización de trabajo?',
      subtitle: 'Esto nos ayuda a emparejarte con roles que realmente puedes tomar.',
      key: 'workAuth', required: true,
      countries: ['Chile', 'Argentina', 'Perú', 'Colombia', 'México', 'España', 'Otro'],
      statuses: ['Ciudadano / residente permanente', 'Visa de trabajo vigente', 'Autorización temporal', 'Requiere patrocinio', 'No estoy seguro']
    },

    /* ── TU PERFIL (background) ── */
    { id: 'titles', section: 'background', type: 'custom-titles' },
    {
      id: 'education', section: 'background', type: 'single',
      title: '¿Cuál es tu nivel de estudios más alto?',
      key: 'education', required: true,
      options: [
        { v: 'none', t: 'Sin educación formal' },
        { v: 'highschool', t: 'Secundaria' },
        { v: 'associate', t: 'Técnico / Asociado' },
        { v: 'bachelor', t: 'Licenciatura' },
        { v: 'master', t: 'Maestría' },
        { v: 'professional', t: 'Profesional (JD, MD, etc.)' },
        { v: 'phd', t: 'Doctorado' }
      ]
    },
    {
      id: 'exp-years', section: 'background', type: 'single',
      title: '¿Cuántos años de experiencia laboral total tienes?',
      key: 'expYears', required: true,
      options: [
        { v: '0-1', t: '0–1 año' },
        { v: '2-4', t: '2–4 años' },
        { v: '5-9', t: '5–9 años' },
        { v: '10-19', t: '10–19 años' },
        { v: '20+', t: '20+ años' }
      ]
    },
    {
      id: 'prof-level', section: 'background', type: 'single',
      title: '¿Cuál es tu nivel profesional actual?',
      key: 'profLevel', required: true,
      options: [
        { v: 'entry', t: 'Entry' },
        { v: 'junior', t: 'Junior (< 2 años)' },
        { v: 'middle', t: 'Middle (2–4 años)' },
        { v: 'senior', t: 'Senior (5+ años)' },
        { v: 'lead', t: 'Lead / Manager' },
        { v: 'director', t: 'Director' },
        { v: 'vp', t: 'VP / C-level' }
      ]
    },
    {
      id: 'lower-level', section: 'background', type: 'single',
      title: '¿Estás abierto a puestos de nivel inferior?',
      key: 'lowerLevel', required: true,
      options: [
        { v: 'yes', t: 'Sí, si es necesario' },
        { v: 'maybe', t: 'Tal vez, si encaja bien' },
        { v: 'no', t: 'No, solo mi nivel o superior' }
      ]
    },
    {
      id: 'flexibility-info', section: 'background', type: 'info',
      title: 'Estrategia inteligente en el mercado actual',
      subtitle: 'Ser flexible en nivel y ubicación te da hasta 2× más oportunidades.',
      icon: '🧭'
    },
    {
      id: 'last-change', section: 'background', type: 'single',
      title: '¿Cuándo fue tu último cambio de trabajo?',
      key: 'lastJobChange', required: true,
      options: [
        { v: 'year', t: 'En el último año' },
        { v: '1-3', t: 'Hace 1–3 años' },
        { v: '3+', t: 'Hace más de 3 años' },
        { v: 'never', t: 'Nunca he cambiado de trabajo' },
        { v: 'first', t: 'Busco mi primer empleo' }
      ]
    },
    {
      id: 'strategies', section: 'background', type: 'multi',
      title: '¿Qué estrategias de búsqueda has probado?',
      key: 'strategies', required: true, min: 1,
      options: [
        { v: 'boards', t: 'Portales de empleo (LinkedIn, Indeed, etc.)' },
        { v: 'referral', t: 'Referido de empleado' },
        { v: 'agency', t: 'Agencias de reclutamiento' },
        { v: 'network', t: 'Networking (eventos, comunidades)' },
        { v: 'social', t: 'Blog / redes sociales personales' },
        { v: 'other', t: 'Otro' }
      ]
    },
    {
      id: 'market-pain', section: 'background', type: 'info',
      title: 'El mercado laboral se volvió brutal',
      bullets: ['Cientos de postulantes por cada rol', 'CVs que nunca llegan a humanos', '80% de ofertas obsoletas o falsas', 'Formularios repetitivos sin fin'],
      icon: '😤'
    },

    /* ── CÓMO AYUDAMOS ── */
    {
      id: 'puzzle-info', section: 'help', type: 'info',
      title: 'Hemos resuelto el rompecabezas de la búsqueda de empleo',
      subtitle: 'Hemos analizado millones de empleos para miles de usuarios.',
      icon: '🧩'
    },
    {
      id: 'yn-linkedin', section: 'help', type: 'yesno',
      title: '¿Te identificas con la siguiente afirmación?',
      statement: 'Cada empleo que me gusta en LinkedIn ya tiene más de 200 solicitudes.',
      key: 'ynLinkedin', required: true
    },
    {
      id: 'bad-news', section: 'help', type: 'info',
      title: 'Noticias no tan buenas',
      subtitle: 'El 57% de los empleos remotos reciben más de 300 solicitudes en las primeras 24 horas.',
      icon: '📊'
    },
    {
      id: 'good-news', section: 'help', type: 'info',
      title: 'Buenas noticias para ti',
      subtitle: 'Escaneamos empleos nuevos cada hora y postulamos solo a los que realmente encajan.',
      icon: '🔍'
    },
    {
      id: 'yn-blackhole', section: 'help', type: 'yesno',
      title: '¿Te identificas con la siguiente afirmación?',
      statement: 'Me preocupa que mi currículum simplemente desaparezca en un agujero negro.',
      key: 'ynBlackhole', required: true
    },
    {
      id: 'truth-listings', section: 'help', type: 'info',
      title: 'La verdad sobre las ofertas de trabajo',
      subtitle: 'El 80% de las ofertas no están realmente activas. Nuestra IA encuentra y postula al otro 20% que sí lo están.',
      icon: '📋'
    },
    {
      id: 'yn-ats', section: 'help', type: 'yesno',
      title: '¿Te identificas con la siguiente afirmación?',
      statement: 'Me preocupa que un ATS filtre mi currículum antes de que un humano lo vea.',
      key: 'ynAts', required: true
    },
    {
      id: 'ats-info', section: 'help', type: 'info',
      title: 'De agujeros negros a respuestas',
      subtitle: 'Optimizamos tu currículum para cada empleo para que pase los filtros ATS y llegue a los reclutadores.',
      icon: '🖨️'
    },
    {
      id: 'schedule', section: 'help', type: 'single',
      title: '¿Qué horario prefieres?',
      key: 'schedule', required: true,
      options: [
        { v: 'flex', t: 'Horario flexible' },
        { v: 'fixed', t: 'Horario fijo 9 a 5' }
      ]
    },
    {
      id: 'team-size', section: 'help', type: 'multi',
      title: '¿Qué tamaño de equipo prefieres?',
      key: 'teamSize', required: true, min: 1,
      options: [
        { v: 'big', t: 'Equipos grandes' },
        { v: 'small', t: 'Equipos pequeños' },
        { v: 'solo', t: 'Independiente' }
      ]
    },
    {
      id: 'company-size', section: 'help', type: 'multi',
      title: '¿Qué tamaño de empresa prefieres?',
      key: 'companySize', required: true, min: 1,
      options: [
        { v: 'startup', t: 'Startup' },
        { v: 'mid', t: 'Mediana' },
        { v: 'corp', t: 'Corporación' }
      ]
    },
    {
      id: 'benefits', section: 'help', type: 'multi',
      title: '¿Qué beneficios te importan más?',
      key: 'benefits', required: true, min: 1,
      options: [
        { v: 'health', t: 'Seguro médico' },
        { v: 'pension', t: 'AFP / pensión' },
        { v: 'pto', t: 'Vacaciones pagadas' },
        { v: 'remote', t: 'Flexibilidad remota' },
        { v: 'stock', t: 'Opciones de acciones' },
        { v: 'learning', t: 'Presupuesto de formación' },
        { v: 'parental', t: 'Licencia parental' },
        { v: 'wellness', t: 'Gimnasio / bienestar' }
      ]
    },
    {
      id: 'iceberg', section: 'help', type: 'info',
      title: 'Accede a más de 750 mil empleos ocultos mensualmente',
      subtitle: 'La mayoría de candidatos solo ven 1/4 de las oportunidades.',
      body: '<div class="iceberg"><div class="iceberg-tip">Portales públicos</div><div class="iceberg-body">750k+ empleos ocultos</div></div>'
    },
    {
      id: 'yn-mismatch', section: 'help', type: 'yesno',
      title: '¿Te identificas con la siguiente afirmación?',
      statement: 'Rara vez encuentro ofertas de trabajo que realmente coincidan con mi perfil.',
      key: 'ynMismatch', required: true
    },
    {
      id: 'match-compare', section: 'help', type: 'info',
      title: 'Una forma más inteligente de encontrar trabajo',
      subtitle: 'Nuestro emparejamiento supera a las bolsas genéricas en relevancia.',
      body: '<div class="match-compare"><div class="match-col"><h4>LinkedIn / Indeed</h4><div class="match-bar low" style="width:62%">62%</div><div class="match-bar low" style="width:71%">71%</div><div class="match-bar mid" style="width:83%">83%</div></div><div class="match-col"><h4>Nuestro match</h4><div class="match-bar high" style="width:100%">100%</div><div class="match-bar high" style="width:95%">95%</div><div class="match-bar high" style="width:94%">94%</div></div></div>'
    },
    {
      id: 'yn-forms', section: 'help', type: 'yesno',
      title: '¿Te identificas con la siguiente afirmación?',
      statement: 'Estoy harto de llenar los mismos formularios de solicitud una y otra vez.',
      key: 'ynForms', required: true
    },
    {
      id: 'forms-pain', section: 'help', type: 'info',
      title: 'Es incluso peor de lo que parece',
      bullets: ['Una postulación puede tomar 30+ minutos', 'El 90% es entrada de datos repetitiva', 'La mayoría pasa más tiempo en formularios que en búsqueda real'],
      icon: '📝'
    },
    {
      id: 'daily-time', section: 'help', type: 'single',
      title: '¿Cuánto tiempo puedes dedicar a aplicar diariamente?',
      key: 'dailyTime', required: true,
      options: [
        { v: '3-4h', t: '3–4 horas' },
        { v: '1-2h', t: '1–2 horas' },
        { v: '30-60m', t: '30–60 min' },
        { v: '10-30m', t: '10–30 min' },
        { v: 'busy', t: 'Demasiado ocupado para aplicar' }
      ]
    },
    {
      id: 'barriers', section: 'help', type: 'multi',
      title: '¿Qué te impide postularte a más trabajos?',
      key: 'barriers', required: true, min: 1,
      options: [
        { v: 'time', t: 'No tengo suficiente tiempo' },
        { v: 'forms', t: 'Los formularios son agotadores' },
        { v: 'track', t: 'Demasiadas opciones para seguir' },
        { v: 'deadlines', t: 'Los plazos pasan muy rápido' },
        { v: 'lose', t: 'Pierdo el rastro de las postulaciones' },
        { v: 'distract', t: 'Me distraigo de postular' }
      ]
    },
    {
      id: 'volume-info', section: 'help', type: 'info',
      title: 'Más postulaciones con instaWork',
      subtitle: 'Los miembros postulan aproximadamente diez veces más empleos relevantes de los que podrían hacer a mano.',
      icon: '📈'
    },

    /* ── TU INFORMACIÓN (datos + CV) ── */
    { id: 'terms', section: 'data', type: 'custom-terms' },
    { id: 'cv-upload', section: 'data', type: 'custom-cv' },
    { id: 'cv-reading', section: 'data', type: 'custom-cv-reading' },
    { id: 'photo', section: 'data', type: 'custom-photo' },
    { id: 'personal', section: 'data', type: 'custom-personal' },
    { id: 'address', section: 'data', type: 'custom-address' },
    { id: 'experience', section: 'data', type: 'custom-experience' },
    { id: 'references', section: 'data', type: 'custom-references' },
    { id: 'exclude', section: 'data', type: 'custom-exclude' },
    { id: 'demographics', section: 'data', type: 'custom-demographics' },
    { id: 'inbox', section: 'data', type: 'custom-inbox' },
    { id: 'mode', section: 'data', type: 'custom-mode' },

    /* ── PASO FINAL ── */
    { id: 'matching', section: 'final', type: 'matching' },
    { id: 'generating', section: 'final', type: 'custom-generating' },
    { id: 'done', section: 'final', type: 'custom-done' }
  ];

  window.OnboardingFlow = { SECTIONS, STEPS };
})();
