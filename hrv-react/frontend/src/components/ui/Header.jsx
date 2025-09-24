import React from 'react';

const Header = ({ user, handleLogout, handleViewReport, toggleDarkMode, darkMode }) => {
  return (
    <header className={`p-4 shadow-md ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold">HRV Monitor</h1>
        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-2">
              <span className={`hidden sm:inline text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Hello, {user.name || user.email || 'User'}!
              </span>
              {user.id !== 'guest' && (
                <>
                  <button
                    onClick={handleViewReport}
                    className={`text-xs px-3 py-1.5 rounded font-semibold ${darkMode ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'} transition-colors`}
                  >
                    View Report
                  </button>
                  <button
                    onClick={handleLogout}
                    className={`text-xs px-3 py-1.5 rounded ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} transition-colors`}
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          )}
          <button onClick={toggleDarkMode} className={`p-2 rounded-full transition-colors duration-300 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-200'}`}>
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;