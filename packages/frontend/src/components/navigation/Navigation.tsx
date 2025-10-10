import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Navigation() {
  const location = useLocation();
  const { logout } = useAuth();

  const navItems = [{ path: '/chat', label: 'Chat' }];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex space-x-8">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-gray-900">Chat App</h1>
              </div>
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    location.pathname === item.path
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <button
            onClick={logout}
            type="button"
            className="inline-flex cursor-pointer items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
