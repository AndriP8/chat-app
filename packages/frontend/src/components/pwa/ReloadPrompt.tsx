import { useRegisterSW } from 'virtual:pwa-register/react';

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('[PWA] Service worker registration failed:', error);
    },
  });

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 max-w-sm rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <svg
            className="h-6 w-6 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            role="img"
            aria-label="Reload Icon"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-sm">New version available!</h3>
          <p className="mt-1 text-gray-600 text-sm">
            Click "Update" to get the latest features and improvements.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => updateServiceWorker(true)}
              className="rounded bg-blue-500 px-3 py-1.5 font-medium text-sm text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Update
            </button>
            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
