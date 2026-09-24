import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * React hook for wastios websocket events under /ws namespace.
 *
 * @param {string} serverUrl - Base backend URL, e.g. http://localhost:3000
 * @returns {{
 *  binUpdates: Array<{bin_id: string, fill_level: number, timestamp: number}>,
 *  alerts: Array<{bin_id: string, fill_level: number, message: string}>
 * }}
 */
export function useWasteSocket(serverUrl) {
  const [binUpdates, setBinUpdates] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const socketUrl = useMemo(() => `${serverUrl}/ws`, [serverUrl]);

  useEffect(() => {
    if (!serverUrl) return undefined;

    const socket = io(socketUrl, {
      transports: ['websocket'],
      withCredentials: true,
    });

    const onBinUpdate = (payload) => {
      setBinUpdates((prev) => [payload, ...prev].slice(0, 200));
    };

    const onClassificationUpdate = (payload) => {
      // Keep the latest classification event together with bin updates for UI timelines.
      const mapped = {
        bin_id: payload.bin_id,
        fill_level: Number.NaN,
        timestamp: payload.timestamp,
        label: payload.label,
        confidence: payload.confidence,
        type: 'classification',
      };
      setBinUpdates((prev) => [mapped, ...prev].slice(0, 200));
    };

    const onBinAlert = (payload) => {
      setAlerts((prev) => [payload, ...prev].slice(0, 100));
    };

    socket.on('bin_update', onBinUpdate);
    socket.on('classification_update', onClassificationUpdate);
    socket.on('bin_alert', onBinAlert);

    return () => {
      socket.off('bin_update', onBinUpdate);
      socket.off('classification_update', onClassificationUpdate);
      socket.off('bin_alert', onBinAlert);
      socket.disconnect();
    };
  }, [serverUrl, socketUrl]);

  return { binUpdates, alerts };
}

export default useWasteSocket;
