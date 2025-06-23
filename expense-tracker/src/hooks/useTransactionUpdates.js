import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

export function useTransactionUpdates(ledgerId) {
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    if (!ledgerId) return;

    const transactionsRef = collection(db, 'ledgers', ledgerId, 'transactions');
    const q = query(transactionsRef, orderBy('createdAt', 'desc'), limit(1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setLastUpdate(Date.now());
      }
    });

    return () => unsubscribe();
  }, [ledgerId]);

  return lastUpdate;
}

