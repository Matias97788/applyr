import { auth } from './firebase.js';
import { signOutUser, userToProfile } from './auth.js';

function getProfile() {
  if (auth.currentUser) return userToProfile(auth.currentUser);
  try { return InstaWorkEngine.getProfile() || {}; } catch (e) { return {}; }
}

function initial(name, email) {
  const src = (name || email || 'U').trim();
  return src.charAt(0).toUpperCase();
}

function providerLabel(provider) {
  if (provider === 'google.com') return 'Google';
  if (provider === 'password') return 'Email y contraseña';
  return 'Cuenta';
}

function paintUserUI() {
  const profile = getProfile();
  const name = profile.fullname || profile.email?.split('@')[0] || 'Mi cuenta';
  const email = profile.email || '—';
  const letter = initial(name, email);
  const provider = providerLabel(profile.provider);

  document.querySelectorAll('#userAvatar, #userAvatarTop, #userAvatarLarge, #userAvatarMenu').forEach((el) => {
    if (!el) return;
    if (profile.picture) {
      el.style.backgroundImage = `url(${profile.picture})`;
      el.style.backgroundSize = 'cover';
      el.textContent = '';
    } else {
      el.style.backgroundImage = '';
      el.textContent = letter;
    }
  });

  const nameEls = document.querySelectorAll('#userName, #accountName, [data-user-name]');
  nameEls.forEach((el) => { if (el) el.textContent = name; });

  const emailEls = document.querySelectorAll('#userEmail, #accountEmail, [data-user-email]');
  emailEls.forEach((el) => { if (el) el.textContent = email; });

  const providerEls = document.querySelectorAll('#userProviderBadge, #accountProvider');
  providerEls.forEach((el) => { if (el) el.textContent = provider; });
}

function toggleDropdown(force) {
  const dropdown = document.getElementById('userDropdown');
  const btn = document.getElementById('userMenuBtn');
  if (!dropdown) return;
  const open = typeof force === 'boolean' ? force : dropdown.classList.contains('hidden');
  dropdown.classList.toggle('hidden', !open);
  btn?.classList.toggle('is-open', open);
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function bindUserMenu() {
  paintUserUI();

  const menuBtn = document.getElementById('userMenuBtn');
  const chipBtn = document.getElementById('userChipBtn');
  const dropdown = document.getElementById('userDropdown');

  menuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  chipBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    menuBtn?.click();
  });

  document.addEventListener('click', () => toggleDropdown(false));

  dropdown?.addEventListener('click', (e) => e.stopPropagation());

  dropdown?.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleDropdown(false);
      if (window.iwShowView) window.iwShowView(btn.dataset.view);
    });
  });

  document.querySelectorAll('#logoutBtn, #logoutBtnMain, #settingsLogout').forEach((btn) => {
    btn?.addEventListener('click', () => signOutUser());
  });

  document.querySelectorAll('[data-view-jump]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (window.iwShowView) window.iwShowView(btn.dataset.viewJump);
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindUserMenu);
} else {
  bindUserMenu();
}

export { paintUserUI };
window.iwPaintUser = paintUserUI;
