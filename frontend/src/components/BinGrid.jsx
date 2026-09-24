import { format } from 'date-fns';

function getBarColor(fillLevel) {
  if (fillLevel > 85) return 'bg-red-500';
  if (fillLevel >= 50) return 'bg-yellow-400';
  return 'bg-green-500';
}

function formatTimestamp(ts) {
  if (!ts) return 'N/A';
  const date = new Date(Number(ts));
  if (Number.isNaN(date.getTime())) return 'N/A';
  return format(date, 'PPpp');
}

export default function BinGrid({ bins }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Bin Status</h2>

      {bins.length === 0 ? (
        <p className="text-sm text-slate-500">No bin readings available yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {bins.map((bin) => {
            const fill = Math.max(0, Math.min(100, Number(bin.fill_level) || 0));
            const colorClass = getBarColor(fill);

            return (
              <article
                key={bin.bin_id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div>
                  <h3 className="text-md font-semibold text-slate-800">{bin.bin_id}</h3>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{fill.toFixed(1)}%</p>
                  <p className="mt-1 text-xs text-slate-500">Updated: {formatTimestamp(bin.timestamp)}</p>
                </div>

                <div className="flex h-28 w-6 items-end rounded-full bg-slate-200 p-1">
                  <div
                    className={`w-full rounded-full ${colorClass} transition-all duration-300`}
                    style={{ height: `${fill}%` }}
                    aria-label={`Fill level ${fill.toFixed(1)} percent`}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
