import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-analytics.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAVJQLTePZCJDzTZ4tbLPqrVkyk9e1labk',
  authDomain: 'applyr-69021.firebaseapp.com',
  projectId: 'applyr-69021',
  storageBucket: 'applyr-69021.firebasestorage.app',
  messagingSenderId: '614990279103',
  appId: '1:614990279103:web:318407afd7c7ec6976710a',
  measurementId: 'G-JSYFY0HB9P'
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (e) {}

export { analytics };
