import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
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
import { Trip } from "./types.ts";

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

// Anonymous sign in for zero-friction collaboration
let currentFirebaseUser: User | null = null;
onAuthStateChanged(auth, (user) => {
  currentFirebaseUser = user;
});

signInAnonymously(auth).catch((err) => {
  console.warn("Firebase anonymous auth fallback:", err.message);
});

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
