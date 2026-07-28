import { app } from './firebase.js';

function esc(s) {
  return (s || '').toString().replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function parseTitleList(text) {
  if (!text) return [];
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]);
    return arr.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()).slice(0, 12);
  } catch (e) {
    return [];
  }
}

function uniqueTitles(list) {
  const seen = new Set();
  return list.filter((t) => {
    const key = t.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function fallbackTitleSuggestions(skills = [], cvText = '') {
  const s = (skills || []).map((x) => x.toLowerCase());
  const text = (cvText || '').toLowerCase();
  const has = (...k) => k.some((x) => s.includes(x) || text.includes(x));
  const out = [];

  if (has('wordpress')) out.push('WordPress Developer', 'Desarrollador Web', 'Custom Web Solutions Developer');
  if (has('shopify', 'woocommerce')) out.push('Shopify Developer', 'E-commerce Store Developer', 'Full Stack E-commerce Developer');
  if (has('react', 'vue', 'angular', 'javascript', 'typescript')) out.push('Frontend Developer', 'React Developer');
  if (has('node', 'node.js', 'python', 'django', 'flask', 'java', 'php', 'laravel', 'go', 'golang', '.net', 'c#')) {
    out.push('Backend Developer', 'Software Engineer');
  }
  if (has('react', 'node', 'javascript') && has('python', 'java', 'php', 'node')) out.push('Full Stack Developer');
  if (has('figma', 'ux', 'ui')) out.push('Diseñador UX/UI', 'Product Designer');
  if (has('seo', 'sem', 'google ads', 'meta ads', 'marketing', 'google analytics')) {
    out.push('Marketing Digital', 'Growth Marketing Specialist', 'Digital Transformation Consultant');
  }
  if (has('excel', 'power bi', 'tableau', 'sql')) out.push('Analista de Datos', 'Business Intelligence Analyst');
  if (has('scrum', 'agile', 'jira', 'notion')) out.push('Project Manager', 'Technical Project Manager');
  if (has('salesforce', 'hubspot', 'ventas')) out.push('Ejecutivo Comercial', 'Account Executive');
  if (has('docker', 'kubernetes', 'aws', 'azure', 'gcp')) out.push('DevOps Engineer', 'Cloud Engineer');

  if (!out.length) out.push('Developer', 'Ingeniero de Software', 'Full Stack Developer');
  return uniqueTitles(out).slice(0, 10);
}

export async function suggestJobTitles({ skills = [], cvText = '', country = 'Chile', profile = {} } = {}) {
  const fallback = fallbackTitleSuggestions(skills, cvText);

  try {
    const { getAI, getGenerativeModel, GoogleAIBackend } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-ai.js');
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    const model = getGenerativeModel(ai, { model: 'gemini-2.0-flash' });

    const prompt = `Eres un asesor de carrera para LATAM. Sugiere entre 8 y 10 títulos de puesto laborales realistas para buscar empleo.

Contexto del candidato:
- País de búsqueda: ${country}
- Habilidades detectadas: ${(skills || []).join(', ') || 'no especificadas'}
- Nombre: ${profile.fullname || 'no especificado'}
- Extracto CV: ${(cvText || '').slice(0, 1200) || 'no disponible'}

Reglas:
- Mezcla español e inglés como se usa en bolsas de empleo (GetOnBoard, LinkedIn).
- Incluye roles específicos (ej: WordPress Developer, Shopify Developer) si aplican.
- Devuelve SOLO un JSON array de strings, sin markdown ni explicación.
Ejemplo: ["WordPress Developer","Shopify Developer"]`;

    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.() || '';
    const parsed = parseTitleList(text);
    if (parsed.length) return uniqueTitles([...parsed, ...fallback]).slice(0, 12);
  } catch (e) {
    // Firebase AI no disponible → fallback local
  }

  return fallback;
}

export function filterSuggestions(query, suggestions, selected = []) {
  const q = (query || '').trim().toLowerCase();
  const selectedSet = new Set((selected || []).map((x) => x.toLowerCase()));
  let list = (suggestions || []).filter((s) => !selectedSet.has(s.toLowerCase()));

  if (q) {
    list = list.filter((s) => s.toLowerCase().includes(q));
    if (q.length >= 2 && !list.some((s) => s.toLowerCase() === q)) {
      list.unshift(query.trim());
    }
  }

  return list.slice(0, 8);
}

export { esc };
