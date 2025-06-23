import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Tag,
  Save,
  X
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLedger } from '../contexts/LedgerContext';
import twemoji from 'twemoji';

// Default categories with emojis
const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', emoji: '🍽️', type: 'expense' },
  { name: 'Transportation', emoji: '🚗', type: 'expense' },
  { name: 'Shopping', emoji: '🛍️', type: 'expense' },
  { name: 'Entertainment', emoji: '🎬', type: 'expense' },
  { name: 'Bills & Utilities', emoji: '💡', type: 'expense' },
  { name: 'Healthcare', emoji: '🏥', type: 'expense' },
  { name: 'Education', emoji: '📚', type: 'expense' },
  { name: 'Travel', emoji: '✈️', type: 'expense' },
  { name: 'Fitness', emoji: '💪', type: 'expense' },
  { name: 'Personal Care', emoji: '💄', type: 'expense' }
];

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', emoji: '💰', type: 'income' },
  { name: 'Freelance', emoji: '💻', type: 'income' },
  { name: 'Investment', emoji: '📈', type: 'income' },
  { name: 'Business', emoji: '🏢', type: 'income' },
  { name: 'Rental', emoji: '🏠', type: 'income' },
  { name: 'Gift', emoji: '🎁', type: 'income' }
];

// Popular emojis for categories
const POPULAR_EMOJIS = [
  '🍽️', '🚗', '🛍️', '🎬', '💡', '🏥', '📚', '✈️', '💪', '💄',
  '💰', '💻', '📈', '🏢', '🏠', '🎁', '☕', '🍕', '🎵', '🎮',
  '📱', '👕', '⛽', '🚌', '🚇', '🏪', '🍺', '🎪', '🎨', '📖',
  '💊', '🏋️', '🧘', '🎯', '🎲', '🎸', '📺', '🎤', '🎭', '🎪'
];

