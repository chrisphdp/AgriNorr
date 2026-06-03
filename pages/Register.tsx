import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import { Sprout, AlertCircle, Loader2, Users, HardHat, Compass } from 'lucide-react';
import { UserRole } from '../context/AuthContext';

export const Register: React.FC = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    
    if (!employeeId.trim()) {
      return setError('Employee ID is required');
    }

    try {
      setError('');
      setLoading(true);

      // Check if Employee ID is already in use
      const q = query(collection(db, 'users'), where('employeeId', '==', employeeId.trim()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setLoading(false);
        return setError('This Company / Employee ID is already in use by another account. Please log in, or use a different ID.');
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Save the chosen role to Firestore
      const docRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(docRef, {
        uid: userCredential.user.uid,
        email: email,
        employeeId: employeeId.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: role
      });
      
      navigate('/dashboard', { state: { message: 'Account created! Welcome to AgriNorr.' } });
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Email is already in use.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError('Failed to create an account. Please try again.');
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
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Start monitoring your crops today
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
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <div className="mt-1">
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <div className="mt-1">
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700">
                Company / Employee ID
              </label>
              <div className="mt-1">
                <input
                  id="employeeId"
                  name="employeeId"
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <div className="mt-1 flex items-center mb-6">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Type
              </label>
              <div className="grid grid-cols-4 gap-3">
                <label className={`cursor-pointer overflow-hidden border rounded-lg p-3 text-center transition-all ${
                  role === 'administrator' 
                    ? 'border-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-500 text-emerald-900' 
                    : 'border-gray-200 bg-white hover:border-emerald-200 text-gray-700'
                }`}>
                  <input 
                    type="radio" 
                    name="role" 
                    value="administrator" 
                    className="sr-only" 
                    checked={role === 'administrator'}
                    onChange={() => setRole('administrator')}
                  />
                  <Users className={`mx-auto mb-1 ${role === 'administrator' ? 'text-emerald-600' : 'text-gray-400'}`} size={20} />
                  <span className="block text-xs font-bold w-full uppercase mt-1 tracking-wide truncate">Admin</span>
                </label>
                
                <label className={`cursor-pointer overflow-hidden border rounded-lg p-3 text-center transition-all ${
                  role === 'operator' 
                    ? 'border-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-500 text-emerald-900' 
                    : 'border-gray-200 bg-white hover:border-emerald-200 text-gray-700'
                }`}>
                  <input 
                    type="radio" 
                    name="role" 
                    value="operator" 
                    className="sr-only" 
                    checked={role === 'operator'}
                    onChange={() => setRole('operator')}
                  />
                  <HardHat className={`mx-auto mb-1 ${role === 'operator' ? 'text-emerald-600' : 'text-gray-400'}`} size={20} />
                  <span className="block text-xs font-bold w-full uppercase mt-1 tracking-wide truncate">Operator</span>
                </label>
                
                <label className={`cursor-pointer overflow-hidden border rounded-lg p-3 text-center transition-all ${
                  role === 'researcher' 
                    ? 'border-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-500 text-emerald-900' 
                    : 'border-gray-200 bg-white hover:border-emerald-200 text-gray-700'
                }`}>
                  <input 
                    type="radio" 
                    name="role" 
                    value="researcher" 
                    className="sr-only" 
                    checked={role === 'researcher'}
                    onChange={() => setRole('researcher')}
                  />
                  <Compass className={`mx-auto mb-1 ${role === 'researcher' ? 'text-emerald-600' : 'text-gray-400'}`} size={20} />
                  <span className="block text-xs font-bold w-full uppercase mt-1 tracking-wide truncate">Research</span>
                </label>

                <label className={`cursor-pointer overflow-hidden border rounded-lg p-3 text-center transition-all ${
                  role === 'guest' 
                    ? 'border-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-500 text-emerald-900' 
                    : 'border-gray-200 bg-white hover:border-emerald-200 text-gray-700'
                }`}>
                  <input 
                    type="radio" 
                    name="role" 
                    value="guest" 
                    className="sr-only" 
                    checked={role === 'guest'}
                    onChange={() => setRole('guest')}
                  />
                  <Users className={`mx-auto mb-1 ${role === 'guest' ? 'text-emerald-600' : 'text-gray-400'}`} size={20} />
                  <span className="block text-xs font-bold w-full uppercase mt-1 tracking-wide truncate">Guest</span>
                </label>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {role === 'administrator' && "Administrators have full access to edit and configure farm boundaries, equipment, and user settings."}
                {role === 'operator' && "Operators monitor tasks and field statistics with read-only access to most boundaries and fields."}
                {role === 'researcher' && "Researchers can only view permitted fields and cannot edit parameters."}
                {role === 'guest' && "Guests have restricted view-only access across the platform."}
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Create Account'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Already have an account?
                </span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                to="/login"
                className="w-full flex justify-center py-2 px-4 border border-emerald-800 rounded-md shadow-sm text-sm font-medium text-emerald-800 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};