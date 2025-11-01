import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAb4CnIXw6KrDLe7Q9T8ClxfVO94xBfsc4",
  authDomain: "cmd5-9ae89.firebaseapp.com",
  projectId: "cmd5-9ae89",
  storageBucket: "cmd5-9ae89.firebasestorage.app",
  messagingSenderId: "1095630327852",
  appId: "1:1095630327852:web:4c31c565a15250fd39c189"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
