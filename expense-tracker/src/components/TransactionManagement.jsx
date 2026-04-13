import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Plus, Upload } from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLedger } from '@/contexts/LedgerContext';
import TransactionBatchEdit from '@/features/transactions/components/TransactionBatchEdit';
import TransactionForm from '@/features/transactions/components/TransactionForm';
import TransactionList from '@/features/transactions/components/TransactionList';
import DataImport from '@/components/DataImport';
import {
  createDefaultBatchEditState,
  createDefaultCategories,
  createDefaultTransactionForm,
  getSplitMode,
  normalizeTransactionForEdit,
} from '@/features/transactions/utils/transactionManagement';

export default function TransactionManagement({ debugModeEnabled = false, thinkingModeEnabled = false }) {
  const { currentUser } = useAuth();
  const { currentLedger, canEdit } = useLedger();
  const location = useLocation();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [showBatchEdit, setShowBatchEdit] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [splitMode, setSplitMode] = useState('none');

  const [formData, setFormData] = useState(createDefaultTransactionForm(currentUser?.uid || ''));
  const [batchEditData, setBatchEditData] = useState(createDefaultBatchEditState());
  const showImportPage = location.pathname === '/transactions/import';

  const resetForm = useCallback(() => {
    setFormData(createDefaultTransactionForm(currentUser?.uid || ''));
    setSplitMode('none');
    setEditingTransaction(null);
  }, [currentUser]);

  const createMissingDefaultCategories = useCallback(async () => {
    if (!currentLedger) {
      return;
    }

    const categoriesRef = collection(db, 'ledgers', currentLedger.id, 'categories');
    for (const category of createDefaultCategories()) {
      await addDoc(categoriesRef, category);
    }
  }, [currentLedger]);

  const fetchTransactions = useCallback(async () => {
    if (!currentLedger) {
      setTransactions([]);
      return;
    }

    try {
      const transactionsSnapshot = await getDocs(
        query(collection(db, 'ledgers', currentLedger.id, 'transactions'), orderBy('date', 'desc'))
      );

      setTransactions(
        transactionsSnapshot.docs.map((transactionSnapshot) => {
          const transaction = transactionSnapshot.data();
          return {
            id: transactionSnapshot.id,
            ...transaction,
            date: transaction.date?.toDate() || new Date(),
          };
        })
      );
    } catch (fetchError) {
      console.error('Error fetching transactions:', fetchError);
      setError('Failed to fetch transactions');
    }
  }, [currentLedger]);

  const fetchCategories = useCallback(async () => {
    if (!currentLedger) {
      setCategories([]);
      return;
    }

    try {
      const categoriesSnapshot = await getDocs(collection(db, 'ledgers', currentLedger.id, 'categories'));
      const nextCategories = categoriesSnapshot.docs.map((categorySnapshot) => ({
        id: categorySnapshot.id,
        ...categorySnapshot.data(),
      }));

      if (nextCategories.length === 0) {
        await createMissingDefaultCategories();
        const refreshedSnapshot = await getDocs(
          collection(db, 'ledgers', currentLedger.id, 'categories')
        );
        setCategories(
          refreshedSnapshot.docs.map((categorySnapshot) => ({
            id: categorySnapshot.id,
            ...categorySnapshot.data(),
          }))
        );
        return;
      }

      setCategories(nextCategories);
    } catch (fetchError) {
      console.error('Error fetching categories:', fetchError);
      setError('Failed to fetch categories');
    }
  }, [createMissingDefaultCategories, currentLedger]);

  const fetchMembers = useCallback(async () => {
    if (!currentLedger?.members) {
      setMembers([]);
      return;
    }

    try {
      const memberList = [];
      const userIds = Object.keys(currentLedger.members);
      const batchSize = 10;
      const userDataMap = new Map();

      for (let index = 0; index < userIds.length; index += batchSize) {
        const batchUserIds = userIds.slice(index, index + batchSize);

        try {
          const userSnapshot = await getDocs(
            query(collection(db, 'users'), where('__name__', 'in', batchUserIds))
          );

          userSnapshot.forEach((userDoc) => {
            userDataMap.set(userDoc.id, userDoc.data());
          });
        } catch (batchError) {
          console.error('Error fetching user batch:', batchError);
        }
      }

      for (const [userId, role] of Object.entries(currentLedger.members)) {
        const userInfo = userDataMap.get(userId);

        if (userInfo) {
          memberList.push({
            uid: userId,
            role,
            displayName: userInfo.displayName,
            email: userInfo.email,
            profileColor: userInfo.profileColor,
          });
          continue;
        }

        if (userId === currentUser?.uid) {
          memberList.push({
            uid: userId,
            role,
            displayName: currentUser.displayName,
            email: currentUser.email,
          });
          continue;
        }

        memberList.push({
          uid: userId,
          role,
          displayName: `User ${userId.slice(0, 8)}`,
          email: `${userId.slice(0, 8)}@example.com`,
        });
      }

      setMembers(memberList);
    } catch (fetchError) {
      console.error('Error fetching members:', fetchError);
      setError('Failed to fetch members');
    }
  }, [currentLedger, currentUser]);

  useEffect(() => {
    if (!currentLedger) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([fetchTransactions(), fetchCategories(), fetchMembers()]).finally(() => {
      setLoading(false);
    });
  }, [currentLedger, fetchCategories, fetchMembers, fetchTransactions]);

  useEffect(() => {
    if (!currentLedger) {
      return undefined;
    }

    const transactionsQuery = query(
      collection(db, 'ledgers', currentLedger.id, 'transactions'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(
      transactionsQuery,
      (transactionsSnapshot) => {
        setTransactions(
          transactionsSnapshot.docs.map((transactionSnapshot) => {
            const transaction = transactionSnapshot.data();
            return {
              id: transactionSnapshot.id,
              ...transaction,
              date: transaction.date?.toDate?.() || new Date(),
            };
          })
        );
      },
      (snapshotError) => {
        console.error('Error subscribing to transactions:', snapshotError);
        setError('Failed to keep transactions up to date');
      }
    );

    return () => unsubscribe();
  }, [currentLedger]);

  useEffect(() => {
    if (!showImportPage && location.state?.refreshTransactions) {
      fetchTransactions();
    }
  }, [fetchTransactions, location.state, showImportPage]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setFormData((previous) => ({
      ...previous,
      paidBy: previous.paidBy || currentUser.uid,
    }));
  }, [currentUser]);

  useEffect(() => {
    if (!success && !error) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setSuccess('');
      setError('');
    }, 3000);

    return () => clearTimeout(timer);
  }, [success, error]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canEdit()) {
      setError('You do not have permission to add transactions');
      return;
    }

    try {
      setError('');

      const transactionData = {
        ...formData,
        amount: Number.parseFloat(formData.amount),
        date: Timestamp.fromDate(new Date(formData.date)),
        createdAt: Timestamp.now(),
        userId: currentUser.uid,
        paidBy: formData.paidBy,
        splitType: formData.splitType,
        splitWith: formData.splitWith,
        splitAmounts: formData.splitAmounts,
      };

      if (editingTransaction) {
        await updateDoc(
          doc(db, 'ledgers', currentLedger.id, 'transactions', editingTransaction.id),
          transactionData
        );
        setSuccess('Transaction updated successfully');
      } else {
        await addDoc(collection(db, 'ledgers', currentLedger.id, 'transactions'), transactionData);
        setSuccess('Transaction added successfully');
      }

      setShowAddForm(false);
      resetForm();
      await fetchTransactions();
    } catch (submitError) {
      console.error('Error adding/updating transaction:', submitError);
      setError('Failed to add or update transaction');
    }
  };

  const handleDelete = async (transactionId) => {
    if (!canEdit()) {
      setError('You do not have permission to delete transactions');
      return;
    }

    try {
      await deleteDoc(doc(db, 'ledgers', currentLedger.id, 'transactions', transactionId));
      setSuccess('Transaction deleted successfully');
      await fetchTransactions();
    } catch (deleteError) {
      console.error('Error deleting transaction:', deleteError);
      setError('Failed to delete transaction');
    }
  };

  const handleBatchDelete = async () => {
    if (!canEdit() || selectedTransactions.length === 0) {
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedTransactions.length} selected transactions?`)) {
      return;
    }

    try {
      const batchSize = 500;

      for (let index = 0; index < selectedTransactions.length; index += batchSize) {
        const batch = writeBatch(db);

        selectedTransactions.slice(index, index + batchSize).forEach((transactionId) => {
          batch.delete(doc(db, 'ledgers', currentLedger.id, 'transactions', transactionId));
        });

        await batch.commit();
      }

      setSuccess(`Deleted ${selectedTransactions.length} transactions`);
      setSelectedTransactions([]);
      await fetchTransactions();
    } catch (batchDeleteError) {
      console.error('Error batch deleting transactions:', batchDeleteError);
      setError('Failed to delete selected transactions');
    }
  };

  const handleBatchEdit = async () => {
    if (!canEdit() || selectedTransactions.length === 0) {
      return;
    }

    try {
      const updates = {};

      if (batchEditData.categoryId) {
        updates.categoryId = batchEditData.categoryId;
      }

      if (batchEditData.includeInBudget !== null) {
        updates.includeInBudget = batchEditData.includeInBudget;
      }

      const batchSize = 500;

      for (let index = 0; index < selectedTransactions.length; index += batchSize) {
        const batch = writeBatch(db);

        selectedTransactions.slice(index, index + batchSize).forEach((transactionId) => {
          batch.update(doc(db, 'ledgers', currentLedger.id, 'transactions', transactionId), updates);
        });

        await batch.commit();
      }

      setSuccess(`Updated ${selectedTransactions.length} transactions`);
      setSelectedTransactions([]);
      setShowBatchEdit(false);
      setBatchEditData(createDefaultBatchEditState());
      await fetchTransactions();
    } catch (batchEditError) {
      console.error('Error batch updating transactions:', batchEditError);
      setError('Failed to update selected transactions');
    }
  };

  const handleEdit = (transaction) => {
    const normalizedTransaction = normalizeTransactionForEdit(transaction);
    setEditingTransaction(transaction);
    setShowAddForm(true);
    setFormData(normalizedTransaction);
    setSplitMode(getSplitMode(normalizedTransaction.splitWith, members, normalizedTransaction.paidBy));
  };

  const handleOpenAddForm = () => {
    resetForm();
    setShowAddForm(true);
  };

  const handleCancelForm = () => {
    setShowAddForm(false);
    resetForm();
  };

  const toggleTransactionSelection = (transactionId) => {
    setSelectedTransactions((previous) =>
      previous.includes(transactionId)
        ? previous.filter((id) => id !== transactionId)
        : [...previous, transactionId]
    );
  };

  const selectAllTransactions = () => {
    setSelectedTransactions((previous) =>
      previous.length === transactions.length ? [] : transactions.map((transaction) => transaction.id)
    );
  };

  const isMultiMemberLedger = members.length > 1;

  if (loading) {
    return <div className="p-6">Loading transactions...</div>;
  }

  if (!currentLedger) {
    return <div className="p-6">Please select a ledger to view transactions.</div>;
  }

  if (showImportPage) {
    return (
      <DataImport
        debugModeEnabled={debugModeEnabled}
        thinkingModeEnabled={thinkingModeEnabled}
        onBack={() => navigate('/transactions', { state: { refreshTransactions: Date.now() } })}
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
        {canEdit() && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/transactions/import')}
              className="flex items-center space-x-2"
            >
              <Upload className="h-4 w-4" />
              <span>Import Transactions</span>
            </Button>
            <Button onClick={handleOpenAddForm} className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Add Single Transaction</span>
            </Button>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {showAddForm && (
        <TransactionForm
          formData={formData}
          setFormData={setFormData}
          categories={categories}
          members={members}
          splitMode={splitMode}
          setSplitMode={setSplitMode}
          currentLedger={currentLedger}
          editingTransaction={editingTransaction}
          isMultiMemberLedger={isMultiMemberLedger}
          onSubmit={handleSubmit}
          onCancel={handleCancelForm}
        />
      )}

      {showBatchEdit && (
        <TransactionBatchEdit
          selectedCount={selectedTransactions.length}
          batchEditData={batchEditData}
          setBatchEditData={setBatchEditData}
          categories={categories}
          onCancel={() => {
            setShowBatchEdit(false);
            setBatchEditData(createDefaultBatchEditState());
          }}
          onSubmit={handleBatchEdit}
        />
      )}

      <TransactionList
        transactions={transactions}
        categories={categories}
        members={members}
        selectedTransactions={selectedTransactions}
        currentLedger={currentLedger}
        onToggleSelection={toggleTransactionSelection}
        onSelectAll={selectAllTransactions}
        onShowBatchEdit={() => setShowBatchEdit(true)}
        onBatchDelete={handleBatchDelete}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
