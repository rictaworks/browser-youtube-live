import { useEffect, useState } from 'react';

export type StreamStats = {
  bitrate_kbps: number | null;
  fps: number | null;
  dropped_frames: number | null;
  viewer_count: number | null;
  buffer_size_kb: number | null;
  elapsed_seconds: number;
  status: string;
};

export function useStreamStats(ws: WebSocket | null): StreamStats | null {
  const [stats, setStats] = useState<StreamStats | null>(null);

  useEffect(() => {
    if (!ws) {
      setStats(null);
      return;
    }

    const handler = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'quality_change') return; // quality events handled by useQualityChange
        setStats(data as StreamStats);
      } catch {
        // ignore malformed messages
      }
    };

    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [ws]);

  return stats;
}
