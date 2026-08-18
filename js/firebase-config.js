// Remplis ces valeurs avec celles de TON projet Firebase (gratuit) :
// https://console.firebase.google.com -> Ajouter un projet -> Paramètres du projet -> "Vos applications" -> Web (</>)
// Voir README.md pour les étapes complètes (Firestore + règles de sécurité).
const firebaseConfig = {
  apiKey: 'AIzaSyD9OQAit4KuanBIaaYGw6U7_AcSlvgngHQ',
  authDomain: 'skull-king-6b980.firebaseapp.com',
  projectId: 'skull-king-6b980',
  storageBucket: 'skull-king-6b980.firebasestorage.app',
  messagingSenderId: '543046363623',
  appId: '1:543046363623:web:16b66187d43e94c58cb542',
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
