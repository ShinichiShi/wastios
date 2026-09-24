import { useState } from 'react';

export default function AlertBanner({ alerts = [] }) {
  const [dismissedKeys, setDismissedKeys] = useState(() => new Set());

  const visibleAlert = alerts.find((alert, idx) => {
    const key = `${alert.bin_id}-${alert.timestamp || idx}`;
    return !dismissedKeys.has(key);
  });

  if (!visibleAlert) return null;

  const key = `${visibleAlert.bin_id}-${visibleAlert.timestamp || 0}`;

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-red-300 bg-red-100 px-4 py-3 text-red-800 shadow-sm">
      <div>
        <p className="font-semibold">⚠ Bin Alert</p>
        <p className="text-sm">{visibleAlert.message}</p>
      </div>
      <button
        type="button"
        className="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
        onClick={() => {
          setDismissedKeys((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
          });
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
