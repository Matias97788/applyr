import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

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

export function onboardingDoneKey(uid) {
  return uid ? `instawork_done_${uid}` : 'instawork_done';
}

export function hasCompletedOnboarding(uid) {
  return localStorage.getItem(onboardingDoneKey(uid)) === '1';
}

export function enterApp(profile, options = {}) {
  try { InstaWorkEngine.setProfile(profile); } catch (e) {}
  try { localStorage.setItem('instawork_logged_in', '1'); } catch (e) {}
  try {
    sessionStorage.setItem('instawork_just_logged_in', '1');
    if (profile.uid) sessionStorage.setItem('instawork_uid', profile.uid);
  } catch (e) {}

  const done = hasCompletedOnboarding(profile.uid);

  if (options.forceOnboarding || !done) {
    window.location.replace('onboarding.html');
  } else {
    window.location.replace('dashboard.html');
  }
}

export function markOnboardingComplete(uid) {
  try { localStorage.setItem(onboardingDoneKey(uid), '1'); } catch (e) {}
}

export function firebaseErrorMessage(code) {
  const messages = {
    'auth/invalid-email': 'Email inválido.',
    'auth/user-disabled': 'Esta cuenta fue deshabilitada.',
    'auth/user-not-found': 'No existe una cuenta con este email.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/email-already-in-use': 'Este email ya está registrado.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-credential': 'Email o contraseña incorrectos.',
    'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
    'auth/network-request-failed': 'Error de red. Revisa tu conexión.',
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google. Intenta de nuevo.',
    'auth/cancelled-popup-request': 'Ya hay una ventana de Google abierta.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana. Permite popups para este sitio.'
  };
  return messages[code] || 'No se pudo iniciar sesión. Intenta de nuevo.';
}

export function setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Cargando…' : label;
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
