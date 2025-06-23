import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLedger, setCurrentLedger] = useState(null);

  function signup(email, password, displayName) {
    return createUserWithEmailAndPassword(auth, email, password)
      .then(async (result) => {
        // Update the user's display name
        await updateProfile(result.user, { displayName });
        
        // Create user document in Firestore
        await setDoc(doc(db, 'users', result.user.uid), {
          email: result.user.email,
          displayName: displayName,
          createdAt: new Date(),
          preferences: {
            currency: 'USD',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        });

        // Create a default ledger for the new user
        const defaultLedger = await addDoc(collection(db, 'ledgers'), {
          name: 'Personal Expenses',
          ownerId: result.user.uid,
          createdAt: new Date(),
          members: {
            [result.user.uid]: 'owner'
          },
          currency: 'USD'
        });

        // Set the default ledger as current
        setCurrentLedger(defaultLedger.id);

        return result;
      });
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    setCurrentLedger(null);
    return signOut(auth);
  }

  function switchLedger(ledgerId) {
    setCurrentLedger(ledgerId);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // If no current ledger is set, try to find the user's first ledger
        if (!currentLedger) {
          // This would typically involve querying the ledgers collection
          // For now, we'll leave it null and handle it in the UI
        }
      } else {
        setCurrentUser(null);
        setCurrentLedger(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [currentLedger]);

  const value = {
    currentUser,
    currentLedger,
    signup,
    login,
    logout,
    switchLedger
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

