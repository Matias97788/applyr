const eyeOpen = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>';
const eyeClosed = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6A3 3 0 0012 15a3 3 0 002.4-4.4M9.9 4.2A10.8 10.8 0 0112 4c6.5 0 10 8 10 8a18.4 18.4 0 01-4.8 5.9M6.2 6.2C3.6 8.1 2 12 2 12s3.5 7 10 7c1.1 0 2.1-.2 3-.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

export function initPasswordFields(root = document) {
  root.querySelectorAll('.field-input--password').forEach((wrap) => {
    const input = wrap.querySelector('input');
    const btn = wrap.querySelector('.field-toggle');
    if (!input || !btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.innerHTML = eyeOpen;

    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = show ? eyeClosed : eyeOpen;
      btn.classList.toggle('is-visible', show);
      btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });
}

function strengthScore(value) {
  let score = 0;
  if (!value) return 0;
  if (value.length >= 6) score++;
  if (value.length >= 10) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  return Math.min(4, score);
}

const strengthLabels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];

export function initPasswordStrength(passwordId, meterId) {
  const input = document.getElementById(passwordId);
  const meter = document.getElementById(meterId);
  if (!input || !meter) return;

  const bar = meter.querySelector('.pwd-strength-bar');
  const label = meter.querySelector('.pwd-strength-label');

  input.addEventListener('input', () => {
    const score = strengthScore(input.value);
    meter.classList.toggle('hidden', !input.value);
    if (bar) {
      bar.dataset.level = String(score);
      bar.style.width = score ? `${(score / 4) * 100}%` : '0%';
    }
    if (label) label.textContent = strengthLabels[score] || '';
  });
}
