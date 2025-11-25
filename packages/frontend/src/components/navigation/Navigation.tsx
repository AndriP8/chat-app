import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { DemoBanner } from '../shared/DemoBanner';

export function Navigation() {
  const location = useLocation();
  const { logout, currentUser } = useAuth();

  const navItems = [{ path: '/chat', label: 'Chat' }];

  return (
    <>
      {currentUser?.is_demo && <DemoBanner />}
      <nav className="sticky top-0 z-10 border-gray-200 border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex space-x-8">
                <div className="flex items-center">
                  <h1 className="font-semibold text-gray-900 text-xl">Chat App</h1>
                </div>
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center border-b-2 px-1 pt-1 font-medium text-sm ${
                      location.pathname === item.path
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
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
              className="inline-flex cursor-pointer items-center px-1 pt-1 font-medium text-gray-500 text-sm hover:border-gray-300 hover:text-gray-700"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
