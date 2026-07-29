import { auth } from './firebase.js';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  fetchSignInMethodsForEmail
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import {
  enterApp,
  firebaseErrorMessage,
  LOGIN_URL,
  setLoading,
  userToProfile,
  waitForAuthUser
} from './auth.js';
import { initPasswordFields } from './auth-fields.js';

let redirecting = false;

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function showError(msg) {
  const el = document.getElementById('loginError');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearError() {
  const el = document.getElementById('loginError');
  if (!el) return;
  el.textContent = '';
  el.classList.add('hidden');
}

function showLoginForm() {
  const wrap = document.getElementById('loginContent');
  if (wrap) wrap.classList.remove('hidden');
  const loading = document.getElementById('authLoading');
  if (loading) loading.classList.add('hidden');
}

function goAfterLogin(user) {
  if (redirecting) return;
  redirecting = true;
  enterApp(userToProfile(user));
}

async function handleGoogleAuth() {
  clearError();
  const btn = document.getElementById('ggeneric');
  setLoading(btn, true, 'Conectando con Google…');

  try {
    const cred = await signInWithPopup(auth, googleProvider);
    goAfterLogin(cred.user);
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') {
      setLoading(btn, false, 'Continuar con Google');
      return;
    }
    if (err.code === 'auth/popup-blocked') {
      setLoading(btn, true, 'Redirigiendo a Google…');
      signInWithRedirect(auth, googleProvider);
      return;
    }
    showError(firebaseErrorMessage(err));
    setLoading(btn, false, 'Continuar con Google');
  }
}

async function handleEmailAuth(e) {
  e.preventDefault();
  clearError();

  const email = document.getElementById('gemail').value.trim();
  const password = document.getElementById('gpassword').value;
  const btn = document.getElementById('gemailbtn');

  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    showError('Email inválido.');
    return;
  }
  if (password.length < 6) {
    showError('La contraseña debe tener al menos 6 caracteres.');
    return;
  }

  setLoading(btn, true, 'Iniciar sesión');

  try {
    let methods = [];
    try {
      methods = await fetchSignInMethodsForEmail(auth, email);
    } catch (e) {}

    if (methods.length && !methods.includes('password')) {
      const usesGoogle = methods.includes('google.com');
      showError(
        usesGoogle
          ? 'Este email está registrado con Google. Usa «Continuar con Google».'
          : 'Este email usa otro método de acceso. Prueba con Google o recupera tu cuenta.'
      );
      setLoading(btn, false, 'Iniciar sesión');
      return;
    }

    const cred = await signInWithEmailAndPassword(auth, email, password);
    goAfterLogin(cred.user);
  } catch (err) {
    console.error('Login error:', err?.code, err?.message);
    showError(firebaseErrorMessage(err));
    setLoading(btn, false, 'Iniciar sesión');
  }
}

function bindLoginForm() {
  document.getElementById('emailForm').addEventListener('submit', handleEmailAuth);
  document.getElementById('ggeneric').addEventListener('click', handleGoogleAuth);
  initPasswordFields();
  showLoginForm();
}

async function initLogin() {
  let userFromRedirect = null;
  const justLoggedOut = new URLSearchParams(window.location.search).get('logout') === '1';

  // IMPORTANT: process Google redirect BEFORE any URL change
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) userFromRedirect = result.user;
  } catch (err) {
    const btn = document.getElementById('ggeneric');
    setLoading(btn, false, 'Continuar con Google');
    showError(
      err.code === 'auth/operation-not-allowed'
        ? 'Google no está activado en Firebase. Ve a Authentication → Sign-in method → Google → Enable.'
        : firebaseErrorMessage(err)
    );
    bindLoginForm();
    return;
  }

  if (!justLoggedOut) {
    const user = userFromRedirect || await waitForAuthUser(1500);
    if (user) {
      goAfterLogin(user);
      return;
    }
  }

  // Normalize URL only after OAuth is processed
  if (window.location.pathname.endsWith('/index.html') || window.location.search) {
    window.history.replaceState({}, '', LOGIN_URL);
  }

  bindLoginForm();
}

initLogin();
