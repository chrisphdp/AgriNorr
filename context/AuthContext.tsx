import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db } from '../utils/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

export type UserRole = 'administrator' | 'operator' | 'researcher' | 'guest';

export interface UserProfile {
  uid: string;
  email: string | null;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  employeeId?: string;
}

interface AuthContextType {
  currentUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: () => void;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          
          unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
              setProfile(docSnap.data() as UserProfile);
            } else {
              // Create local default profile without overwriting database
              // (Register.tsx might be creating it concurrently)
              setProfile({
                uid: user.uid,
                email: user.email,
                role: 'researcher' 
              });
            }
            setLoading(false);
          }, (error) => {
            console.error("Error fetching user profile:", error);
            if (error.code === 'permission-denied') {
                alert("Firebase Error: Permission Denied. Your Firestore rules are blocking access or your Test Mode has expired. Please update your rules in the Firebase Console to allow read/write.");
            }
            setProfile(null);
            setLoading(false);
          });
          
        } catch (error) {
          console.error("Error setting up profile listener:", error);
          setProfile(null);
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
        if (unsubscribeSnapshot) {
           unsubscribeSnapshot();
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
         unsubscribeSnapshot();
      }
    };
  }, []);

  const logout = () => {
    return signOut(auth);
  };

  const updateRole = async (role: UserRole) => {
    if (!currentUser) return;
    try {
      const docRef = doc(db, 'users', currentUser.uid);
      await setDoc(docRef, { role }, { merge: true });
      setProfile(prev => prev ? { ...prev, role } : null);
    } catch (error) {
      console.error("Error updating role:", error);
      throw error;
    }
  };

  const value = {
    currentUser,
    profile,
    loading,
    logout,
    updateRole
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};