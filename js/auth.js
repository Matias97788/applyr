import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

export function userToProfile(user) {
  return {
    fullname: user.displayName || '',
    email: user.email || '',
    picture: user.photoURL || '',
    uid: user.uid,
    provider: user.providerData[0]?.providerId || 'firebase'
  };
}

export const LOGIN_URL = '/';
export const REGISTER_URL = '/registro.html';

export function onboardingDoneKey(uid) {
  return uid ? `instawork_done_${uid}` : 'instawork_done';
}

export function resolveAuthUid(uid) {
  return uid || sessionStorage.getItem('instawork_uid') || null;
}

export function hasCompletedOnboarding(uid) {
  const id = resolveAuthUid(uid);
  if (id && localStorage.getItem(onboardingDoneKey(id)) === '1') return true;

  // Compatibilidad con flag global antiguo
  if (localStorage.getItem('instawork_done') === '1') {
    if (id) markOnboardingComplete(id);
    return true;
  }

  // Si el asistente se completó (último paso o botón al dashboard)
  try {
    const w = JSON.parse(localStorage.getItem('instawork_wizard'));
    if (w && (w.completed === true || w.step >= 15)) {
      if (id) markOnboardingComplete(id);
      return true;
    }
  } catch (e) {}

  return false;
}

export function enterApp(profile, options = {}) {
  try { InstaWorkEngine.setProfile(profile); } catch (e) {}
  try { localStorage.setItem('instawork_logged_in', '1'); } catch (e) {}
  try {
    sessionStorage.setItem('instawork_just_logged_in', '1');
    if (profile.uid) sessionStorage.setItem('instawork_uid', profile.uid);
  } catch (e) {}

  const done = hasCompletedOnboarding(profile.uid);

  if (done) {
    window.location.replace('dashboard.html');
    return;
  }

  window.location.replace('onboarding.html');
}

export function markOnboardingComplete(uid) {
  const id = resolveAuthUid(uid);
  try {
    if (id) localStorage.setItem(onboardingDoneKey(id), '1');
    localStorage.setItem('instawork_done', '1');
  } catch (e) {}
}

export function firebaseErrorMessage(codeOrErr) {
  const code = typeof codeOrErr === 'string' ? codeOrErr : codeOrErr?.code;
  const messages = {
    'auth/invalid-email': 'Email inválido.',
    'auth/user-disabled': 'Esta cuenta fue deshabilitada.',
    'auth/user-not-found': 'No existe una cuenta con este email.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/email-already-in-use': 'Este email ya está registrado.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-credential': 'Email o contraseña incorrectos.',
    'auth/invalid-login-credentials': 'Email o contraseña incorrectos.',
    'auth/account-exists-with-different-credential': 'Este email ya está registrado con Google. Usa «Continuar con Google».',
    'auth/operation-not-allowed': 'El inicio de sesión con email no está activado en Firebase.',
    'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
    'auth/network-request-failed': 'Error de red. Revisa tu conexión.',
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google. Intenta de nuevo.',
    'auth/cancelled-popup-request': 'Ya hay una ventana de Google abierta.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana. Permite popups para este sitio.',
    'auth/missing-password': 'Ingresa tu contraseña.',
    'auth/missing-email': 'Ingresa tu email.'
  };
  if (messages[code]) return messages[code];
  if (code) return `Error de autenticación (${code.replace('auth/', '')}).`;
  return 'No se pudo iniciar sesión. Intenta de nuevo.';
}

export function setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Cargando…' : label;
}

export async function signOutUser() {
  try { await signOut(auth); } catch (e) {}
  try {
    localStorage.removeItem('instawork_logged_in');
    sessionStorage.removeItem('instawork_just_logged_in');
    sessionStorage.removeItem('instawork_uid');
  } catch (e) {}
  // Esperar a que Firebase limpie la sesión antes de ir al login
  await auth.authStateReady();
  window.location.replace(LOGIN_URL + (LOGIN_URL.includes('?') ? '&' : '?') + 'logout=1');
}

export async function waitForAuthUser(maxMs = 5000) {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      unsub();
      resolve(auth.currentUser);
    }, maxMs);

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        clearTimeout(timeout);
        unsub();
        resolve(user);
      }
    });
  });
}
