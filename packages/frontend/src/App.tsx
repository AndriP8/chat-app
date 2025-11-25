import { Suspense } from 'react';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AuthProvider } from '@/components/auth/AuthContext';
import { AuthGuard } from './components/auth/AuthGuard';
import { Navigation } from './components/navigation/Navigation';

const LoadingSpinner = () => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50">
    <div className="flex items-center gap-2 text-gray-500">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
      <span>Loading...</span>
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="w-full">
          <Suspense fallback={<LoadingSpinner />}>
          <Routes>
              {/* Landing Page */}
              <Route path="/" element={<HomePage />} />

            {/* Auth Routes */}
            <Route path="/login" element={<AuthPage initialMode="login" />} />
            <Route path="/register" element={<AuthPage initialMode="register" />} />
            <Route path="/auth" element={<AuthPage />} />

            {/* Protected Routes */}
            <Route
              path="/chat"
              element={
                <AuthGuard>
                  <div className="min-h-screen bg-gray-50">
                    <Navigation />
                    <ChatPage />
                  </div>
                </AuthGuard>
              }
            />
          </Routes>
          </Suspense>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
