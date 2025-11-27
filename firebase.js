// firebase.js
// Coloque aqui as suas credenciais reais do Firebase
// (Console Firebase > Configurações do Projeto > Suas apps > Configuração Web)

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID",
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);

// Serviços principais
const auth = firebase.auth();
const db = firebase.firestore();
const messaging = firebase.messaging();

// Torna disponíveis globalmente
window.firebaseApp = firebase;
window.auth = auth;
window.db = db;
window.messaging = messaging;
