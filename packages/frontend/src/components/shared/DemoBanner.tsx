export const DemoBanner = () => {
  return (
    <div className="border-yellow-200 border-b bg-yellow-50 px-4 py-3 dark:border-yellow-800 dark:bg-yellow-900/20">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-label="Warning icon"
            role="presentation"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <span className="font-semibold">Demo Account:</span> Your data will be deleted after 24
            hours of inactivity.
          </p>
        </div>
      </div>
    </div>
  );
};
