import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC0xvzC9N_a6IRkBKpaeZt_hnhcKuoh3f0",
  authDomain: "olympia-90b09.firebaseapp.com",
  projectId: "olympia-90b09",
  storageBucket: "olympia-90b09.appspot.com",
  messagingSenderId: "774372639164",
  appId: "1:774372639164:web:8a3ad02a946b7ac0256bb9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);