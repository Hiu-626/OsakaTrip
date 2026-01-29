// @ts-ignore
// Fix: Added @ts-ignore to suppress the error regarding initializeApp not being exported from firebase/app
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 使用 Vite 的環境變數 (這樣最安全，不會有引號錯誤)
// Fix: Use process.env as defined in vite.config.ts to resolve TypeScript errors where import.meta.env is not recognized
const firebaseConfig = {
  apiKey: (process.env as any).VITE_FIREBASE_API_KEY,
  authDomain: (process.env as any).VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (process.env as any).VITE_FIREBASE_PROJECT_ID,
  storageBucket: (process.env as any).VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (process.env as any).VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (process.env as any).VITE_FIREBASE_APP_ID
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 導出你需要的功能
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;