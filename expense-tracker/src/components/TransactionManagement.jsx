import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import {
  Plus,
  Edit,
  Trash2,
  Filter,
  Search,
  Calendar,
  DollarSign,
  Tag,
  CheckSquare,
  Square,
  Users,
  UserCheck
} from 'lucide-react';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLedger } from '../contexts/LedgerContext';
import ProfileImage, { ProfileImageWithName } from './ProfileImage';

export default function TransactionManagement() {
  const { currentUser } = useAuth();
  const { currentLedger, canEdit } = useLedger();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [showBatchEdit, setShowBatchEdit] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    amount: '',
    type: 'expense',
    description: '',
    categoryId: '',
    paymentMethod: 'credit card',
    notes: '',
    includeInBudget: true,
    date: new Date().toISOString().split('T')[0],
    // Splitting fields
    paidBy: currentUser?.uid || '',
    splitType: 'none', // 'none', 'equal', 'custom'
    splitWith: [], // CRITICAL: Always initialize as empty array
    splitAmounts: {} // Object with userId: amount pairs for custom splits
  });

  // Split mode state for the new button logic
  const [splitMode, setSplitMode] = useState('none'); // 'none', 'individuals', 'everyone'

  // Batch edit state
  const [batchEditData, setBatchEditData] = useState({
    categoryId: '',
    includeInBudget: null
  });

  // Reset form function
  const resetForm = () => {
    setFormData({
      amount: '',
      type: 'expense',
      description: '',
      categoryId: '',
      paymentMethod: 'credit card',
      notes: '',
      includeInBudget: true,
      date: new Date().toISOString().split('T')[0],
      paidBy: currentUser?.uid || '',
      splitType: 'none',
      splitWith: [], // CRITICAL: Reset to empty array
      splitAmounts: {},
    });
    setSplitMode('none'); // CRITICAL FIX: Reset split mode to default
    setIsEditing(false);
    setEditingId(null);
    setEditingTransaction(null);
  };

  // Fetch transactions
  const fetchTransactions = async () => {
    if (!currentLedger) return;

    try {
      const transactionsRef = collection(db, 'ledgers', currentLedger.id, 'transactions');
      const q = query(transactionsRef, orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const transactionList = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        transactionList.push({
          id: doc.id,
          ...data,
          date: data.date?.toDate() || new Date()
        });
      });

      setTransactions(transactionList);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError('Failed to fetch transactions');
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    if (!currentLedger) return;

    try {
      const categoriesRef = collection(db, 'ledgers', currentLedger.id, 'categories');
      const querySnapshot = await getDocs(categoriesRef);
      
      const categoryList = [];
      querySnapshot.forEach((doc) => {
        categoryList.push({
          id: doc.id,
          ...doc.data()
        });
      });

      setCategories(categoryList);

      // Create default categories if none exist
      if (categoryList.length === 0) {
        await createDefaultCategories();
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Fetch members with optimized queries
  const fetchMembers = async () => {
    if (!currentLedger?.members) return;

    try {
      const memberList = [];
      const userIds = Object.keys(currentLedger.members);
      
      // Batch user queries in groups of 10 (Firestore 'in' query limit)
      const BATCH_SIZE = 10;
      const userDataMap = new Map();
      
      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const batchUserIds = userIds.slice(i, i + BATCH_SIZE);
        
        try {
          const userQuery = query(
            collection(db, 'users'),
            where('__name__', 'in', batchUserIds)
          );
          const userSnapshot = await getDocs(userQuery);
          
          userSnapshot.forEach((doc) => {
            userDataMap.set(doc.id, doc.data());
          });
        } catch (error) {
          console.error('Error fetching user batch:', error);
        }
      }
      
      // Build member list with fetched data
      for (const [userId, role] of Object.entries(currentLedger.members)) {
        let userData = { uid: userId, role };
        
        const userInfo = userDataMap.get(userId);
        if (userInfo) {
          userData = {
            ...userData,
            displayName: userInfo.displayName,
            email: userInfo.email,
            profileColor: userInfo.profileColor
          };
        } else if (userId === currentUser?.uid) {
          // Use current user data if user document doesn't exist
          userData = {
            ...userData,
            displayName: currentUser.displayName,
            email: currentUser.email
          };
        } else {
          // Fallback for unknown users
          userData = {
            ...userData,
            displayName: `User ${userId.slice(0, 8)}`,
            email: `${userId.slice(0, 8)}@example.com`
          };
        }
        
        memberList.push(userData);
      }

      setMembers(memberList);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  // Create default categories
  const createDefaultCategories = async () => {
    const defaultCategories = [
      { name: 'Food & Dining', type: 'expense' },
      { name: 'Transportation', type: 'expense' },
      { name: 'Shopping', type: 'expense' },
      { name: 'Entertainment', type: 'expense' },
      { name: 'Bills & Utilities', type: 'expense' },
      { name: 'Healthcare', type: 'expense' },
      { name: 'Salary', type: 'income' },
      { name: 'Freelance', type: 'income' },
      { name: 'Investment', type: 'income' }
    ];

    try {
      const categoriesRef = collection(db, 'ledgers', currentLedger.id, 'categories');
      for (const category of defaultCategories) {
        await addDoc(categoriesRef, category);
      }
      await fetchCategories();
    } catch (error) {
      console.error('Error creating default categories:', error);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit()) {
      setError('You do not have permission to add transactions');
      return;
    }

    try {
      setError('');
      const transactionData = {
        ...formData,
        amount: parseFloat(formData.amount),
        date: Timestamp.fromDate(new Date(formData.date)),
        createdAt: Timestamp.now(),
        userId: currentUser.uid,
        // Include splitting data
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
        await addDoc(
          collection(db, 'ledgers', currentLedger.id, 'transactions'),
          transactionData
        );
        setSuccess('Transaction added successfully');
      }

      resetForm(); // Call resetForm after successful submission
      setShowAddForm(false);
      setEditingTransaction(null);
      await fetchTransactions(); // Refresh transactions after submission
    } catch (error) {
      console.error('Error adding/updating transaction:', error);
      setError('Failed to add/update transaction');
    }
  };

  // Handle transaction deletion
  const handleDelete = async (transactionId) => {
    if (!canEdit()) {
      setError('You do not have permission to delete transactions');
      return;
    }

    try {
      await deleteDoc(doc(db, 'ledgers', currentLedger.id, 'transactions', transactionId));
      setSuccess('Transaction deleted successfully');
      await fetchTransactions();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      setError('Failed to delete transaction');
    }
  };

  // Handle batch deletion with batch writes for better performance
  const handleBatchDelete = async () => {
    if (!canEdit() || selectedTransactions.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${selectedTransactions.length} selected transactions?`)) {
      return;
    }

    try {
      setError("");
      
      // Process deletions in batches of 500 (Firestore batch limit)
      const BATCH_SIZE = 500;
      const batches = [];
      
      for (let i = 0; i < selectedTransactions.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const batchTransactionIds = selectedTransactions.slice(i, i + BATCH_SIZE);
        
        batchTransactionIds.forEach(transactionId => {
          const transactionRef = doc(db, "ledgers", currentLedger.id, "transactions", transactionId);
          batch.delete(transactionRef);
        });
        
        batches.push(batch);
      }
      
      // Execute all batches
      for (const batch of batches) {
        await batch.commit();
      }

      setSuccess(`Deleted ${selectedTransactions.length} transactions`);
      setSelectedTransactions([]);
      await fetchTransactions();
    } catch (error) {
      console.error("Error batch deleting transactions:", error);
      setError("Failed to delete transactions");
    }
  };

  // Handle batch edit with batch writes for better performance
  const handleBatchEdit = async () => {
    if (!canEdit() || selectedTransactions.length === 0) return;

    try {
      setError('');
      const updates = {};
      if (batchEditData.categoryId) updates.categoryId = batchEditData.categoryId;
      if (batchEditData.includeInBudget !== null) updates.includeInBudget = batchEditData.includeInBudget;

      // Process updates in batches of 500 (Firestore batch limit)
      const BATCH_SIZE = 500;
      const batches = [];
      
      for (let i = 0; i < selectedTransactions.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const batchTransactionIds = selectedTransactions.slice(i, i + BATCH_SIZE);
        
        batchTransactionIds.forEach(transactionId => {
          const transactionRef = doc(db, 'ledgers', currentLedger.id, 'transactions', transactionId);
          batch.update(transactionRef, updates);
        });
        
        batches.push(batch);
      }
      
      // Execute all batches
      for (const batch of batches) {
        await batch.commit();
      }

      setSuccess(`Updated ${selectedTransactions.length} transactions`);
      setSelectedTransactions([]);
      setShowBatchEdit(false);
      setBatchEditData({ categoryId: '', includeInBudget: null });
      await fetchTransactions();
    } catch (error) {
      console.error('Error batch updating transactions:', error);
      setError('Failed to update transactions');
    }
  };

  // Handle edit
  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setIsEditing(true);
    setEditingId(transaction.id);
    setShowAddForm(true);
    setFormData({
      ...transaction,
      date: transaction.date instanceof Date ? transaction.date.toISOString().split('T')[0] : transaction.date,
      splitWith: transaction.splitWith || [], // Ensure splitWith is an array
      splitAmounts: transaction.splitAmounts || {},
    });
    // Set splitMode based on the loaded transaction
    const allOtherMembers = members.filter(m => m.uid !== currentUser?.uid);
    const allOtherMemberIds = allOtherMembers.map(m => m.uid);
    if (transaction.splitWith.length === 0) {
      setSplitMode('none');
    } else if (transaction.splitWith.length === allOtherMemberIds.length && 
               allOtherMemberIds.every(id => transaction.splitWith.includes(id))) {
      setSplitMode('everyone');
    } else {
      setSplitMode('individuals');
    }
  };

  // Toggle transaction selection
  const toggleTransactionSelection = (transactionId) => {
    setSelectedTransactions(prev => 
      prev.includes(transactionId) 
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  // Select all transactions
  const selectAllTransactions = () => {
    if (selectedTransactions.length === transactions.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(transactions.map(t => t.id));
    }
  };

  // Splitting helper functions
  const handleSplitTypeChange = (splitType) => {
    setFormData(prev => ({
      ...prev,
      splitType,
      splitWith: splitType === 'none' ? [] : prev.splitWith,
      splitAmounts: splitType === 'none' ? {} : prev.splitAmounts
    }));
  };

  const handleSplitWithEveryone = () => {
    const allMemberIds = members.filter(m => m.uid !== currentUser?.uid).map(m => m.uid);
    setFormData(prev => ({
      ...prev,
      splitType: 'equal',
      splitWith: allMemberIds
    }));
  };

  // CRITICAL FIX: Safe member toggle with proper array handling
  const handleSplitWithToggle = (userId) => {
    setFormData(prev => {
      // DEFENSIVE PROGRAMMING: Ensure splitWith is always an array
      const currentSplitWith = prev.splitWith || []; // Safe default
      const newSplitWith = currentSplitWith.includes(userId)
        ? currentSplitWith.filter(id => id !== userId)
        : [...currentSplitWith, userId];
      
      // CRITICAL FIX: Use setTimeout to prevent infinite loops
      setTimeout(() => {
        updateSplitModeBasedOnSelection(newSplitWith);
      }, 0);
      
      return {
        ...prev,
        splitWith: newSplitWith,
        splitType: newSplitWith.length > 0 ? 'equal' : 'none'
      };
    });
  };

  // New split mode handlers
  const handleSplitModeChange = (mode) => {
    setSplitMode(mode);
    
    if (mode === 'none') {
      setFormData(prev => ({
        ...prev,
        splitType: 'none',
        splitWith: []
      }));
    } else if (mode === 'everyone') {
      const allMemberIds = members.filter(m => m.uid !== currentUser?.uid).map(m => m.uid);
      setFormData(prev => ({
        ...prev,
        splitType: 'equal',
        splitWith: allMemberIds
      }));
    } else if (mode === 'individuals') {
      // Keep current selection but ensure splitType is set
      setFormData(prev => ({
        ...prev,
        splitType: prev.splitWith && prev.splitWith.length > 0 ? 'equal' : 'none'
      }));
    }
  };

  // CRITICAL FIX: Intelligent auto-adjustment logic
  const updateSplitModeBasedOnSelection = (splitWith) => {
    const allOtherMembers = members.filter(m => m.uid !== currentUser?.uid);
    const allOtherMemberIds = allOtherMembers.map(m => m.uid);
    
    if (splitWith.length === 0) {
      setSplitMode('none');
    } else if (splitWith.length === allOtherMemberIds.length && 
               allOtherMemberIds.every(id => splitWith.includes(id))) {
      setSplitMode('everyone');
    } else {
      setSplitMode('individuals');
    }
  };

  const isMultiMemberLedger = members.length > 1;

  useEffect(() => {
    if (currentLedger) {
      Promise.all([fetchTransactions(), fetchCategories(), fetchMembers()]).finally(() => setLoading(false));
    }
  }, [currentLedger]);

  // Update form data when current user changes
  useEffect(() => {
    if (currentUser) {
      setFormData(prev => ({
        ...prev,
        paidBy: currentUser.uid
      }));
    }
  }, [currentUser]);

  if (loading) {
    return <div className="p-6">Loading transactions...</div>;
  }

  if (!currentLedger) {
    return <div className="p-6">Please select a ledger to view transactions.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
        <div className="flex space-x-2">
          {canEdit() && (
            <Button
              onClick={() => setShowAddForm(true)}
              className="flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Transaction</span>
            </Button>
          )}
        </div>
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

      {/* Add/Edit Transaction Form */}
      {(showAddForm || editingTransaction) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Input
                    id="paymentMethod"
                    type="text"
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2 flex items-center space-x-2">
                  <Checkbox
                    id="includeInBudget"
                    checked={formData.includeInBudget}
                    onCheckedChange={(checked) => setFormData({ ...formData, includeInBudget: checked })}
                  />
                  <Label htmlFor="includeInBudget">Include in Budget</Label>
                </div>
              </div>

              {/* Splitting Section */}
              {isMultiMemberLedger && formData.type === 'expense' && (
                <div className="space-y-4 border p-4 rounded-md">
                  <h3 className="text-lg font-semibold">Split Expense</h3>
                  
                  {/* Paid By */}
                  <div>
                    <Label htmlFor="paidBy">Paid By</Label>
                    <Select
                      value={formData.paidBy}
                      onValueChange={(value) => setFormData({ ...formData, paidBy: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select payer" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map(member => (
                          <SelectItem key={member.uid} value={member.uid}>
                            <ProfileImageWithName user={member} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Split Type Buttons */}
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant={splitMode === 'none' ? 'default' : 'outline'}
                      onClick={() => handleSplitModeChange('none')}
                    >
                      Don't Split
                    </Button>
                    <Button
                      type="button"
                      variant={splitMode === 'everyone' ? 'default' : 'outline'}
                      onClick={() => handleSplitModeChange('everyone')}
                    >
                      Split Equally (Everyone Else)
                    </Button>
                    <Button
                      type="button"
                      variant={splitMode === 'individuals' ? 'default' : 'outline'}
                      onClick={() => handleSplitModeChange('individuals')}
                    >
                      Split with Individuals
                    </Button>
                  </div>

                  {/* Individual Selection for Splitting */}
                  {splitMode === 'individuals' && (
                    <div className="space-y-2">
                      <Label>Select Members to Split With:</Label>
                      {members.filter(member => member.uid !== formData.paidBy).map(member => (
                        <div key={member.uid} className="flex items-center space-x-2">
                          <Checkbox
                            id={`split-with-${member.uid}`}
                            checked={(formData.splitWith || []).includes(member.uid)}
                            onCheckedChange={() => handleSplitWithToggle(member.uid)}
                          />
                          <Label htmlFor={`split-with-${member.uid}`}>
                            <ProfileImageWithName user={member} />
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Display calculated split amounts */}
                  {(formData.splitType === 'equal' && (formData.splitWith || []).length > 0) && (
                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-semibold">Split Details:</h4>
                      <p>Total Amount: ${formData.amount || 0}</p>
                      <p>Paid By: <ProfileImageWithName user={members.find(m => m.uid === formData.paidBy)} /></p>
                      <p>Splitting with {(formData.splitWith || []).length} other(s):</p>
                      <ul>
                        {(formData.splitWith || []).map(memberId => {
                          const member = members.find(m => m.uid === memberId);
                          const perPersonAmount = (formData.amount / ((formData.splitWith || []).length + 1)).toFixed(2);
                          return member ? (
                            <li key={member.uid}>- <ProfileImageWithName user={member} />: ${perPersonAmount}</li>
                          ) : null;
                        })}
                        <li>- <ProfileImageWithName user={members.find(m => m.uid === formData.paidBy)} /> (Payer): ${(formData.amount - ((formData.splitWith || []).length * (formData.amount / ((formData.splitWith || []).length + 1)))).toFixed(2)}</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingTransaction ? 'Update Transaction' : 'Add Transaction'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Batch Edit Modal */}
      {showBatchEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Batch Edit Transactions</CardTitle>
            <CardDescription>Edit {selectedTransactions.length} selected transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="batchCategory">Category</Label>
                <Select
                  value={batchEditData.categoryId}
                  onValueChange={(value) => setBatchEditData({ ...batchEditData, categoryId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="batchIncludeInBudget"
                  checked={batchEditData.includeInBudget === true}
                  onCheckedChange={(checked) => setBatchEditData({ ...batchEditData, includeInBudget: checked })}
                />
                <Label htmlFor="batchIncludeInBudget">Include in Budget</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowBatchEdit(false);
                    setBatchEditData({ categoryId: '', includeInBudget: null });
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleBatchEdit}>
                  Update {selectedTransactions.length} Transactions
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>Manage your ledger's financial records.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Batch Controls */}
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                onClick={selectAllTransactions}
              >
                {selectedTransactions.length === transactions.length ? 'Deselect All' : 'Select All'}
              </Button>
              {selectedTransactions.length > 0 && (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowBatchEdit(true)}
                    className="flex items-center space-x-2"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Batch Edit ({selectedTransactions.length})</span>
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleBatchDelete}
                  >
                    Delete Selected ({selectedTransactions.length})
                  </Button>
                </div>
              )}
            </div>

            {/* Transactions with Month Dividers */}
            {transactions.length === 0 ? (
              <p>No transactions found. Add one above!</p>
            ) : (
              <div className="space-y-4">
                {(() => {
                  // Group transactions by month
                  const groupedTransactions = {};
                  transactions.forEach(transaction => {
                    const date = new Date(transaction.date);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    if (!groupedTransactions[monthKey]) {
                      groupedTransactions[monthKey] = [];
                    }
                    groupedTransactions[monthKey].push(transaction);
                  });

                  // Sort month keys in descending order
                  const sortedMonthKeys = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

                  return sortedMonthKeys.map(monthKey => {
                    const monthTransactions = groupedTransactions[monthKey];
                    const [year, month] = monthKey.split('-');
                    const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long' 
                    });

                    return (
                      <div key={monthKey}>
                        {/* Month Divider */}
                        <div className="flex items-center my-6">
                          <div className="flex-grow border-t border-gray-300"></div>
                          <div className="mx-4 px-3 py-1 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
                            {monthName}
                          </div>
                          <div className="flex-grow border-t border-gray-300"></div>
                        </div>

                        {/* Transactions for this month */}
                        <div className="space-y-3">
                          {monthTransactions.map((transaction) => {
                            const category = categories.find(cat => cat.id === transaction.categoryId);
                            const payer = members.find(m => m.uid === transaction.paidBy);
                            const splitMembers = members.filter(m => (transaction.splitWith || []).includes(m.uid));

                            return (
                              <div key={transaction.id} className="border p-4 rounded-md shadow-sm flex justify-between items-center">
                                <div className="flex items-center space-x-3">
                                  <Checkbox
                                    checked={selectedTransactions.includes(transaction.id)}
                                    onCheckedChange={() => toggleTransactionSelection(transaction.id)}
                                  />
                                  <div>
                                    <p className="font-semibold">{transaction.description} - ${transaction.amount.toFixed(2)}</p>
                                    <p className="text-sm text-gray-500">{category?.name} | {new Date(transaction.date).toLocaleDateString()}</p>
                                    {transaction.splitType !== 'none' && (
                                      <p className="text-sm text-gray-500">
                                        Paid by: <ProfileImageWithName user={payer} />
                                        {(transaction.splitWith || []).length > 0 && (
                                          <span>
                                            , Split with: {splitMembers.map(m => m.displayName || m.email).join(', ')}
                                          </span>
                                        )}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex space-x-2">
                                  <Button variant="outline" size="sm" onClick={() => handleEdit(transaction)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="destructive" size="sm" onClick={() => handleDelete(transaction.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}