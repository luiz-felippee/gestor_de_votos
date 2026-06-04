import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Suas chaves do Firebase virão do .env depois
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "COLE_SUA_API_KEY_AQUI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "seu-app.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "seu-projeto-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "seu-app.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:00000:web:abcde",
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta os serviços para usar no resto do app
export const auth = getAuth(app);
export const db = getFirestore(app);
