import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
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
  const fetchLedgers = useCallback(async () => {
    if (!currentUser) {
      setLedgers([]);
      setCurrentLedger(null);
      setLoading(false);
      return;
    }

    try {
      const ledgersRef = collection(db, 'ledgers');
      // Get all ledgers and filter client-side for better compatibility
      const querySnapshot = await getDocs(ledgersRef);
      
      const userLedgers = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Check if user is actually a member
        if (data.members && data.members[currentUser.uid]) {
          userLedgers.push({
            id: doc.id,
            ...data
          });
        }
      });

      setLedgers(userLedgers);
      
      // Always set the first ledger as current for new users or if no current ledger
      if (userLedgers.length > 0) {
        setCurrentLedger(userLedgers[0]);
      } else {
        setCurrentLedger(null);
      }
    } catch (error) {
      console.error('Error fetching ledgers:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Refresh ledgers (useful after signup)
  const refreshLedgers = useCallback(async () => {
    setLoading(true);
    await fetchLedgers();
  }, [fetchLedgers]);

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
  }, [fetchLedgers]);

  // Add a second useEffect to handle potential delays in ledger creation
  useEffect(() => {
    if (currentUser && ledgers.length === 0 && !loading) {
      // If user is logged in but no ledgers found, retry after a short delay
      const timer = setTimeout(() => {
        refreshLedgers();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentUser, ledgers.length, loading, refreshLedgers]);

  const value = {
    ledgers,
    currentLedger,
    loading,
    switchLedger,
    fetchLedgers,
    refreshLedgers,
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
