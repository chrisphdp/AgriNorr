import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { doc, getDocs, collection, query, where, setDoc } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import { Sprout, AlertCircle, Loader2, Users, HardHat, Compass } from 'lucide-react';
import { UserRole } from '../context/AuthContext';

export const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const navigate = useNavigate();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setMessage('');
      setLoading(true);
      
      let targetEmail = identifier.trim();
      
      if (!targetEmail.includes('@')) {
        const q = query(collection(db, 'users'), where('employeeId', '==', targetEmail));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            targetEmail = querySnapshot.docs[0].data().email;
        } else {
            setError('Could not find an account with that ID.');
            setLoading(false);
            return;
        }
      }
      
      await sendPasswordResetEmail(auth, targetEmail);
      setMessage('Password reset email sent. Please check your inbox.');
      setIsResetMode(false);
    } catch (err: any) {
      console.error(err);
      setError('Failed to send reset email. Verify your ID/Email.');
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isResetMode) {
      return handleResetPassword(e);
    }
    try {
      setError('');
      setMessage('');
      setLoading(true);
      
      let loginEmail = identifier.trim();
      
      // Try to find if the user entered an Employee ID
      if (!loginEmail.includes('@')) {
        const q = query(collection(db, 'users'), where('employeeId', '==', loginEmail));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            loginEmail = querySnapshot.docs[0].data().email;
        }
      }
      
      await signInWithEmailAndPassword(auth, loginEmail, password);
      
      navigate('/dashboard', { state: { justLoggedIn: true } });
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        setError('Incorrect ID/Email or password.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else if (err.code === 'permission-denied') {
         // Fallback if firestore rules block us
         setError('Failed to resolve Employee ID. Please use your Email address to login.');
      } else {
        setError('Failed to log in. Please try again.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
            <div className="rounded-2xl overflow-hidden flex items-center justify-center shadow-sm">
                <img src="https://i.postimg.cc/JnrfmVP4/Chat-GPT-Image-May-12-2026-05-00-44-PM.png" alt="AgriNorr Logo" className="w-24 h-24 object-contain" />
            </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to AgriNorr
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Manage your fields and environmental data
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center gap-2 text-sm">
                <AlertCircle size={16} />
                {error}
            </div>
          )}
          
          {message && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded flex items-center gap-2 text-sm">
                <AlertCircle size={16} />
                {message}
            </div>
          )}
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-700">
                Company ID / Email address
              </label>
              <div className="mt-1">
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            {!isResetMode && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 mb-6">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  />
                </div>
              </div>
            )}

            {!isResetMode && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <button 
                    type="button"
                    onClick={() => { setIsResetMode(true); setError(''); setMessage(''); }}
                    className="font-medium text-emerald-600 hover:text-emerald-500 bg-transparent border-none p-0 cursor-pointer"
                  >
                    Forgot your password?
                  </button>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : (isResetMode ? 'Reset Password' : 'Sign in')}
              </button>
            </div>
            
            {isResetMode && (
              <div className="mt-2 text-center text-sm">
                <button 
                  type="button"
                  onClick={() => setIsResetMode(false)}
                  className="font-medium text-gray-600 hover:text-gray-500 bg-transparent border-none p-0 cursor-pointer"
                >
                  Back to Sign in
                </button>
              </div>
            )}
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  New to AgriNorr?
                </span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                to="/register"
                className="w-full flex justify-center py-2 px-4 border border-emerald-800 rounded-md shadow-sm text-sm font-medium text-emerald-800 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};