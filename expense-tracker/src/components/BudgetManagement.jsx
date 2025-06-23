import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target
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

export default function BudgetManagement() {
  const { currentUser } = useAuth();
  const { currentLedger, canEdit } = useLedger();
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    totalAmount: '',
    timeSpan: 'monthly',
    categories: {}
  });

  // Calculate end date based on time span
  const calculateEndDate = (startDate, timeSpan) => {
    const start = new Date(startDate);
    let end = new Date(start);

    switch (timeSpan) {
      case 'weekly':
        end.setDate(start.getDate() + 6);
        break;
      case 'monthly':
        end.setMonth(start.getMonth() + 1);
        end.setDate(start.getDate() - 1);
        break;
      case 'quarterly':
        end.setMonth(start.getMonth() + 3);
        end.setDate(start.getDate() - 1);
        break;
      case 'yearly':
        end.setFullYear(start.getFullYear() + 1);
        end.setDate(start.getDate() - 1);
        break;
      default:
        end.setMonth(start.getMonth() + 1);
        end.setDate(start.getDate() - 1);
    }

    return end.toISOString().split('T')[0];
  };

  // Fetch budgets
  const fetchBudgets = async () => {
    if (!currentLedger) return;

    try {
      const budgetsRef = collection(db, 'ledgers', currentLedger.id, 'budgets');
      const q = query(budgetsRef, orderBy('startDate', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const budgetList = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        budgetList.push({
          id: doc.id,
          ...data,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date()
        });
      });

      setBudgets(budgetList);
    } catch (error) {
      console.error('Error fetching budgets:', error);
      setError('Failed to fetch budgets');
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
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Fetch transactions for budget calculations
  const fetchTransactions = async () => {
    if (!currentLedger) return;

    try {
      const transactionsRef = collection(db, 'ledgers', currentLedger.id, 'transactions');
      const q = query(transactionsRef, where('includeInBudget', '==', true));
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
    }
  };

  // Calculate budget spending
  const calculateBudgetSpending = (budget) => {
    const budgetTransactions = transactions.filter(transaction => {
      const transactionDate = transaction.date;
      return transactionDate >= budget.startDate && 
             transactionDate <= budget.endDate &&
             transaction.type === 'expense';
    });

    const totalSpent = budgetTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    
    const categorySpending = {};
    budgetTransactions.forEach(transaction => {
      if (transaction.categoryId) {
        categorySpending[transaction.categoryId] = (categorySpending[transaction.categoryId] || 0) + transaction.amount;
      }
    });

    return {
      totalSpent,
      categorySpending,
      transactionCount: budgetTransactions.length
    };
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit()) {
      setError('You do not have permission to manage budgets');
      return;
    }

    try {
      setError('');
      const budgetData = {
        ...formData,
        totalAmount: parseFloat(formData.totalAmount),
        startDate: Timestamp.fromDate(new Date(formData.startDate)),
        endDate: Timestamp.fromDate(new Date(formData.endDate)),
        createdAt: Timestamp.now(),
        userId: currentUser.uid
      };

      if (editingBudget) {
        await updateDoc(doc(db, 'ledgers', currentLedger.id, 'budgets', editingBudget.id), budgetData);
        setSuccess('Budget updated successfully');
      } else {
        await addDoc(collection(db, 'ledgers', currentLedger.id, 'budgets'), budgetData);
        setSuccess('Budget created successfully');
      }

      setFormData({
        name: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        totalAmount: '',
        timeSpan: 'monthly',
        categories: {}
      });
      setShowAddForm(false);
      setEditingBudget(null);
      await fetchBudgets();
    } catch (error) {
      console.error('Error saving budget:', error);
      setError('Failed to save budget');
    }
  };

  // Handle budget deletion
  const handleDelete = async (budgetId) => {
    if (!canEdit()) {
      setError('You do not have permission to delete budgets');
      return;
    }

    try {
      await deleteDoc(doc(db, 'ledgers', currentLedger.id, 'budgets', budgetId));
      setSuccess('Budget deleted successfully');
      await fetchBudgets();
    } catch (error) {
      console.error('Error deleting budget:', error);
      setError('Failed to delete budget');
    }
  };

  // Update category budget allocation
  const updateCategoryBudget = (categoryId, amount) => {
    setFormData(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [categoryId]: parseFloat(amount) || 0
      }
    }));
  };

  // Calculate remaining budget for categories
  const calculateRemainingBudget = () => {
    const allocatedAmount = Object.values(formData.categories).reduce((sum, amount) => sum + (amount || 0), 0);
    return (parseFloat(formData.totalAmount) || 0) - allocatedAmount;
  };

  useEffect(() => {
    if (currentLedger) {
      Promise.all([fetchBudgets(), fetchCategories(), fetchTransactions()]).finally(() => setLoading(false));
    }
  }, [currentLedger]);

  // Update end date when start date or time span changes
  useEffect(() => {
    if (formData.startDate && formData.timeSpan) {
      const endDate = calculateEndDate(formData.startDate, formData.timeSpan);
      setFormData(prev => ({ ...prev, endDate }));
    }
  }, [formData.startDate, formData.timeSpan]);

  if (loading) {
    return <div className="p-6">Loading budgets...</div>;
  }

  if (!currentLedger) {
    return <div className="p-6">Please select a ledger to view budgets.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Budget Management</h1>
        {canEdit() && (
          <Button
            onClick={() => setShowAddForm(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Create Budget</span>
          </Button>
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

      {/* Add/Edit Budget Form */}
      {(showAddForm || editingBudget) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingBudget ? 'Edit Budget' : 'Create New Budget'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Budget Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Monthly Budget - June 2025"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="timeSpan">Time Span</Label>
                  <Select value={formData.timeSpan} onValueChange={(value) => setFormData({ ...formData, timeSpan: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    disabled={formData.timeSpan !== 'custom'}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="totalAmount">Total Budget Amount</Label>
                  <Input
                    id="totalAmount"
                    type="number"
                    step="0.01"
                    value={formData.totalAmount}
                    onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Category Budget Allocation */}
              <div>
                <Label>Category Budget Allocation</Label>
                <div className="mt-2 space-y-2">
                  {categories.filter(cat => cat.type === 'expense').map((category) => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <Label className="w-32 text-sm">{category.name}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.categories[category.id] || ''}
                        onChange={(e) => updateCategoryBudget(category.id, e.target.value)}
                        placeholder="0.00"
                        className="w-32"
                      />
                    </div>
                  ))}
                  <div className="flex items-center space-x-2 pt-2 border-t">
                    <Label className="w-32 text-sm font-medium">Remaining:</Label>
                    <span className={`text-sm font-medium ${
                      calculateRemainingBudget() < 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      ${calculateRemainingBudget().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button type="submit">
                  {editingBudget ? 'Update Budget' : 'Create Budget'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingBudget(null);
                    setFormData({
                      name: '',
                      startDate: new Date().toISOString().split('T')[0],
                      endDate: '',
                      totalAmount: '',
                      timeSpan: 'monthly',
                      categories: {}
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

      {/* Budgets List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {budgets.length === 0 ? (
          <Card className="lg:col-span-2">
            <CardContent className="text-center py-8">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No budgets created yet</h3>
              <p className="text-gray-500 mb-4">
                Create your first budget to start tracking your spending goals.
              </p>
              {canEdit() && (
                <Button onClick={() => setShowAddForm(true)}>
                  Create Your First Budget
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          budgets.map((budget) => {
            const spending = calculateBudgetSpending(budget);
            const spentPercentage = (spending.totalSpent / budget.totalAmount) * 100;
            const isOverBudget = spending.totalSpent > budget.totalAmount;
            const daysRemaining = Math.ceil((budget.endDate - new Date()) / (1000 * 60 * 60 * 24));

            return (
              <Card key={budget.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{budget.name}</CardTitle>
                      <CardDescription>
                        {budget.startDate.toLocaleDateString()} - {budget.endDate.toLocaleDateString()}
                      </CardDescription>
                    </div>
                    {canEdit() && (
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingBudget(budget);
                            setFormData({
                              name: budget.name,
                              startDate: budget.startDate.toISOString().split('T')[0],
                              endDate: budget.endDate.toISOString().split('T')[0],
                              totalAmount: budget.totalAmount.toString(),
                              timeSpan: budget.timeSpan || 'custom',
                              categories: budget.categories || {}
                            });
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(budget.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Budget Overview */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Budget Progress</span>
                      <Badge variant={isOverBudget ? "destructive" : spentPercentage > 80 ? "secondary" : "default"}>
                        {spentPercentage.toFixed(1)}%
                      </Badge>
                    </div>
                    <Progress value={Math.min(spentPercentage, 100)} className="h-2" />
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>${spending.totalSpent.toFixed(2)} spent</span>
                      <span>${budget.totalAmount.toFixed(2)} budget</span>
                    </div>
                  </div>

                  {/* Budget Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-lg font-semibold text-gray-900">
                        ${(budget.totalAmount - spending.totalSpent).toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600">Remaining</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-lg font-semibold text-gray-900">
                        {daysRemaining > 0 ? daysRemaining : 0}
                      </div>
                      <div className="text-sm text-gray-600">Days Left</div>
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  {budget.categories && Object.keys(budget.categories).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Category Breakdown</h4>
                      <div className="space-y-2">
                        {Object.entries(budget.categories).map(([categoryId, budgetAmount]) => {
                          const category = categories.find(cat => cat.id === categoryId);
                          const spent = spending.categorySpending[categoryId] || 0;
                          const categoryPercentage = (spent / budgetAmount) * 100;

                          if (!category) return null;

                          return (
                            <div key={categoryId} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>{category.name}</span>
                                <span>${spent.toFixed(2)} / ${budgetAmount.toFixed(2)}</span>
                              </div>
                              <Progress value={Math.min(categoryPercentage, 100)} className="h-1" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Transaction Count */}
                  <div className="text-sm text-gray-600">
                    {spending.transactionCount} transactions in this period
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

