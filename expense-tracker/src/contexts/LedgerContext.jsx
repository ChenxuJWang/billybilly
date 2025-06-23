import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const LedgerContext = createContext();

export function useLedger() {
  return useContext(LedgerContext);
}

export function LedgerProvider({ children }) {
  const { currentUser } = useAuth();
  const [ledgers, setLedgers] = useState([]);
  const [currentLedger, setCurrentLedger] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch user's ledgers
  const fetchLedgers = async () => {
    if (!currentUser) {
      setLedgers([]);
      setCurrentLedger(null);
      setLoading(false);
      return;
    }

    try {
      const ledgersRef = collection(db, 'ledgers');
      const q = query(ledgersRef, where(`members.${currentUser.uid}`, 'in', ['owner', 'member']));
      const querySnapshot = await getDocs(q);
      
      const userLedgers = [];
      querySnapshot.forEach((doc) => {
        userLedgers.push({
          id: doc.id,
          ...doc.data()
        });
      });

      setLedgers(userLedgers);
      
      // Set the first ledger as current if none is selected
      if (userLedgers.length > 0 && !currentLedger) {
        setCurrentLedger(userLedgers[0]);
      }
    } catch (error) {
      console.error('Error fetching ledgers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Switch to a different ledger
  const switchLedger = async (ledgerId) => {
    try {
      const ledgerDoc = await getDoc(doc(db, 'ledgers', ledgerId));
      if (ledgerDoc.exists()) {
        const ledgerData = { id: ledgerDoc.id, ...ledgerDoc.data() };
        setCurrentLedger(ledgerData);
      }
    } catch (error) {
      console.error('Error switching ledger:', error);
    }
  };

  // Get user's role in current ledger
  const getUserRole = () => {
    if (!currentLedger || !currentUser) return null;
    return currentLedger.members[currentUser.uid] || null;
  };

  // Check if user is owner of current ledger
  const isOwner = () => {
    return getUserRole() === 'owner';
  };

  // Check if user can edit (owner or member)
  const canEdit = () => {
    const role = getUserRole();
    return role === 'owner' || role === 'member';
  };

  useEffect(() => {
    fetchLedgers();
  }, [currentUser]);

  const value = {
    ledgers,
    currentLedger,
    loading,
    switchLedger,
    fetchLedgers,
    getUserRole,
    isOwner,
    canEdit
  };

  return (
    <LedgerContext.Provider value={value}>
      {children}
    </LedgerContext.Provider>
  );
}

