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
  Timestamp 
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
    splitWith: [], // Array of user IDs
    splitAmounts: {} // Object with userId: amount pairs for custom splits
  });

  // Batch edit state
  const [batchEditData, setBatchEditData] = useState({
    categoryId: '',
    includeInBudget: null
  });

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

  // Fetch members
  const fetchMembers = async () => {
    if (!currentLedger?.members) return;

    try {
      const memberList = [];
      
      // Get member details from users collection
      for (const [userId, role] of Object.entries(currentLedger.members)) {
        try {
          const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', userId)));
          let userData = { uid: userId, role };
          
          if (!userDoc.empty) {
            const userInfo = userDoc.docs[0].data();
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
        } catch (error) {
          console.error(`Error fetching user ${userId}:`, error);
          // Add user with minimal info if fetch fails
          memberList.push({
            uid: userId,
            role,
            displayName: userId === currentUser?.uid ? 
              (currentUser.displayName || currentUser.email) : 
              `User ${userId.slice(0, 8)}`,
            email: userId === currentUser?.uid ? 
              currentUser.email : 
              `${userId.slice(0, 8)}@example.com`
          });
        }
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
        splitAmounts: formData.splitAmounts
      };

      if (editingTransaction) {
        await updateDoc(doc(db, 'ledgers', currentLedger.id, 'transactions', editingTransaction.id), transactionData);
        setSuccess('Transaction updated successfully');
      } else {
        await addDoc(collection(db, 'ledgers', currentLedger.id, 'transactions'), transactionData);
        setSuccess('Transaction added successfully');
      }

      setFormData({
        amount: '',
        type: 'expense',
        description: '',
        categoryId: '',
        paymentMethod: 'credit card',
        notes: '',
        includeInBudget: true,
        date: new Date().toISOString().split('T')[0],
        // Reset splitting fields
        paidBy: currentUser?.uid || '',
        splitType: 'none',
        splitWith: [],
        splitAmounts: {}
      });
      setShowAddForm(false);
      setEditingTransaction(null);
      await fetchTransactions();
    } catch (error) {
      console.error('Error saving transaction:', error);
      setError('Failed to save transaction');
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

  // Handle batch edit
  const handleBatchEdit = async () => {
    if (!canEdit() || selectedTransactions.length === 0) return;

    try {
      setError('');
      const updates = {};
      if (batchEditData.categoryId) updates.categoryId = batchEditData.categoryId;
      if (batchEditData.includeInBudget !== null) updates.includeInBudget = batchEditData.includeInBudget;

      for (const transactionId of selectedTransactions) {
        await updateDoc(doc(db, 'ledgers', currentLedger.id, 'transactions', transactionId), updates);
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
    const allMemberIds = members.map(m => m.uid);
    setFormData(prev => ({
      ...prev,
      splitType: 'equal',
      splitWith: allMemberIds
    }));
  };

  const handleSplitWithToggle = (userId) => {
    setFormData(prev => ({
      ...prev,
      splitWith: prev.splitWith.includes(userId)
        ? prev.splitWith.filter(id => id !== userId)
        : [...prev.splitWith, userId]
    }));
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
          {selectedTransactions.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowBatchEdit(true)}
              className="flex items-center space-x-2"
            >
              <Edit className="h-4 w-4" />
              <span>Batch Edit ({selectedTransactions.length})</span>
            </Button>
          )}
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
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter(cat => cat.type === formData.type).map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select value={formData.paymentMethod} onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit card">Credit Card</SelectItem>
                      <SelectItem value="debit card">Debit Card</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank transfer">Bank Transfer</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
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
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Splitting Section - Only show for multi-member ledgers */}
              {isMultiMemberLedger && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <Label className="text-base font-medium">Expense Splitting</Label>
                  </div>

                  {/* Paid By */}
                  <div>
                    <Label>Paid By</Label>
                    <Select value={formData.paidBy} onValueChange={(value) => setFormData({ ...formData, paidBy: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select who paid" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((member) => (
                          <SelectItem key={member.uid} value={member.uid}>
                            <div className="flex items-center space-x-2">
                              <ProfileImage user={member} size="xs" />
                              <span>{member.displayName || member.email}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Split Options */}
                  <div>
                    <Label>Split Expense</Label>
                    <div className="flex space-x-2 mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={formData.splitType === 'none' ? 'default' : 'outline'}
                        onClick={() => handleSplitTypeChange('none')}
                      >
                        Don't Split
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={formData.splitType === 'equal' ? 'default' : 'outline'}
                        onClick={handleSplitWithEveryone}
                      >
                        <UserCheck className="h-3 w-3 mr-1" />
                        Everyone
                      </Button>
                    </div>
                  </div>

                  {/* Member Selection - Only show when not "Don't Split" */}
                  {formData.splitType !== 'none' && (
                    <div>
                      <Label>Split With</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {members.map((member) => (
                          <div
                            key={member.uid}
                            className={`
                              flex items-center space-x-2 p-2 border rounded cursor-pointer transition-colors
                              ${formData.splitWith.includes(member.uid) 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200 hover:border-gray-300'
                              }
                            `}
                            onClick={() => handleSplitWithToggle(member.uid)}
                          >
                            <Checkbox
                              checked={formData.splitWith.includes(member.uid)}
                              onChange={() => {}} // Handled by parent click
                            />
                            <ProfileImage user={member} size="xs" />
                            <span className="text-sm">{member.displayName || member.email}</span>
                          </div>
                        ))}
                      </div>
                      {formData.splitWith.length > 0 && (
                        <p className="text-xs text-gray-600 mt-2">
                          Split between {formData.splitWith.length} member{formData.splitWith.length > 1 ? 's' : ''}
                          {formData.amount && ` (${(parseFloat(formData.amount) / formData.splitWith.length).toFixed(2)} each)`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeInBudget"
                  checked={formData.includeInBudget}
                  onCheckedChange={(checked) => setFormData({ ...formData, includeInBudget: checked })}
                />
                <Label htmlFor="includeInBudget">Include in budget calculations</Label>
              </div>
              <div className="flex space-x-2">
                <Button type="submit">
                  {editingTransaction ? 'Update Transaction' : 'Add Transaction'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingTransaction(null);
                    setFormData({
                      amount: '',
                      type: 'expense',
                      description: '',
                      categoryId: '',
                      paymentMethod: 'credit card',
                      notes: '',
                      includeInBudget: true,
                      date: new Date().toISOString().split('T')[0]
                    });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Batch Edit Form */}
      {showBatchEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Batch Edit Transactions</CardTitle>
            <CardDescription>
              Update {selectedTransactions.length} selected transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="batchCategory">Change Category</Label>
                <Select value={batchEditData.categoryId} onValueChange={(value) => setBatchEditData({ ...batchEditData, categoryId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select new category (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name} ({category.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Include in Budget</Label>
                <div className="flex space-x-4 mt-2">
                  <Button
                    type="button"
                    variant={batchEditData.includeInBudget === true ? "default" : "outline"}
                    onClick={() => setBatchEditData({ ...batchEditData, includeInBudget: true })}
                  >
                    Include
                  </Button>
                  <Button
                    type="button"
                    variant={batchEditData.includeInBudget === false ? "default" : "outline"}
                    onClick={() => setBatchEditData({ ...batchEditData, includeInBudget: false })}
                  >
                    Exclude
                  </Button>
                  <Button
                    type="button"
                    variant={batchEditData.includeInBudget === null ? "default" : "outline"}
                    onClick={() => setBatchEditData({ ...batchEditData, includeInBudget: null })}
                  >
                    No Change
                  </Button>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleBatchEdit}>
                  Update Transactions
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowBatchEdit(false);
                    setBatchEditData({ categoryId: '', includeInBudget: null });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                {transactions.length} transactions in {currentLedger.name}
              </CardDescription>
            </div>
            {transactions.length > 0 && (
              <Button
                variant="outline"
                onClick={selectAllTransactions}
                className="flex items-center space-x-2"
              >
                {selectedTransactions.length === transactions.length ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                <span>Select All</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No transactions found. Add your first transaction to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((transaction) => {
                const category = categories.find(cat => cat.id === transaction.categoryId);
                return (
                  <div
                    key={transaction.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${
                      selectedTransactions.includes(transaction.id) ? 'bg-blue-50 border-blue-200' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <Checkbox
                        checked={selectedTransactions.includes(transaction.id)}
                        onCheckedChange={() => toggleTransactionSelection(transaction.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium">{transaction.description}</h3>
                          {category && (
                            <Badge variant="secondary">{category.name}</Badge>
                          )}
                          {!transaction.includeInBudget && (
                            <Badge variant="outline">Excluded from Budget</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center space-x-4">
                          <span className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>{transaction.date.toLocaleDateString()}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Tag className="h-3 w-3" />
                            <span>{transaction.paymentMethod}</span>
                          </span>
                        </div>
                        {transaction.notes && (
                          <p className="text-sm text-gray-600 mt-1">{transaction.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className={`text-lg font-semibold ${
                        transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
                      </div>
                      {canEdit() && (
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingTransaction(transaction);
                              setFormData({
                                amount: transaction.amount.toString(),
                                type: transaction.type,
                                description: transaction.description,
                                categoryId: transaction.categoryId || '',
                                paymentMethod: transaction.paymentMethod || 'credit card',
                                notes: transaction.notes || '',
                                includeInBudget: transaction.includeInBudget !== false,
                                date: transaction.date.toISOString().split('T')[0]
                              });
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(transaction.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

