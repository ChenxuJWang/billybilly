import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { User, Palette, Save, RefreshCw } from 'lucide-react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { PROFILE_COLORS, getRandomColor, isValidColor } from '../utils/profileImage';
import ProfileImage from './ProfileImage';

export default function ProfileSettings() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    displayName: '',
    profileColor: ''
  });
  
  // Preview user object for ProfileImage component
  const previewUser = {
    ...currentUser,
    displayName: formData.displayName,
    profileColor: formData.profileColor
  };

  // Load current user profile data
  const loadProfileData = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      
      // Get user document from Firestore
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      
      setFormData({
        displayName: currentUser.displayName || userData.displayName || '',
        profileColor: userData.profileColor || ''
      });
    } catch (error) {
      console.error('Error loading profile data:', error);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  // Save profile changes
  const saveProfile = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      setError('');

      // Validate display name
      if (!formData.displayName.trim()) {
        setError('Display name is required');
        return;
      }

      // Validate color if provided
      if (formData.profileColor && !isValidColor(formData.profileColor)) {
        setError('Invalid color selected');
        return;
      }

      // Update Firebase Auth profile
      await updateProfile(currentUser, {
        displayName: formData.displayName.trim()
      });

      // Update Firestore user document
      await updateDoc(doc(db, 'users', currentUser.uid), {
        displayName: formData.displayName.trim(),
        profileColor: formData.profileColor || null,
        updatedAt: new Date()
      });

      setSuccess('Profile updated successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      setError('Failed to save profile changes');
    } finally {
      setLoading(false);
    }
  };

  // Generate random color
  const generateRandomColor = () => {
    const randomColor = getRandomColor();
    setFormData(prev => ({ ...prev, profileColor: randomColor }));
  };

  // Reset to default color (based on user ID)
  const resetToDefaultColor = () => {
    setFormData(prev => ({ ...prev, profileColor: '' }));
  };

  useEffect(() => {
    loadProfileData();
  }, [currentUser]);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <User className="h-5 w-5 mr-2" />
          Profile Settings
        </CardTitle>
        <CardDescription>
          Manage your display name and profile image appearance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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

        {/* Profile Preview */}
        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
          <ProfileImage user={previewUser} size="xl" />
          <div>
            <h3 className="font-medium text-lg">Profile Preview</h3>
            <p className="text-sm text-gray-600">
              This is how your profile will appear to other users
            </p>
          </div>
        </div>

        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={formData.displayName}
            onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
            placeholder="Enter your display name"
            disabled={loading}
          />
          <p className="text-xs text-gray-500">
            This name will be visible to other users in shared ledgers
          </p>
        </div>

        {/* Profile Color */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Profile Color</Label>
            <div className="flex space-x-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={generateRandomColor}
                disabled={loading}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Random
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={resetToDefaultColor}
                disabled={loading}
              >
                Default
              </Button>
            </div>
          </div>

          {/* Color Palette */}
          <div className="grid grid-cols-10 gap-2">
            {PROFILE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`
                  w-8 h-8 rounded-full border-2 transition-all
                  ${formData.profileColor === color 
                    ? 'border-gray-900 scale-110' 
                    : 'border-gray-300 hover:border-gray-500'
                  }
                `}
                style={{ backgroundColor: color }}
                onClick={() => setFormData(prev => ({ ...prev, profileColor: color }))}
                disabled={loading}
                title={color}
              />
            ))}
          </div>
          
          <p className="text-xs text-gray-500">
            Choose a color for your profile image background, or leave default for auto-generated color
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={saveProfile}
            disabled={loading || !formData.displayName.trim()}
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

