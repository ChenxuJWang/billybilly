import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/firebase';

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value?.toDate === 'function') {
    const converted = value.toDate();
    return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function useLedgerOverviewData(currentLedger, currentUser) {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentLedger) {
      setTransactions([]);
      setCategories([]);
      setBudgets([]);
      setMembers([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    let isActive = true;
    let membersLoaded = false;
    let categoriesLoaded = false;
    let budgetsLoaded = false;
    let transactionsLoaded = false;

    setLoading(true);
    setError('');

    function markLoaded(resource) {
      if (resource === 'members') {
        membersLoaded = true;
      }

      if (resource === 'categories') {
        categoriesLoaded = true;
      }

      if (resource === 'budgets') {
        budgetsLoaded = true;
      }

      if (resource === 'transactions') {
        transactionsLoaded = true;
      }

      if (isActive && membersLoaded && categoriesLoaded && budgetsLoaded && transactionsLoaded) {
        setLoading(false);
      }
    }

    async function fetchMembers() {
      const memberRoles = currentLedger.members || {};
      const memberIds = Object.keys(memberRoles);

      if (memberIds.length === 0) {
        if (isActive) {
          setMembers([]);
        }
        markLoaded('members');
        return;
      }

      try {
        const userDataMap = new Map();
        const batchSize = 10;

        for (let index = 0; index < memberIds.length; index += batchSize) {
          const batchUserIds = memberIds.slice(index, index + batchSize);
          const usersSnapshot = await getDocs(
            query(collection(db, 'users'), where('__name__', 'in', batchUserIds))
          );

          usersSnapshot.forEach((userDoc) => {
            userDataMap.set(userDoc.id, userDoc.data());
          });
        }

        if (!isActive) {
          return;
        }

        setMembers(
          memberIds.map((memberId) => {
            const userData = userDataMap.get(memberId);

            if (userData) {
              return {
                uid: memberId,
                role: memberRoles[memberId],
                displayName: userData.displayName || userData.email || `User ${memberId.slice(0, 8)}`,
                email: userData.email || `${memberId.slice(0, 8)}@example.com`,
                profileColor: userData.profileColor,
              };
            }

            if (memberId === currentUser?.uid) {
              return {
                uid: memberId,
                role: memberRoles[memberId],
                displayName: currentUser.displayName || currentUser.email || 'You',
                email: currentUser.email || '',
              };
            }

            return {
              uid: memberId,
              role: memberRoles[memberId],
              displayName: `User ${memberId.slice(0, 8)}`,
              email: `${memberId.slice(0, 8)}@example.com`,
            };
          })
        );
      } catch (fetchError) {
        console.error('Error fetching overview members:', fetchError);

        if (isActive) {
          setError('Failed to load member details for this ledger.');
          setMembers(
            memberIds.map((memberId) => ({
              uid: memberId,
              role: memberRoles[memberId],
              displayName:
                memberId === currentUser?.uid
                  ? currentUser?.displayName || currentUser?.email || 'You'
                  : `User ${memberId.slice(0, 8)}`,
              email:
                memberId === currentUser?.uid
                  ? currentUser?.email || ''
                  : `${memberId.slice(0, 8)}@example.com`,
            }))
          );
        }
      } finally {
        markLoaded('members');
      }
    }

    fetchMembers();

    const categoriesUnsubscribe = onSnapshot(
      collection(db, 'ledgers', currentLedger.id, 'categories'),
      (snapshot) => {
        if (!isActive) {
          return;
        }

        setCategories(
          snapshot.docs.map((categoryDoc) => ({
            id: categoryDoc.id,
            ...categoryDoc.data(),
          }))
        );
        markLoaded('categories');
      },
      (snapshotError) => {
        console.error('Error subscribing to overview categories:', snapshotError);

        if (isActive) {
          setError('Failed to load categories for this ledger.');
          setCategories([]);
        }
        markLoaded('categories');
      }
    );

    const budgetsUnsubscribe = onSnapshot(
      query(collection(db, 'ledgers', currentLedger.id, 'budgets'), orderBy('startDate', 'desc')),
      (snapshot) => {
        if (!isActive) {
          return;
        }

        setBudgets(
          snapshot.docs.map((budgetDoc) => {
            const budget = budgetDoc.data();

            return {
              id: budgetDoc.id,
              ...budget,
              startDate: normalizeDate(budget.startDate) || new Date(),
              endDate: normalizeDate(budget.endDate) || new Date(),
            };
          })
        );
        markLoaded('budgets');
      },
      (snapshotError) => {
        console.error('Error subscribing to overview budgets:', snapshotError);

        if (isActive) {
          setError('Failed to load budgets for this ledger.');
          setBudgets([]);
        }
        markLoaded('budgets');
      }
    );

    const transactionsUnsubscribe = onSnapshot(
      query(collection(db, 'ledgers', currentLedger.id, 'transactions'), orderBy('date', 'desc')),
      (snapshot) => {
        if (!isActive) {
          return;
        }

        setTransactions(
          snapshot.docs.map((transactionDoc) => {
            const transaction = transactionDoc.data();

            return {
              id: transactionDoc.id,
              ...transaction,
              date: normalizeDate(transaction.date) || new Date(),
            };
          })
        );
        markLoaded('transactions');
      },
      (snapshotError) => {
        console.error('Error subscribing to overview transactions:', snapshotError);

        if (isActive) {
          setError('Failed to load transactions for this ledger.');
          setTransactions([]);
        }
        markLoaded('transactions');
      }
    );

    return () => {
      isActive = false;
      categoriesUnsubscribe();
      budgetsUnsubscribe();
      transactionsUnsubscribe();
    };
  }, [currentLedger, currentUser]);

  return useMemo(
    () => ({
      transactions,
      categories,
      budgets,
      members,
      loading,
      error,
    }),
    [transactions, categories, budgets, members, loading, error]
  );
}
