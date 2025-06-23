import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { 
  Mail, 
  Check, 
  X,
  Clock,
  BookOpen,
  User
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLedger } from '../contexts/LedgerContext';

export default function InvitationManager() {
  const { currentUser } = useAuth();
  const { refreshLedgers } = useLedger();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch pending invitations for current user
  const fetchInvitations = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const invitationsRef = collection(db, 'invitations');
      const q = query(
        invitationsRef, 
        where('inviteeEmail', '==', currentUser.email.toLowerCase()),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const invitationList = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Check if invitation hasn't expired
        const expiresAt = data.expiresAt?.toDate();
        if (!expiresAt || expiresAt > new Date()) {
          invitationList.push({
            id: doc.id,
            ...data
          });
        }
      });

      setInvitations(invitationList);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      setError('Failed to fetch invitations');
    } finally {
      setLoading(false);
    }
  };

  // Accept invitation
  const acceptInvitation = async (invitation) => {
    try {
      setLoading(true);
      setError('');

      // Get the ledger document
      const ledgerRef = doc(db, 'ledgers', invitation.ledgerId);
      const ledgerDoc = await getDocs(query(collection(db, 'ledgers'), where('__name__', '==', invitation.ledgerId)));
      
      if (ledgerDoc.empty) {
        throw new Error('Ledger not found');
      }

      const ledgerData = ledgerDoc.docs[0].data();
      const updatedMembers = {
        ...ledgerData.members,
        [currentUser.uid]: invitation.role
      };

      // Update ledger with new member
      await updateDoc(ledgerRef, {
        members: updatedMembers,
        updatedAt: new Date()
      });

      // Update invitation status
      await updateDoc(doc(db, 'invitations', invitation.id), {
        status: 'accepted',
        acceptedAt: new Date()
      });

      await refreshLedgers();
      await fetchInvitations();
      setSuccess(`Successfully joined "${invitation.ledgerName}"!`);
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setError('Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  };

  // Decline invitation
  const declineInvitation = async (invitationId) => {
    try {
      setLoading(true);
      setError('');

      // Update invitation status
      await updateDoc(doc(db, 'invitations', invitationId), {
        status: 'declined',
        declinedAt: new Date()
      });

      await fetchInvitations();
      setSuccess('Invitation declined');
    } catch (error) {
      console.error('Error declining invitation:', error);
      setError('Failed to decline invitation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
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

  if (invitations.length === 0 && !loading) {
    return null; // Don't show anything if no invitations
  }

  return (
    <div className="mb-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="h-5 w-5 mr-2" />
            Pending Invitations ({invitations.length})
          </CardTitle>
          <CardDescription>
            You have been invited to join the following ledgers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-lg">{invitation.ledgerName}</h3>
                      <Badge variant="secondary">{invitation.role}</Badge>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>Invited by: {invitation.inviterName}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>
                          Invited: {new Date(invitation.createdAt.toDate()).toLocaleDateString()}
                        </span>
                      </div>
                      {invitation.expiresAt && (
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4" />
                          <span>
                            Expires: {new Date(invitation.expiresAt.toDate()).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-2 ml-4">
                    <Button
                      size="sm"
                      onClick={() => acceptInvitation(invitation)}
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => declineInvitation(invitation.id)}
                      disabled={loading}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

