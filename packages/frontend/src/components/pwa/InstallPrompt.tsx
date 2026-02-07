import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function InstallPrompt() {
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedTime = localStorage.getItem(DISMISS_KEY);
    if (dismissedTime) {
      const elapsed = Date.now() - Number.parseInt(dismissedTime, 10);
      if (elapsed < DISMISS_DURATION) {
        setDismissed(true);
      } else {
        localStorage.removeItem(DISMISS_KEY);
      }
    }
  }, []);

  // Don't show if already installed, not installable, or dismissed
  if (!isInstallable || isInstalled || dismissed) {
    return null;
  }

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (!accepted) {
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
  };

  return (
    <div className="slide-in-from-bottom fixed right-4 bottom-4 left-4 z-50 animate-in rounded-lg border border-gray-200 bg-white p-4 shadow-lg duration-300 md:right-4 md:left-auto md:w-96">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 cursor-pointer text-gray-400 transition-colors hover:text-gray-600"
        aria-label="Dismiss"
        type="button"
      >
        <X size={20} />
      </button>

      <div className="pr-6">
        <h3 className="mb-1 font-semibold text-gray-900">Install Chat App</h3>
        <p className="mb-3 text-gray-600 text-sm">
          Install our app for faster access and offline messaging
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            className="flex-1 cursor-pointer rounded-md bg-blue-500 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-600"
            type="button"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="cursor-pointer px-4 py-2 font-medium text-gray-600 transition-colors hover:text-gray-800"
            type="button"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
