// src/pages/Login.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, User, onAuthStateChanged } from 'firebase/auth';
import { registerUser } from '../Auth/registerUser';
import { auth } from '../Auth/firebaseConfig';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is already logged in, redirect to main page
        navigate('/');
      }
    });
    
    return () => unsubscribe();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user: User = result.user;

      await registerUser({
        uid: user.uid,
        name: user.displayName || 'No Name',
        email: user.email || 'No Email',
        photoURL: user.photoURL || '',
      });
      
      // Redirect to main page after successful login
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side */}
      <div className="w-1/2 bg-yellow-50 flex flex-col justify-center items-start px-16">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">Your smart assistant for effortless scheduling</h1>
        <p className="text-lg text-gray-700 mb-8">
          Looma organizes your calendar automatically, helping you stay on top of tasks, appointments, and more.
        </p>
        <button 
          onClick={handleGoogleSignIn} 
          className="bg-blue-900 text-white py-2 px-4 rounded font-semibold"
        >
          Get Started
        </button>
      </div>

      {/* Right side */}
      <div className="w-1/2 bg-white flex flex-col justify-center items-center px-16">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Login to your account</h2>
          <p className="text-gray-600 mb-6">
            You've installed Looma. Now, sign in to manage your schedule <span className="font-semibold">seamlessly</span>.
          </p>

          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded mb-4"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded mb-4"
          />

          <div className="flex justify-between items-center mb-4">
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span className="text-sm">Remember this device</span>
            </label>
            <a href="#" className="text-sm text-blue-600 hover:underline">Forgot your password?</a>
          </div>

          <button 
            className="w-full bg-blue-700 text-white py-2 rounded font-semibold mb-4"
            disabled={loading}
          >
            Sign In
          </button>

          <p className="text-center text-sm mb-4">
            Don't have an account? <a href="#" className="text-blue-600 font-medium hover:underline">Create one</a>
          </p>

          <div className="space-y-2">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full border border-gray-300 rounded py-2 flex items-center justify-center hover:bg-gray-50"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google logo" className="w-5 h-5 mr-2" />
              {loading ? 'Signing in...' : 'Continue with Google'}
            </button>
            <button className="w-full border border-gray-300 rounded py-2 flex items-center justify-center hover:bg-gray-50">
              <img src="https://www.svgrepo.com/show/475654/microsoft.svg" alt="Microsoft logo" className="w-5 h-5 mr-2" />
              Continue with Microsoft
            </button>
          </div>

          {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default Login;