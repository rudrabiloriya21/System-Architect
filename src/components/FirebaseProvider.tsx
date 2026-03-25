import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  onAuthStateChanged, 
  User, 
  signInWithPopup, 
  googleProvider, 
  signOut,
  db,
  doc,
  setDoc,
  getDoc
} from '../lib/firebase';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  isLoggingIn: boolean;
  authError: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Ensure user profile exists in Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userDoc = await getDoc(userRef);
          
          if (!userDoc.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              displayName: currentUser.displayName || null,
              email: currentUser.email || null,
              photoURL: currentUser.photoURL || null,
              createdAt: Date.now(),
              role: 'user'
            });
          }
        } catch (error) {
          console.error('Error checking/creating user profile:', error);
        }
      }
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError(null);
    
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/popup-blocked') {
        setAuthError('The login popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if (error.code === 'auth/unauthorized-domain') {
        setAuthError('This domain is not authorized for Firebase Auth. Please add it in the Firebase Console.');
      } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // User cancelled, no need to show error
      } else {
        setAuthError(error.message || 'An error occurred during login.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <FirebaseContext.Provider value={{ user, loading, isLoggingIn, authError, login, logout }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}
