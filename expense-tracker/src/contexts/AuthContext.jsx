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
            currency: 'CNY',
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
          currency: 'CNY'
        });

        return result;
      });
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    signup,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

