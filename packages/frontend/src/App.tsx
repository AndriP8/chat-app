import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthContext";
import { AuthPage } from "@/components/auth/AuthPage";
import ChatPage from "./components/chat/ChatPage";
import { AuthGuard } from "./components/auth/AuthGuard";
import { Navigation } from "./components/navigation/Navigation";

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Default redirect to chat */}
            <Route path="/" element={<Navigate to="/chat" replace />} />

            {/* Auth Routes */}
            <Route path="/login" element={<AuthPage initialMode="login" />} />
            <Route
              path="/register"
              element={<AuthPage initialMode="register" />}
            />
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
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
