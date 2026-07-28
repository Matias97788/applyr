import { auth } from './firebase.js';
import { hasCompletedOnboarding, LOGIN_URL, userToProfile, waitForAuthUser } from './auth.js';

async function guard() {
  const justLoggedIn = sessionStorage.getItem('instawork_just_logged_in') === '1';
  const user = await waitForAuthUser(justLoggedIn ? 10000 : 3000);

  sessionStorage.removeItem('instawork_just_logged_in');

  if (!user) {
    window.location.replace(LOGIN_URL);
    return;
  }

  document.body.classList.remove('auth-pending');

  try { localStorage.setItem('instawork_logged_in', '1'); } catch (e) {}
  try { InstaWorkEngine.setProfile(userToProfile(user)); } catch (e) {}

  const isOnboarding = window.location.pathname.endsWith('onboarding.html');
  const isDashboard = window.location.pathname.endsWith('dashboard.html');
  const done = hasCompletedOnboarding(user.uid);

  if (isOnboarding && done) {
    window.location.replace('dashboard.html');
    return;
  }
  if (isDashboard && !done) {
    window.location.replace('onboarding.html');
  }
}

guard();
