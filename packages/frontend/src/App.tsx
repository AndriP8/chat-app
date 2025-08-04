import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Chat App
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Real-time chat application built with React, Vite, and Tailwind CSS v4
          </p>
        </header>

        <main className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
                Welcome to the Chat App
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                This is a starter template with React + Vite + TypeScript + Tailwind CSS v4
              </p>
              
              <div className="flex items-center justify-center gap-4 mb-6">
                 <button
                   type="button"
                   onClick={() => setCount((count) => count + 1)}
                   className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                 >
                   Count is {count}
                 </button>
                 <button
                   type="button"
                   onClick={() => setCount(0)}
                   className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                 >
                   Reset
                 </button>
               </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-4">
                Tech Stack
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-800 dark:text-white">Frontend</h4>
                  <ul className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                    <li>• React 19</li>
                    <li>• TypeScript</li>
                    <li>• Vite</li>
                    <li>• Tailwind CSS v4</li>
                  </ul>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-800 dark:text-white">Tools</h4>
                  <ul className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                    <li>• pnpm workspace</li>
                    <li>• Biome (linting)</li>
                    <li>• Hot Module Reload</li>
                    <li>• Dark mode support</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
