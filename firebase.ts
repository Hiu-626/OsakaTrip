import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  signInAnonymously, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc,
  deleteDoc, 
  onSnapshot, 
  getDocFromServer,
  query,
  orderBy,
  Firestore
} from "firebase/firestore";
import firebaseConfigJson from "./firebase-applet-config.json";
import { Trip, LoginAuditRecord } from "./types.ts";

// Fallback configuration supporting Vite environment or JSON config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
};

// Initialize App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Auth setup
const auth = getAuth(app);

// Firestore setup with named database support
const databaseId = firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== "(default)"
  ? firebaseConfigJson.firestoreDatabaseId
  : undefined;

const db: Firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

// Anonymous sign in fallback for zero-friction collaboration if not logged in
onAuthStateChanged(auth, (user) => {
  if (!user) {
    signInAnonymously(auth).catch((err) => {
      console.warn("Firebase anonymous auth fallback:", err.message);
    });
  }
});

// Google Authentication
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  if (result.user) {
    await recordUserLogin(result.user);
  }
  return result.user;
}

export async function signOutGoogle(): Promise<void> {
  await signOut(auth);
  try {
    await signInAnonymously(auth);
  } catch (e) {
    console.warn("Anonymous auth re-connect note:", e);
  }
}

export async function recordUserLogin(user: User): Promise<void> {
  try {
    const now = new Date().toISOString();
    // 1. Update user profile document
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0] || 'Google User',
      photoURL: user.photoURL || '',
      lastLoginAt: now
    }, { merge: true });

    // 2. Add an audit log entry
    const recordId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const logRef = doc(db, 'login_records', recordId);
    await setDoc(logRef, {
      id: recordId,
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '',
      timestamp: now,
      userAgent: navigator.userAgent
    });
  } catch (err) {
    console.warn("Could not write login record to Firestore:", err);
  }
}

export async function fetchLoginRecords(uid?: string): Promise<LoginAuditRecord[]> {
  try {
    const col = collection(db, 'login_records');
    const snapshot = await getDocs(col);
    const logs: LoginAuditRecord[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as LoginAuditRecord;
      if (!uid || data.uid === uid) {
        logs.push(data);
      }
    });
    return logs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 20);
  } catch (e) {
    console.warn("Could not fetch login records:", e);
    return [];
  }
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// Test connection on boot per Firebase guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase client is currently offline. Local cache will be used.");
    }
  }
}
testConnection();

// Cloud Storage Operations for Trips
export async function saveTripToFirebase(trip: Trip): Promise<boolean> {
  try {
    const tripRef = doc(db, 'trips', trip.id);
    const cleanedTrip = {
      ...trip,
      updatedAt: new Date().toISOString()
    };
    await setDoc(tripRef, cleanedTrip, { merge: true });
    return true;
  } catch (error) {
    console.error("Error saving trip to Firebase:", error);
    return false;
  }
}

export async function fetchTripsFromFirebase(): Promise<Trip[]> {
  try {
    const tripsCol = collection(db, 'trips');
    const q = query(tripsCol, orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    const trips: Trip[] = [];
    snapshot.forEach((docSnap) => {
      trips.push(docSnap.data() as Trip);
    });
    return trips;
  } catch (error) {
    // If orderBy index is building or fails, fallback to simple fetch
    try {
      const tripsCol = collection(db, 'trips');
      const snapshot = await getDocs(tripsCol);
      const trips: Trip[] = [];
      snapshot.forEach((docSnap) => {
        trips.push(docSnap.data() as Trip);
      });
      return trips.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    } catch (innerError) {
      console.error("Error fetching trips from Firebase:", innerError);
      return [];
    }
  }
}

export async function deleteTripFromFirebase(tripId: string): Promise<boolean> {
  try {
    const tripRef = doc(db, 'trips', tripId);
    await deleteDoc(tripRef);
    return true;
  } catch (error) {
    console.error("Error deleting trip from Firebase:", error);
    return false;
  }
}

export function subscribeToTrips(onUpdate: (trips: Trip[]) => void): () => void {
  try {
    const tripsCol = collection(db, 'trips');
    return onSnapshot(tripsCol, (snapshot) => {
      const trips: Trip[] = [];
      snapshot.forEach((docSnap) => {
        trips.push(docSnap.data() as Trip);
      });
      trips.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      onUpdate(trips);
    }, (error) => {
      console.warn("Real-time trips snapshot warning:", error);
    });
  } catch (e) {
    console.warn("Could not setup trips subscription:", e);
    return () => {};
  }
}

export { auth, db };
export default app;