export default function CategoryManagement() {
  const { currentUser } = useAuth();
  const { currentLedger, canEdit } = useLedger();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    emoji: '📝',
    type: 'expense'
  });

  // Fetch categories
  const fetchCategories = async () => {
    if (!currentLedger) return;

    try {
      const categoriesRef = collection(db, 'ledgers', currentLedger.id, 'categories');
      const q = query(categoriesRef, orderBy('type'), orderBy('name'));
      const querySnapshot = await getDocs(q);
      
      const categoryList = [];
      querySnapshot.forEach((doc) => {
        categoryList.push({
          id: doc.id,
          ...doc.data()
        });
      });

      setCategories(categoryList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError('Failed to fetch categories');
      setLoading(false);
    }
  };

  // Create default categories if none exist
  const createDefaultCategories = async () => {
    if (!currentLedger || !canEdit) return;

    try {
      const categoriesRef = collection(db, 'ledgers', currentLedger.id, 'categories');
      
      // Add default expense categories
      for (const category of DEFAULT_EXPENSE_CATEGORIES) {
        await addDoc(categoriesRef, {
          ...category,
          createdAt: new Date(),
          createdBy: currentUser.uid
        });
      }

      // Add default income categories
      for (const category of DEFAULT_INCOME_CATEGORIES) {
        await addDoc(categoriesRef, {
          ...category,
          createdAt: new Date(),
          createdBy: currentUser.uid
        });
      }

      await fetchCategories();
      setSuccess('Default categories created successfully!');
    } catch (error) {
      console.error('Error creating default categories:', error);
      setError('Failed to create default categories');
    }
  };

  // Add new category
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!currentLedger || !canEdit) return;

    try {
      const categoriesRef = collection(db, 'ledgers', currentLedger.id, 'categories');
      await addDoc(categoriesRef, {
        ...formData,
        createdAt: new Date(),
        createdBy: currentUser.uid
      });

      setFormData({ name: '', emoji: '📝', type: 'expense' });
      setShowAddForm(false);
      await fetchCategories();
      setSuccess('Category added successfully!');
    } catch (error) {
      console.error('Error adding category:', error);
      setError('Failed to add category');
    }
  };

  // Update category
  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    if (!editingCategory || !canEdit) return;

    try {
      const categoryRef = doc(db, 'ledgers', currentLedger.id, 'categories', editingCategory.id);
      await updateDoc(categoryRef, {
        name: formData.name,
        emoji: formData.emoji,
        type: formData.type,
        updatedAt: new Date(),
        updatedBy: currentUser.uid
      });

      setEditingCategory(null);
      setFormData({ name: '', emoji: '📝', type: 'expense' });
      await fetchCategories();
      setSuccess('Category updated successfully!');
    } catch (error) {
      console.error('Error updating category:', error);
      setError('Failed to update category');
    }
  };

  // Delete category
  const handleDeleteCategory = async (categoryId) => {
    if (!canEdit || !confirm('Are you sure you want to delete this category?')) return;

    try {
      const categoryRef = doc(db, 'ledgers', currentLedger.id, 'categories', categoryId);
      await deleteDoc(categoryRef);
      await fetchCategories();
      setSuccess('Category deleted successfully!');
    } catch (error) {
      console.error('Error deleting category:', error);
      setError('Failed to delete category');
    }
  };

  // Start editing category
  const startEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      emoji: category.emoji,
      type: category.type
    });
    setShowAddForm(false);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingCategory(null);
    setFormData({ name: '', emoji: '📝', type: 'expense' });
  };

  // Render emoji with twemoji
  const renderEmoji = (emoji) => {
    return (
      <span 
        dangerouslySetInnerHTML={{
          __html: twemoji.parse(emoji, {
            folder: 'svg',
            ext: '.svg'
          })
        }}
        style={{ width: '20px', height: '20px', display: 'inline-block' }}
      />
    );
  };

  useEffect(() => {
    fetchCategories();
  }, [currentLedger]);

  useEffect(() => {
    // Clear messages after 3 seconds
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const expenseCategories = categories.filter(cat => cat.type === 'expense');
  const incomeCategories = categories.filter(cat => cat.type === 'income');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Category Management</h1>
        {canEdit && (
          <Button onClick={() => setShowAddForm(true)} className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Add Category</span>
          </Button>
        )}
      </div>

      {/* Messages */}
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

      {/* Add/Edit Form */}
      {(showAddForm || editingCategory) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingCategory ? 'Edit Category' : 'Add New Category'}</CardTitle>
            <CardDescription>
              {editingCategory ? 'Update category details' : 'Create a new category with emoji'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={editingCategory ? handleUpdateCategory : handleAddCategory} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="name">Category Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter category name"
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
                  <Label htmlFor="emoji">Emoji</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="emoji"
                      value={formData.emoji}
                      onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                      placeholder="📝"
                      className="w-20"
                    />
                    <div className="flex items-center space-x-1">
                      {renderEmoji(formData.emoji)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Popular Emojis */}
              <div>
                <Label>Popular Emojis</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {POPULAR_EMOJIS.map((emoji, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setFormData({ ...formData, emoji })}
                      className="p-2 border rounded hover:bg-gray-100 transition-colors"
                    >
                      {renderEmoji(emoji)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2">
                <Button type="submit" className="flex items-center space-x-2">
                  <Save className="h-4 w-4" />
                  <span>{editingCategory ? 'Update' : 'Add'} Category</span>
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowAddForm(false);
                    cancelEdit();
                  }}
                  className="flex items-center space-x-2"
                >
                  <X className="h-4 w-4" />
                  <span>Cancel</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Categories Display */}
      {categories.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Tag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Categories Found</h3>
            <p className="text-gray-600 mb-4">Create categories to organize your transactions</p>
            {canEdit && (
              <Button onClick={createDefaultCategories} className="flex items-center space-x-2 mx-auto">
                <Plus className="h-4 w-4" />
                <span>Create Default Categories</span>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Expense Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>💸</span>
                <span>Expense Categories</span>
                <Badge variant="secondary">{expenseCategories.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expenseCategories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {renderEmoji(category.emoji)}
                      <span className="font-medium">{category.name}</span>
                    </div>
                    {canEdit && (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(category)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCategory(category.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Income Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>💰</span>
                <span>Income Categories</span>
                <Badge variant="secondary">{incomeCategories.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {incomeCategories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {renderEmoji(category.emoji)}
                      <span className="font-medium">{category.name}</span>
                    </div>
                    {canEdit && (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(category)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCategory(category.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

