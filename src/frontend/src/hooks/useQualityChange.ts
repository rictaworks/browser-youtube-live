import { useEffect, useState } from 'react';

export type QualityChangeEvent = {
  type: 'quality_change';
  action: 'upgrade' | 'downgrade';
  new_bitrate: number;
  new_resolution: string;
};

export function useQualityChange(ws: WebSocket | null): QualityChangeEvent | null {
  const [event, setEvent] = useState<QualityChangeEvent | null>(null);

  useEffect(() => {
    if (!ws) {
      setEvent(null);
      return;
    }

    const handler = (e: MessageEvent) => {
      if (typeof e.data !== 'string') return;
      try {
        const data = JSON.parse(e.data);
        if (data.type !== 'quality_change') return;
        setEvent({
          type: 'quality_change',
          action: data.action,
          new_bitrate: data.new_bitrate,
          new_resolution: data.new_resolution,
        });
      } catch {
        // ignore malformed messages
      }
    };

    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [ws]);

  return event;
}
