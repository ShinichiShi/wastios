import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { apiClient } from '../api/client';

async function fetchTrends(binId) {
  const { data } = await apiClient.get('/api/analytics/trends', {
    params: { bin_id: binId, days: 7 },
  });
  return data?.data || [];
}

export default function TrendChart({ bins }) {
  const [selectedBin, setSelectedBin] = useState(bins[0]?.bin_id || '');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['bin-trends', selectedBin],
    queryFn: () => fetchTrends(selectedBin),
    enabled: Boolean(selectedBin),
    refetchInterval: 30000,
  });

  const chartData = useMemo(
    () =>
      (data || []).map((item) => ({
        ...item,
        timeLabel: format(new Date(Number(item.timestamp)), 'MM/dd HH:mm'),
      })),
    [data]
  );

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Fill Trend (Last 7 Days)</h2>

        <select
          value={selectedBin}
          onChange={(e) => setSelectedBin(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          disabled={bins.length === 0}
        >
          {bins.length === 0 && <option value="">No bins available</option>}
          {bins.map((bin) => (
            <option key={bin.bin_id} value={bin.bin_id}>
              {bin.bin_id}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading trend data...</p>}
      {isError && <p className="text-sm text-red-600">Failed to load trend data.</p>}

      {!isLoading && !isError && selectedBin && (
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timeLabel" tick={{ fontSize: 12 }} minTickGap={24} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="fill_level"
                stroke="#2563EB"
                strokeWidth={3}
                dot={false}
                name="Fill %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
