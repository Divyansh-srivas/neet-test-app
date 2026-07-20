import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA9hANdhZ4tEz5KI-LZdGiv1CcnmLEyMGM",
  authDomain: "neogravix-2afa2.firebaseapp.com",
  projectId: "neogravix-2afa2",
  storageBucket: "neogravix-2afa2.firebasestorage.app",
  messagingSenderId: "407171708234",
  appId: "1:407171708234:web:f4fbd069f80c1f38c53db3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
