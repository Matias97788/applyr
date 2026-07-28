import { auth } from './firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  getAdditionalUserInfo
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import {
  enterApp,
  firebaseErrorMessage,
  hasCompletedOnboarding,
  LOGIN_URL,
  setLoading,
  userToProfile,
  waitForAuthUser
} from './auth.js';

let isSignUp = false;
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

function updateModeUI() {
  const btn = document.getElementById('gemailbtn');
  const toggle = document.getElementById('toggleMode');
  if (btn) btn.textContent = isSignUp ? 'Crear cuenta' : 'Iniciar sesión';
  if (toggle) {
    toggle.textContent = isSignUp
      ? '¿Ya tienes cuenta? Iniciar sesión'
      : '¿No tienes cuenta? Crear cuenta';
  }
}

function goAfterLogin(user, options = {}) {
  if (redirecting) return;
  redirecting = true;
  const needsOnboarding = options.forceOnboarding || !hasCompletedOnboarding(user.uid);
  enterApp(userToProfile(user), { forceOnboarding: needsOnboarding });
}

async function handleGoogleAuth() {
  clearError();
  const btn = document.getElementById('ggeneric');
  setLoading(btn, true, 'Conectando con Google…');

  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const info = getAdditionalUserInfo(cred);
    goAfterLogin(cred.user, { forceOnboarding: info?.isNewUser === true });
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
    showError(firebaseErrorMessage(err.code));
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

  setLoading(btn, true, isSignUp ? 'Crear cuenta' : 'Iniciar sesión');

  try {
    const cred = isSignUp
      ? await createUserWithEmailAndPassword(auth, email, password)
      : await signInWithEmailAndPassword(auth, email, password);
    goAfterLogin(cred.user, { forceOnboarding: isSignUp });
  } catch (err) {
    showError(firebaseErrorMessage(err.code));
    setLoading(btn, false, isSignUp ? 'Crear cuenta' : 'Iniciar sesión');
  }
}

function bindLoginForm() {
  document.getElementById('emailForm').addEventListener('submit', handleEmailAuth);
  document.getElementById('ggeneric').addEventListener('click', handleGoogleAuth);
  document.getElementById('toggleMode').addEventListener('click', () => {
    isSignUp = !isSignUp;
    clearError();
    updateModeUI();
  });
  updateModeUI();
  showLoginForm();
}

async function initLogin() {
  let forceOnboarding = false;
  let userFromRedirect = null;

  // IMPORTANT: process Google redirect BEFORE any URL change
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      userFromRedirect = result.user;
      const info = getAdditionalUserInfo(result);
      forceOnboarding = info?.isNewUser === true;
    }
  } catch (err) {
    const btn = document.getElementById('ggeneric');
    setLoading(btn, false, 'Continuar con Google');
    showError(
      err.code === 'auth/operation-not-allowed'
        ? 'Google no está activado en Firebase. Ve a Authentication → Sign-in method → Google → Enable.'
        : firebaseErrorMessage(err.code)
    );
    bindLoginForm();
    return;
  }

  const user = userFromRedirect || await waitForAuthUser(3000);

  if (user) {
    goAfterLogin(user, { forceOnboarding });
    return;
  }

  // Normalize URL only after OAuth is processed
  if (window.location.pathname.endsWith('/index.html')) {
    window.location.replace(LOGIN_URL);
    return;
  }

  bindLoginForm();
}

initLogin();
