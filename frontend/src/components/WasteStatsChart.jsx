import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { apiClient } from '../api/client';

const COLORS = ['#3B82F6', '#F59E0B', '#10B981'];

async function fetchWasteStats() {
  const { data } = await apiClient.get('/api/analytics/waste-stats');
  return data?.data || { total: 0, breakdown: [] };
}

export default function WasteStatsChart() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['waste-stats'],
    queryFn: fetchWasteStats,
    refetchInterval: 15000,
  });

  const chartData = useMemo(
    () =>
      (data?.breakdown || []).map((item) => ({
        name: item.label,
        value: item.count,
        percentage: item.percentage,
      })),
    [data]
  );

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Waste Composition</h2>

      {isLoading && <p className="text-sm text-slate-500">Loading waste stats...</p>}
      {isError && <p className="text-sm text-red-600">Failed to load waste statistics.</p>}

      {!isLoading && !isError && (
        <>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={100} label>
                  {chartData.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name, payload) => [`${value} (${payload?.payload?.percentage}%)`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {chartData.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="capitalize">
                  {item.name}: {item.value} ({item.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
