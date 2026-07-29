import { auth } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import {
  enterApp,
  firebaseErrorMessage,
  LOGIN_URL,
  setLoading,
  userToProfile,
  waitForAuthUser
} from './auth.js';
import { initPasswordFields, initPasswordStrength } from './auth-fields.js';

let redirecting = false;

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function showError(msg) {
  const el = document.getElementById('registerError');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearError() {
  const el = document.getElementById('registerError');
  if (!el) return;
  el.textContent = '';
  el.classList.add('hidden');
}

function showRegisterForm() {
  document.getElementById('registerContent')?.classList.remove('hidden');
  document.getElementById('authLoading')?.classList.add('hidden');
}

function goAfterRegister(user) {
  if (redirecting) return;
  redirecting = true;
  enterApp(userToProfile(user));
}

async function handleGoogleRegister() {
  clearError();
  const btn = document.getElementById('googleRegister');
  setLoading(btn, true, 'Conectando con Google…');

  try {
    const cred = await signInWithPopup(auth, googleProvider);
    goAfterRegister(cred.user);
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') {
      setLoading(btn, false, 'Registrarse con Google');
      return;
    }
    if (err.code === 'auth/popup-blocked') {
      setLoading(btn, true, 'Redirigiendo a Google…');
      signInWithRedirect(auth, googleProvider);
      return;
    }
    showError(firebaseErrorMessage(err));
    setLoading(btn, false, 'Registrarse con Google');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  clearError();

  const fullname = document.getElementById('fullname').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const password2 = document.getElementById('password2').value;
  const btn = document.getElementById('registerBtn');

  if (!fullname) {
    showError('Ingresa tu nombre completo.');
    return;
  }
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    showError('Email inválido.');
    return;
  }
  if (password.length < 6) {
    showError('La contraseña debe tener al menos 6 caracteres.');
    return;
  }
  if (password !== password2) {
    showError('Las contraseñas no coinciden.');
    return;
  }

  setLoading(btn, true, 'Creando cuenta…');

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: fullname });
    goAfterRegister(cred.user);
  } catch (err) {
    showError(firebaseErrorMessage(err));
    setLoading(btn, false, 'Crear cuenta');
  }
}

function bindRegisterForm() {
  document.getElementById('registerForm').addEventListener('submit', handleRegister);
  document.getElementById('googleRegister').addEventListener('click', handleGoogleRegister);
  initPasswordFields();
  initPasswordStrength('password', 'pwdStrength');
  showRegisterForm();
}

async function initRegister() {
  let userFromRedirect = null;

  try {
    const result = await getRedirectResult(auth);
    if (result?.user) userFromRedirect = result.user;
  } catch (err) {
    const btn = document.getElementById('googleRegister');
    setLoading(btn, false, 'Registrarse con Google');
    showError(
      err.code === 'auth/operation-not-allowed'
        ? 'Google no está activado en Firebase. Ve a Authentication → Sign-in method → Google → Enable.'
        : firebaseErrorMessage(err)
    );
    bindRegisterForm();
    return;
  }

  const user = userFromRedirect || await waitForAuthUser(3000);

  if (user) {
    goAfterRegister(user);
    return;
  }

  if (window.location.pathname.endsWith('/registro.html')) {
    bindRegisterForm();
    return;
  }

  window.location.replace(LOGIN_URL.replace(/\/$/, '') + '/registro.html');
}

initRegister();
