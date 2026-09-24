import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { apiClient, SOCKET_BASE_URL } from '../api/client';
import AlertBanner from '../components/AlertBanner';
import BinGrid from '../components/BinGrid';
import TrendChart from '../components/TrendChart';
import WasteStatsChart from '../components/WasteStatsChart';
import useWasteSocket from '../hooks/useWasteSocket';

async function fetchBins() {
  const { data } = await apiClient.get('/api/analytics/bins');
  return data?.data || [];
}

export default function Dashboard() {
  const username = localStorage.getItem('username') || 'Operator';
  const { binUpdates, alerts } = useWasteSocket(SOCKET_BASE_URL);

  const {
    data: binsResponse,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['bins-latest'],
    queryFn: fetchBins,
    refetchInterval: 30000,
  });

  const bins = useMemo(() => {
    const map = new Map((binsResponse || []).map((bin) => [bin.bin_id, { ...bin }]));

    for (const event of binUpdates) {
      if (typeof event.fill_level !== 'number' || Number.isNaN(event.fill_level)) continue;
      const current = map.get(event.bin_id);
      if (!current || Number(event.timestamp) >= Number(current.timestamp || 0)) {
        map.set(event.bin_id, {
          bin_id: event.bin_id,
          fill_level: event.fill_level,
          timestamp: event.timestamp,
        });
      }
    }

    return [...map.values()].sort((a, b) => a.bin_id.localeCompare(b.bin_id));
  }, [binsResponse, binUpdates]);

  const derivedAlerts = useMemo(() => {
    const thresholdAlerts = bins
      .filter((bin) => Number(bin.fill_level) > 85)
      .map((bin) => ({
        bin_id: bin.bin_id,
        fill_level: Number(bin.fill_level),
        timestamp: Number(bin.timestamp),
        message: `Bin ${bin.bin_id} is almost full`,
      }));

    return [...alerts, ...thresholdAlerts].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  }, [alerts, bins]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-slate-900">Wastios Smart Waste Dashboard</h1>
          <div className="text-sm text-slate-600">
            Logged in as <span className="font-semibold text-slate-800">{username}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-6">
        <AlertBanner alerts={derivedAlerts} />

        {isLoading && <p className="text-sm text-slate-500">Loading dashboard...</p>}
        {isError && <p className="text-sm text-red-600">Failed to load bin data.</p>}

        <BinGrid bins={bins} />

        <div className="grid gap-5 lg:grid-cols-2">
          <WasteStatsChart />
          <TrendChart bins={bins} />
        </div>
      </main>
    </div>
  );
}
