/**
 * instaWork — Motor de análisis local (SIN llamadas a APIs).
 * Analiza el texto de un CV (o perfil pegado) y concluye:
 *   - habilidades detectadas
 *   - rubro/área dominante
 *   - puestos (títulos) recomendados con nivel de confianza
 *
 * Cubre TODAS las áreas del mercado laboral (LATAM), no solo tecnología.
 * Expone la misma API que usaba la versión con Gemini, pero 100% local.
 */

// ---------- utilidades ----------
function norm(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/\s+/g, ' ')
    .trim();
}
function esc(s) {
  return (s || '').toString().replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
// coincidencia por límites de palabra (permite + # . para c++, c#, node.js, .net)
function hasPhrase(hay, phrase) {
  const p = norm(phrase);
  if (!p) return false;
  const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(^|[^a-z0-9+#.])' + esc + '([^a-z0-9+#]|$)');
  return re.test(hay);
}

function firstIndex(hay, phrase) {
  const p = norm(phrase);
  if (!p) return -1;
  const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(^|[^a-z0-9+#.])' + esc + '([^a-z0-9+#]|$)');
  const m = re.exec(hay);
  return m ? m.index : -1;
}
function recencyWeight(idx, L) {
  if (idx < 0) return 0;
  const p = L > 0 ? idx / L : 0;
  return p < 0.33 ? 1.6 : (p < 0.66 ? 1.0 : 0.5);
}
const BROAD_SKILL = new Set(['Atención al Cliente','Ventas','Operaciones','Administración','Mantenimiento','Producción','Compras','Data Entry','Office','Inventario','Despacho','Bodega','Comunicaciones','Publicidad','Fotografía','Docencia','Turismo','Hotelería','Retail']);
const GENERIC_KW = new Set(['ventas','atencion al cliente','servicio al cliente','operaciones','mantenimiento','administracion','office','excel','proyectos','equipo','kpi','presupuesto','agenda','reportes','b2b','b2c','crm','contenido']);

// ---------- TAXONOMÍA DE HABILIDADES ----------
// [displayName, categoria, ...alias]
const SKILLS = [
  // Programación / Software
  ['JavaScript','tech','javascript','js'],['TypeScript','tech','typescript','ts'],
  ['React','tech','react','react.js','reactjs'],['Vue','tech','vue','vue.js','vuejs'],
  ['Angular','tech','angular'],['Svelte','tech','svelte'],['Next.js','tech','next.js','nextjs'],
  ['Node.js','tech','node.js','nodejs','node'],['Python','tech','python'],['Java','tech','java'],
  ['PHP','tech','php'],['Laravel','tech','laravel'],['Symfony','tech','symfony'],
  ['Ruby','tech','ruby','rails','ruby on rails'],['Go','tech','golang','go'],['Rust','tech','rust'],
  ['C#','tech','c#','.net','dotnet','asp.net'],['C++','tech','c++'],
  ['Kotlin','tech','kotlin'],['Swift','tech','swift'],['Flutter','tech','flutter','dart'],
  ['React Native','tech','react native'],['Django','tech','django'],['Flask','tech','flask'],
  ['FastAPI','tech','fastapi'],['Spring','tech','spring','spring boot'],['Express','tech','express'],
  ['HTML','tech','html','html5'],['CSS','tech','css','css3'],['Tailwind','tech','tailwind'],
  ['Bootstrap','tech','bootstrap'],['Sass','tech','sass','scss'],['GraphQL','tech','graphql'],
  ['REST API','tech','rest','api rest','restful'],['WordPress','web','wordpress'],
  ['Shopify','web','shopify'],['WooCommerce','web','woocommerce'],['Webflow','web','webflow'],
  ['Wix','web','wix'],['Magento','web','magento'],['Git','tech','git','github','gitlab'],
  // Data / IA
  ['SQL','data','sql'],['PostgreSQL','data','postgresql','postgres'],['MySQL','data','mysql'],
  ['MongoDB','data','mongodb','mongo'],['Redis','data','redis'],['Power BI','data','power bi','powerbi'],
  ['Tableau','data','tableau'],['Looker','data','looker'],['Excel','data','excel','planilla'],
  ['Google Sheets','data','google sheets','sheets'],['Pandas','data','pandas'],['NumPy','data','numpy'],
  ['Machine Learning','data','machine learning','aprendizaje automatico','ml'],
  ['Deep Learning','data','deep learning'],['TensorFlow','data','tensorflow'],['PyTorch','data','pytorch'],
  ['Scikit-learn','data','scikit-learn','sklearn'],['Spark','data','spark','pyspark'],
  ['ETL','data','etl'],['BigQuery','data','bigquery'],['Snowflake','data','snowflake'],
  ['Estadística','data','estadistica','statistics'],['R','data','rstudio'],
  // DevOps / Cloud
  ['AWS','cloud','aws','amazon web services'],['Azure','cloud','azure'],['GCP','cloud','gcp','google cloud'],
  ['Docker','cloud','docker'],['Kubernetes','cloud','kubernetes','k8s'],['Terraform','cloud','terraform'],
  ['CI/CD','cloud','ci/cd','ci cd','jenkins','github actions'],['Linux','cloud','linux','unix'],
  ['Ansible','cloud','ansible'],['Nginx','cloud','nginx'],
  // Ciberseguridad
  ['Ciberseguridad','security','ciberseguridad','cybersecurity','seguridad informatica'],
  ['Pentesting','security','pentesting','ethical hacking','hacking etico'],
  ['SIEM','security','siem'],['ISO 27001','security','iso 27001'],['Firewall','security','firewall'],
  // QA
  ['QA','qa','qa','testing','aseguramiento de calidad','quality assurance'],
  ['Selenium','qa','selenium'],['Cypress','qa','cypress'],['Automatizacion de pruebas','qa','automatizacion de pruebas','test automation'],
  // Diseño
  ['Figma','design','figma'],['Adobe XD','design','adobe xd'],['Sketch','design','sketch'],
  ['Photoshop','design','photoshop'],['Illustrator','design','illustrator'],['InDesign','design','indesign'],
  ['Premiere','design','premiere','premiere pro'],['After Effects','design','after effects'],
  ['UX','design','ux','experiencia de usuario'],['UI','design','ui','interfaz de usuario'],
  ['Diseño gráfico','design','diseno grafico','graphic design'],['Branding','design','branding','identidad de marca'],
  ['Canva','design','canva'],['Motion Graphics','design','motion graphics'],['3D','design','blender','3d','maya'],
  // Producto / PM / Agile
  ['Product Management','pm','product management','gestion de producto'],
  ['Scrum','pm','scrum'],['Agile','pm','agile','agil','metodologias agiles'],['Kanban','pm','kanban'],
  ['Jira','pm','jira'],['Notion','pm','notion'],['Trello','pm','trello'],['Asana','pm','asana'],
  ['Roadmap','pm','roadmap'],['PMP','pm','pmp','project management professional'],
  // Marketing / Growth
  ['SEO','marketing','seo','posicionamiento web'],['SEM','marketing','sem'],
  ['Google Ads','marketing','google ads','adwords'],['Meta Ads','marketing','meta ads','facebook ads'],
  ['TikTok Ads','marketing','tiktok ads'],['Google Analytics','marketing','google analytics','ga4'],
  ['Marketing Digital','marketing','marketing digital','digital marketing'],
  ['Email Marketing','marketing','email marketing','mailchimp'],['CRM','marketing','crm'],
  ['HubSpot','marketing','hubspot'],['Growth','marketing','growth','growth hacking'],
  ['Copywriting','marketing','copywriting','redaccion publicitaria'],['Content','marketing','content marketing','marketing de contenidos'],
  ['Community Manager','marketing','community manager','redes sociales','social media'],
  ['Branding','marketing','branding'],['Publicidad','marketing','publicidad','advertising'],
  // Ventas / Comercial
  ['Ventas','sales','ventas','sales'],['Ventas B2B','sales','b2b'],['Ventas B2C','sales','b2c'],
  ['Salesforce','sales','salesforce'],['Prospección','sales','prospeccion','prospecting'],
  ['Negociación','sales','negociacion','negotiation'],['KAM','sales','kam','key account'],
  ['Retail','sales','retail'],['Telemarketing','sales','telemarketing','call center'],
  // Finanzas / Contabilidad
  ['Contabilidad','finance','contabilidad','accounting'],['Finanzas','finance','finanzas','finance'],
  ['Auditoría','finance','auditoria','audit'],['Tributación','finance','tributacion','impuestos','tax'],
  ['SAP','finance','sap'],['NIIF','finance','niif','ifrs'],['Tesorería','finance','tesoreria','treasury'],
  ['Costos','finance','costos','costeo'],['Presupuesto','finance','presupuesto','budget'],
  ['Facturación','finance','facturacion','billing'],['Remuneraciones','finance','remuneraciones','payroll','nomina'],
  ['Análisis Financiero','finance','analisis financiero','financial analysis'],
  // RRHH
  ['Reclutamiento','hr','reclutamiento','recruiting','seleccion de personal','talent acquisition'],
  ['RRHH','hr','recursos humanos','rrhh','human resources','gestion de personas'],
  ['Capacitación','hr','capacitacion','training'],['Clima Laboral','hr','clima laboral'],
  ['Onboarding','hr','onboarding'],
  // Legal
  ['Derecho','legal','derecho','abogacia','legal'],['Derecho Laboral','legal','derecho laboral'],
  ['Derecho Tributario','legal','derecho tributario'],['Contratos','legal','contratos','contract'],
  ['Compliance','legal','compliance','cumplimiento normativo'],['Litigios','legal','litigios','litigation'],
  // Salud
  ['Enfermería','health','enfermeria','nursing'],['Medicina','health','medicina','medico'],
  ['Kinesiología','health','kinesiologia','fisioterapia','physiotherapy'],
  ['Odontología','health','odontologia','dentista'],['Psicología','health','psicologia'],
  ['Nutrición','health','nutricion','dietetica'],['Farmacia','health','farmacia','quimico farmaceutico'],
  ['Matronería','health','matroneria','matrona','obstetricia'],['Tecnología Médica','health','tecnologia medica','tecnologo medico'],
  ['Fonoaudiología','health','fonoaudiologia'],['Terapia Ocupacional','health','terapia ocupacional'],
  ['Salud Pública','health','salud publica','public health'],['Cuidados','health','cuidados','cuidado de adultos','cuidadora'],
  // Educación
  ['Docencia','education','docencia','profesor','profesora','teaching','pedagogia'],
  ['Educación Parvularia','education','educacion parvularia','educadora de parvulos'],
  ['Educación Diferencial','education','educacion diferencial'],['Tutoría','education','tutoria','tutor'],
  ['Inglés','education','ingles','english'],
  // Ingeniería / Construcción / Arquitectura
  ['Ingeniería Civil','eng','ingenieria civil','civil engineering'],
  ['Ingeniería Industrial','eng','ingenieria industrial','industrial engineering'],
  ['Ingeniería Mecánica','eng','ingenieria mecanica','mechanical'],
  ['Ingeniería Eléctrica','eng','ingenieria electrica','electrical engineering'],
  ['Ingeniería Química','eng','ingenieria quimica'],['Ingeniería Ambiental','eng','ingenieria ambiental'],
  ['AutoCAD','eng','autocad'],['Revit','eng','revit'],['SolidWorks','eng','solidworks'],
  ['Arquitectura','construction','arquitectura','architecture','arquitecto'],
  ['Construcción','construction','construccion','obra','construction'],
  ['BIM','construction','bim'],['Prevención de Riesgos','construction','prevencion de riesgos','prevencionista','hse','seguridad y salud ocupacional'],
  ['Topografía','construction','topografia'],
  // Logística / Supply Chain
  ['Logística','logistics','logistica','logistics'],['Supply Chain','logistics','supply chain','cadena de suministro'],
  ['Comercio Exterior','logistics','comercio exterior','foreign trade'],['Importación','logistics','importacion','exportacion'],
  ['Bodega','logistics','bodega','warehouse','almacen'],['Inventario','logistics','inventario','inventory'],
  ['Compras','logistics','compras','procurement','abastecimiento'],['Despacho','logistics','despacho','distribucion'],
  // Operaciones / Producción
  ['Producción','ops','produccion','manufactura','manufacturing'],['Lean','ops','lean','lean manufacturing'],
  ['Control de Calidad','ops','control de calidad','calidad'],['Mantenimiento','ops','mantenimiento','maintenance'],
  ['Operaciones','ops','operaciones','operations'],
  // Administración / Asistente
  ['Administración','admin','administracion','administrativo','administrative'],
  ['Asistente','admin','asistente','secretaria','secretariado','recepcionista','recepcion'],
  ['Atención al Cliente','admin','atencion al cliente','customer service','servicio al cliente'],
  ['Data Entry','admin','data entry','digitacion'],['Office','admin','microsoft office','word','powerpoint'],
  // Gastronomía / Turismo / Hotelería
  ['Cocina','gastro','cocina','cocinero','chef','gastronomia','culinary'],
  ['Repostería','gastro','reposteria','pasteleria'],['Bartender','gastro','bartender','barman'],
  ['Garzón','gastro','garzon','mesero','mozo','waiter'],['Hotelería','gastro','hoteleria','hospitality'],
  ['Turismo','gastro','turismo','tourism'],['Barista','gastro','barista'],
  // Ciencia / Investigación
  ['Investigación','science','investigacion','research'],['Laboratorio','science','laboratorio','lab'],
  ['Biología','science','biologia','biology'],['Química','science','quimica','chemistry'],
  ['Biotecnología','science','biotecnologia'],
  // Medios / Comunicación / Audiovisual
  ['Periodismo','media','periodismo','journalism','periodista'],
  ['Comunicaciones','media','comunicaciones','comunicacion','communications'],
  ['Producción Audiovisual','media','produccion audiovisual','audiovisual'],
  ['Edición de Video','media','edicion de video','video editing'],['Fotografía','media','fotografia','photography'],
  ['Locución','media','locucion','doblaje'],['Relaciones Públicas','media','relaciones publicas','rrpp','pr'],
  // Traducción / Idiomas
  ['Traducción','lang','traduccion','translation','interprete','traductor'],
  // Arte / Música
  ['Música','arts','musica','music','musico'],['Ilustración','arts','ilustracion','illustration'],
  // Agro
  ['Agronomía','agro','agronomia','agronomo','agriculture'],['Agrícola','agro','agricola','agricultura'],
  ['Veterinaria','agro','veterinaria','veterinario'],
  // Belleza
  ['Peluquería','beauty','peluqueria','estilista','barberia'],['Estética','beauty','estetica','cosmetologia'],
  ['Manicure','beauty','manicure','manicurista'],['Maquillaje','beauty','maquillaje','makeup'],
  // Seguridad / Guardia
  ['Guardia de Seguridad','safety','guardia','vigilante','seguridad privada','nochero'],
  // Transporte
  ['Conductor','transport','conductor','chofer','driver','licencia a2','licencia a4','licencia b'],
  ['Repartidor','transport','repartidor','delivery','despachador'],['Grúa','transport','grua','operador de grua'],
  // Oficios / Trades
  ['Electricista','trades','electricista','electrician'],['Gásfiter','trades','gasfiter','plomero','plumber','fontanero'],
  ['Soldador','trades','soldador','soldadura','welding','welder'],['Carpintero','trades','carpintero','carpinteria','carpenter'],
  ['Mecánico Automotriz','trades','mecanico automotriz','mecanico','automotriz'],['Maestro','trades','maestro','albanil','albanileria'],
  ['Pintor','trades','pintor','pintura'],['Operador de Maquinaria','trades','operador de maquinaria','maquinaria pesada'],
  // Inmobiliaria / Seguros / Minería / Energía
  ['Inmobiliaria','realestate','inmobiliaria','corredor de propiedades','real estate','bienes raices'],
  ['Seguros','insurance','seguros','corredor de seguros','insurance'],
  ['Minería','mining','mineria','mining','minero'],['Energía','energy','energia','energias renovables','solar'],
];

// ---------- ONTOLOGÍA DE PUESTOS ----------
// { t:'Título mostrado', c:'categoria', title:[frases fuertes], kw:[señales] }
const ROLES = [
  // Dirección / Gerencia
  { t:'Country Manager / Gerente General', c:'exec', title:['country manager','general manager','gerente general','director general','gerente de pais','gerente pais'], kw:['estrategia','expansion','operaciones','presupuesto','equipo'] },
  { t:'Head of Marketing / CMO', c:'marketing', title:['head of marketing','cmo','chief marketing officer','director de marketing','directora de marketing','gerente de marketing','jefe de marketing','marketing manager'], kw:['marketing digital','branding','growth','estrategia de marketing','presupuesto'] },
  // Tech
  { t:'Frontend Developer', c:'tech', title:['frontend','front end','front-end','desarrollador frontend'], kw:['react','vue','angular','javascript','typescript','html','css','tailwind','next.js'] },
  { t:'Backend Developer', c:'tech', title:['backend','back end','back-end','desarrollador backend'], kw:['node.js','python','java','php','laravel','django','spring','.net','go','rest','sql','express'] },
  { t:'Full Stack Developer', c:'tech', title:['full stack','fullstack','full-stack'], kw:['react','node.js','javascript','typescript','python','php'] },
  { t:'WordPress Developer', c:'web', title:['wordpress developer','desarrollador wordpress'], kw:['wordpress','woocommerce','elementor','php'] },
  { t:'Shopify Developer', c:'web', title:['shopify developer'], kw:['shopify','liquid','woocommerce'] },
  { t:'Desarrollador Web', c:'web', title:['desarrollador web','web developer','programador web'], kw:['html','css','javascript','wordpress','webflow','wix'] },
  { t:'Mobile Developer', c:'tech', title:['mobile developer','desarrollador movil','android developer','ios developer'], kw:['flutter','react native','kotlin','swift','android','ios'] },
  { t:'Software Engineer', c:'tech', title:['software engineer','ingeniero de software','desarrollador de software','programador'], kw:['java','python','c#','c++','go','git','api'] },
  { t:'QA Engineer', c:'qa', title:['qa','tester','ingeniero qa','analista qa','quality assurance'], kw:['selenium','cypress','testing','automatizacion de pruebas'] },
  { t:'DevOps Engineer', c:'cloud', title:['devops','sre','site reliability'], kw:['docker','kubernetes','terraform','ci/cd','aws','azure','gcp','linux','ansible'] },
  { t:'Cloud Engineer', c:'cloud', title:['cloud engineer','arquitecto cloud'], kw:['aws','azure','gcp','terraform','kubernetes'] },
  { t:'Data Analyst', c:'data', title:['data analyst','analista de datos','analista bi'], kw:['sql','power bi','tableau','excel','looker','google analytics'] },
  { t:'Data Scientist', c:'data', title:['data scientist','cientifico de datos'], kw:['python','machine learning','pandas','scikit-learn','estadistica','deep learning'] },
  { t:'Data Engineer', c:'data', title:['data engineer','ingeniero de datos'], kw:['etl','spark','sql','bigquery','snowflake','python'] },
  { t:'Machine Learning Engineer', c:'data', title:['machine learning engineer','ingeniero de machine learning','ml engineer'], kw:['tensorflow','pytorch','machine learning','deep learning','python'] },
  { t:'Ciberseguridad / Security Analyst', c:'security', title:['ciberseguridad','security analyst','analista de seguridad','pentester'], kw:['pentesting','siem','iso 27001','firewall','ethical hacking'] },
  // Diseño / Producto
  { t:'Diseñador UX/UI', c:'design', title:['ux','ui','ux/ui','product designer','diseñador ux','diseñador ui'], kw:['figma','adobe xd','sketch','experiencia de usuario','interfaz de usuario'] },
  { t:'Diseñador Gráfico', c:'design', title:['diseñador grafico','graphic designer','diseñador'], kw:['photoshop','illustrator','indesign','branding','canva','diseno grafico'] },
  { t:'Motion / Audiovisual Designer', c:'design', title:['motion','editor de video','audiovisual'], kw:['after effects','premiere','motion graphics','edicion de video','3d'] },
  { t:'Product Manager', c:'pm', title:['product manager','gerente de producto','po','product owner'], kw:['product management','roadmap','scrum','agile','jira'] },
  { t:'Project Manager', c:'pm', title:['project manager','jefe de proyecto','gerente de proyecto','pmo'], kw:['pmp','scrum','agile','jira','kanban','gestion de proyectos'] },
  { t:'Scrum Master', c:'pm', title:['scrum master','agile coach'], kw:['scrum','agile','kanban'] },
  // Marketing / Ventas
  { t:'Marketing Digital', c:'marketing', title:['marketing digital','digital marketing','especialista en marketing'], kw:['seo','sem','google ads','meta ads','google analytics','email marketing'] },
  { t:'Growth / Performance Marketing', c:'marketing', title:['growth','performance marketing','paid media','paid media manager','media buyer','performance'], kw:['google ads','meta ads','tiktok ads','growth hacking','sem','roas','cac','conversiones'] },
  { t:'Community Manager', c:'marketing', title:['community manager','social media','redes sociales'], kw:['instagram','tiktok','canva','contenido','copywriting'] },
  { t:'Content / Copywriter', c:'marketing', title:['copywriter','content','redactor','creador de contenido'], kw:['copywriting','content marketing','seo','redaccion'] },
  { t:'SEO Specialist', c:'marketing', title:['seo specialist','especialista seo'], kw:['seo','sem','google analytics','posicionamiento web'] },
  { t:'Ejecutivo Comercial / Ventas', c:'sales', title:['ejecutivo comercial','ejecutivo de ventas','vendedor','vendedora','asesor comercial','sales'], kw:['ventas','prospeccion','negociacion','crm','b2b','b2c'] },
  { t:'Key Account Manager', c:'sales', title:['key account','kam','account manager','ejecutivo de cuentas'], kw:['ventas','crm','salesforce','b2b','negociacion'] },
  { t:'Jefe / Gerente Comercial', c:'sales', title:['jefe comercial','gerente comercial','gerente de ventas'], kw:['ventas','equipo comercial','presupuesto','kpi'] },
  { t:'Telemarketing / Call Center', c:'sales', title:['telemarketing','call center','teleoperador','ejecutivo telefonico'], kw:['ventas telefonicas','call center','atencion telefonica'] },
  { t:'Customer Success / Soporte', c:'support', title:['customer success','soporte','atencion al cliente','mesa de ayuda','help desk'], kw:['atencion al cliente','servicio al cliente','crm','soporte tecnico'] },
  // Finanzas / RRHH / Legal
  { t:'Contador / Contadora', c:'finance', title:['contador','contadora','contador auditor','contabilidad'], kw:['contabilidad','niif','sap','tributacion','facturacion','impuestos'] },
  { t:'Analista Financiero', c:'finance', title:['analista financiero','analista de finanzas','financial analyst'], kw:['finanzas','analisis financiero','presupuesto','excel','costos'] },
  { t:'Auditor', c:'finance', title:['auditor','auditora','auditoria'], kw:['auditoria','niif','control interno','tributacion'] },
  { t:'Analista de Remuneraciones', c:'finance', title:['remuneraciones','payroll','nomina'], kw:['remuneraciones','payroll','legislacion laboral'] },
  { t:'Reclutador / Talent Acquisition', c:'hr', title:['reclutador','recruiter','talent acquisition','seleccion de personal','analista de reclutamiento'], kw:['reclutamiento','seleccion de personal','onboarding','entrevistas'] },
  { t:'Analista / Generalista RRHH', c:'hr', title:['recursos humanos','rrhh','gestion de personas','human resources','people'], kw:['recursos humanos','capacitacion','clima laboral','remuneraciones'] },
  { t:'Abogado / Abogada', c:'legal', title:['abogado','abogada','asesor legal','abogacia'], kw:['derecho','contratos','litigios','compliance','derecho laboral'] },
  // Salud
  { t:'Enfermero / Enfermera', c:'health', title:['enfermero','enfermera','enfermeria','nurse'], kw:['enfermeria','pacientes','clinica','hospital'] },
  { t:'Médico / Médica', c:'health', title:['medico','medica','doctor','medicina'], kw:['medicina','pacientes','diagnostico','clinica'] },
  { t:'Kinesiólogo / Fisioterapeuta', c:'health', title:['kinesiologo','kinesiologa','fisioterapeuta','kinesiologia'], kw:['kinesiologia','rehabilitacion','fisioterapia'] },
  { t:'Psicólogo / Psicóloga', c:'health', title:['psicologo','psicologa','psicologia'], kw:['psicologia','terapia','evaluacion psicologica'] },
  { t:'Nutricionista', c:'health', title:['nutricionista','nutricion'], kw:['nutricion','dietetica','plan alimentario'] },
  { t:'Técnico en Enfermería (TENS)', c:'health', title:['tens','tecnico en enfermeria','tecnico paramedico','auxiliar de enfermeria'], kw:['enfermeria','signos vitales','pacientes','cuidados'] },
  { t:'Cuidador / Cuidadora', c:'health', title:['cuidador','cuidadora','cuidado de adultos mayores','cuidado de personas'], kw:['cuidados','adultos mayores','pacientes'] },
  // Educación
  { t:'Profesor / Docente', c:'education', title:['profesor','profesora','docente','teacher','pedagogia','educador'], kw:['docencia','planificacion','aula','estudiantes'] },
  { t:'Educadora de Párvulos', c:'education', title:['educadora de parvulos','educacion parvularia','parvularia'], kw:['educacion parvularia','ninos','aula'] },
  { t:'Profesor de Inglés', c:'education', title:['profesor de ingles','english teacher'], kw:['ingles','tefl','docencia'] },
  // Ingeniería / Construcción
  { t:'Ingeniero Civil', c:'eng', title:['ingeniero civil','ingeniera civil','ingenieria civil'], kw:['ingenieria civil','autocad','obras','estructuras'] },
  { t:'Ingeniero Industrial', c:'eng', title:['ingeniero industrial','ingeniera industrial','ingenieria industrial'], kw:['ingenieria industrial','procesos','lean','mejora continua'] },
  { t:'Ingeniero Mecánico', c:'eng', title:['ingeniero mecanico','ingenieria mecanica'], kw:['ingenieria mecanica','solidworks','autocad','mantenimiento'] },
  { t:'Ingeniero Eléctrico', c:'eng', title:['ingeniero electrico','ingenieria electrica'], kw:['ingenieria electrica','automatizacion','plc'] },
  { t:'Arquitecto / Arquitecta', c:'construction', title:['arquitecto','arquitecta','arquitectura'], kw:['arquitectura','autocad','revit','bim','proyectos'] },
  { t:'Jefe de Obra / Constructor', c:'construction', title:['jefe de obra','constructor civil','maestro mayor','supervisor de obra'], kw:['construccion','obra','autocad','presupuesto'] },
  { t:'Prevencionista de Riesgos', c:'construction', title:['prevencionista','prevencion de riesgos','experto en prevencion','hse'], kw:['prevencion de riesgos','seguridad y salud ocupacional','hse'] },
  { t:'Dibujante Técnico / Proyectista', c:'eng', title:['dibujante','proyectista','cadista'], kw:['autocad','revit','solidworks','planos'] },
  // Logística / Ops / Admin
  { t:'Analista / Jefe de Logística', c:'logistics', title:['logistica','supply chain','jefe de logistica','coordinador logistico'], kw:['logistica','supply chain','distribucion','despacho','inventario'] },
  { t:'Comercio Exterior', c:'logistics', title:['comercio exterior','importacion','exportacion','foreign trade'], kw:['comercio exterior','importacion','exportacion','aduana'] },
  { t:'Encargado de Bodega', c:'logistics', title:['bodeguero','encargado de bodega','warehouse'], kw:['bodega','inventario','despacho','almacen'] },
  { t:'Comprador / Abastecimiento', c:'logistics', title:['comprador','abastecimiento','procurement','buyer'], kw:['compras','abastecimiento','proveedores','negociacion'] },
  { t:'Jefe de Operaciones', c:'ops', title:['jefe de operaciones','gerente de operaciones','operations manager'], kw:['operaciones','procesos','kpi','equipo'] },
  { t:'Supervisor de Producción', c:'ops', title:['supervisor de produccion','jefe de produccion','produccion'], kw:['produccion','manufactura','lean','control de calidad'] },
  { t:'Control de Calidad', c:'ops', title:['control de calidad','analista de calidad','inspector de calidad'], kw:['control de calidad','calidad','iso 9001'] },
  { t:'Asistente Administrativo', c:'admin', title:['administrativo','asistente administrativo','secretaria','recepcionista','administrative assistant'], kw:['administracion','office','excel','atencion al cliente','agenda'] },
  { t:'Analista Administrativo', c:'admin', title:['analista administrativo','encargado administrativo'], kw:['administracion','excel','facturacion','reportes'] },
  { t:'Data Entry / Digitador', c:'admin', title:['data entry','digitador','digitacion'], kw:['data entry','excel','digitacion'] },
  // Gastronomía / Retail
  { t:'Cocinero / Chef', c:'gastro', title:['cocinero','chef','cocina','jefe de cocina'], kw:['cocina','gastronomia','menu','reposteria'] },
  { t:'Garzón / Mesero', c:'gastro', title:['garzon','mesero','mozo','waiter'], kw:['atencion de mesas','restaurante','servicio'] },
  { t:'Bartender / Barista', c:'gastro', title:['bartender','barman','barista'], kw:['coctel','cafe','barra'] },
  { t:'Recepcionista / Hotelería', c:'gastro', title:['recepcionista de hotel','hoteleria','front desk'], kw:['hoteleria','recepcion','turismo','reservas'] },
  { t:'Vendedor Retail / Cajero', c:'sales', title:['vendedor retail','cajero','cajera','reponedor','atencion en tienda'], kw:['retail','caja','atencion al cliente','tienda'] },
  // Medios / Comunicación
  { t:'Periodista', c:'media', title:['periodista','periodismo','journalist'], kw:['periodismo','redaccion','noticias','comunicaciones'] },
  { t:'Comunicador / RRPP', c:'media', title:['comunicaciones','relaciones publicas','encargado de comunicaciones'], kw:['comunicaciones','relaciones publicas','prensa','contenido'] },
  { t:'Editor de Video / Audiovisual', c:'media', title:['editor de video','realizador audiovisual','audiovisual'], kw:['edicion de video','premiere','after effects','produccion audiovisual'] },
  { t:'Fotógrafo', c:'media', title:['fotografo','fotografia','photographer'], kw:['fotografia','photoshop','lightroom'] },
  { t:'Traductor / Intérprete', c:'lang', title:['traductor','interprete','translator'], kw:['traduccion','ingles','idiomas'] },
  // Ciencia / Agro / Veterinaria
  { t:'Investigador / Científico', c:'science', title:['investigador','cientifico','research'], kw:['investigacion','laboratorio','publicaciones','biologia','quimica'] },
  { t:'Analista de Laboratorio', c:'science', title:['analista de laboratorio','tecnico de laboratorio'], kw:['laboratorio','muestras','quimica','biologia'] },
  { t:'Ingeniero Agrónomo', c:'agro', title:['agronomo','ingeniero agronomo','agronomia'], kw:['agronomia','agricola','cultivos','riego'] },
  { t:'Veterinario', c:'agro', title:['veterinario','veterinaria','medico veterinario'], kw:['veterinaria','animales','clinica veterinaria'] },
  // Belleza / Seguridad / Transporte / Oficios
  { t:'Estilista / Peluquero', c:'beauty', title:['estilista','peluquero','peluquera','barbero'], kw:['peluqueria','cortes','color','barberia'] },
  { t:'Esteticista / Cosmetóloga', c:'beauty', title:['esteticista','cosmetologa','estetica'], kw:['estetica','tratamientos faciales','depilacion'] },
  { t:'Guardia de Seguridad', c:'safety', title:['guardia','vigilante','guardia de seguridad','nochero'], kw:['seguridad privada','vigilancia','os10'] },
  { t:'Conductor / Chofer', c:'transport', title:['conductor','chofer','driver','conductor profesional'], kw:['licencia a2','licencia a4','licencia b','reparto','transporte'] },
  { t:'Repartidor / Delivery', c:'transport', title:['repartidor','delivery','despachador'], kw:['reparto','delivery','moto','despacho'] },
  { t:'Electricista', c:'trades', title:['electricista','electrician'], kw:['instalaciones electricas','sec','tableros'] },
  { t:'Gásfiter / Plomero', c:'trades', title:['gasfiter','plomero','fontanero'], kw:['gasfiteria','instalaciones sanitarias','agua potable'] },
  { t:'Soldador', c:'trades', title:['soldador','soldadura','welder'], kw:['soldadura','mig','tig','arco'] },
  { t:'Carpintero / Mueblista', c:'trades', title:['carpintero','carpinteria','mueblista'], kw:['carpinteria','madera','muebles'] },
  { t:'Mecánico Automotriz', c:'trades', title:['mecanico automotriz','mecanico','automotriz'], kw:['mecanica','motor','frenos','vehiculos'] },
  { t:'Maestro / Albañil', c:'trades', title:['maestro','albanil','albanileria','maestro de la construccion'], kw:['construccion','obra gruesa','terminaciones'] },
  { t:'Operador de Maquinaria', c:'trades', title:['operador de maquinaria','operador','maquinaria pesada','operador de grua'], kw:['maquinaria pesada','excavadora','retroexcavadora','grua'] },
  // Inmobiliaria / Seguros / Minería / Energía
  { t:'Corredor de Propiedades', c:'realestate', title:['corredor de propiedades','asesor inmobiliario','real estate'], kw:['inmobiliaria','bienes raices','arriendo','ventas'] },
  { t:'Corredor de Seguros', c:'insurance', title:['corredor de seguros','ejecutivo de seguros'], kw:['seguros','polizas','siniestros','ventas'] },
  { t:'Operador Minero', c:'mining', title:['operador mina','mineria','minero'], kw:['mineria','faena','turnos','maquinaria'] },
];

// categorías -> etiqueta legible
const CAT_LABEL = {
  exec:'Dirección / Gerencia', tech:'Tecnología / Desarrollo', web:'Desarrollo Web', data:'Datos / Analítica', cloud:'Cloud / DevOps',
  security:'Ciberseguridad', qa:'QA / Testing', design:'Diseño / UX', pm:'Producto / Proyectos',
  marketing:'Marketing / Growth', sales:'Ventas / Comercial', support:'Atención / Soporte',
  finance:'Finanzas / Contabilidad', hr:'Recursos Humanos', legal:'Legal', health:'Salud',
  education:'Educación', eng:'Ingeniería', construction:'Construcción / Arquitectura',
  logistics:'Logística', ops:'Operaciones / Producción', admin:'Administración', gastro:'Gastronomía / Hotelería',
  science:'Ciencia / Investigación', media:'Comunicación / Medios', lang:'Idiomas / Traducción',
  arts:'Arte', agro:'Agro / Veterinaria', beauty:'Belleza / Estética', safety:'Seguridad',
  transport:'Transporte', trades:'Oficios', realestate:'Inmobiliaria', insurance:'Seguros',
  mining:'Minería', energy:'Energía'
};

// ---------- núcleo ----------
function detectSkills(text) {
  const hay = ' ' + norm(text) + ' ';
  const out = [];
  const seen = new Set();
  for (const row of SKILLS) {
    const display = row[0], cat = row[1];
    const aliases = row.slice(2).length ? row.slice(2) : [norm(display)];
    let idx = -1;
    for (const a of aliases) { const i = firstIndex(hay, a); if (i >= 0) { idx = i; break; } }
    if (idx >= 0 && !seen.has(display)) { seen.add(display); out.push({ name: display, cat, idx }); }
  }
  out.sort((a, b) => a.idx - b.idx);
  return out;
}

function scoreRoles(text) {
  const hay = ' ' + norm(text) + ' ';
  const L = hay.length;
  const scored = [];
  for (const r of ROLES) {
    let titleScore = 0, kwScore = 0; const hits = [];
    for (const ti of (r.title || [])) {
      const idx = firstIndex(hay, ti);
      if (idx >= 0) { const sc = 100 * recencyWeight(idx, L); if (sc > titleScore) titleScore = sc; hits.push(ti); }
    }
    for (const k of (r.kw || [])) {
      const idx = firstIndex(hay, k);
      if (idx >= 0) { const base = GENERIC_KW.has(norm(k)) ? 4 : 9; kwScore += base * recencyWeight(idx, L); hits.push(k); }
    }
    kwScore = Math.min(kwScore, 45);
    const total = titleScore + kwScore;
    if (total > 0) scored.push({ t: r.t, c: r.c, score: total, hasTitle: titleScore > 0, hits: [...new Set(hits)] });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function analyze(text) {
  const skills = detectSkills(text);
  const scored = scoreRoles(text);

  // área dominante por suma de score
  const catScore = {};
  scored.forEach(r => { catScore[r.c] = (catScore[r.c] || 0) + r.score; });
  skills.forEach(sk => { catScore[sk.cat] = (catScore[sk.cat] || 0) + 6; });
  let area = null, best = 0;
  for (const c in catScore) if (catScore[c] > best) { best = catScore[c]; area = c; }

  // filtrar ruido: dejar roles con título explícito o score decente
  const filtered = scored.filter(r => r.hasTitle || r.score >= 28);
  const use = filtered.length ? filtered : scored;
  const maxScore = use.length ? use[0].score : 0;
  const roles = use.slice(0, 10).map(r => ({
    title: r.t, cat: r.c,
    confidence: Math.max(20, Math.min(99, Math.round((r.score / (maxScore || 1)) * 90) + 9))
  }));

  // chips: ocultar términos genéricos y priorizar los de cargos recientes
  const L2 = norm(text).length + 2;
  const cleaned = skills.filter(s => !BROAD_SKILL.has(s.name));
  const recent = cleaned.filter(s => (s.idx / (L2 || 1)) < 0.6);
  const displaySkills = (recent.length >= 6 ? recent : cleaned).slice(0, 12);

  return {
    skills: displaySkills.map(s => s.name),
    skillsDetailed: skills,
    roles,                          // [{title, cat, confidence}]
    titles: roles.map(r => r.title),
    area, areaLabel: area ? (CAT_LABEL[area] || area) : null
  };
}

function inferTitles(skills = [], cvText = '') {
  const text = (cvText && cvText.trim()) ? cvText : (skills || []).join(' ');
  const r = analyze(text);
  if (r.titles.length) return r.titles.slice(0, 6);
  return ['Profesional', 'Analista', 'Asistente'];
}

// ---------- API pública (misma firma que la versión con Gemini, pero LOCAL) ----------
export function fallbackTitleSuggestions(skills = [], cvText = '') {
  const r = analyze((cvText && cvText.trim()) ? cvText : (skills || []).join(' '));
  return r.titles.length ? r.titles.slice(0, 10) : ['Profesional', 'Analista', 'Asistente', 'Practicante'];
}

export async function suggestJobTitles({ skills = [], cvText = '', country = 'Chile', profile = {} } = {}) {
  // 100% local, sin llamadas de red
  const r = analyze((cvText && cvText.trim()) ? cvText : (skills || []).join(' '));
  const list = r.titles.length ? r.titles : fallbackTitleSuggestions(skills, cvText);
  return list.slice(0, 12);
}

export function filterSuggestions(query, suggestions, selected = []) {
  const q = (query || '').trim().toLowerCase();
  const selectedSet = new Set((selected || []).map((x) => x.toLowerCase()));
  let list = (suggestions || []).filter((s) => !selectedSet.has(s.toLowerCase()));
  if (q) {
    list = list.filter((s) => s.toLowerCase().includes(q));
    if (q.length >= 2 && !list.some((s) => s.toLowerCase() === q)) list.unshift(query.trim());
  }
  return list.slice(0, 8);
}

export { esc, analyze, detectSkills, inferTitles };

// exponer también en window para onboarding.js (script clásico)
if (typeof window !== 'undefined') {
  window.InstaWorkAnalyzer = { analyze, detectSkills, inferTitles, fallbackTitleSuggestions, CAT_LABEL };
}
