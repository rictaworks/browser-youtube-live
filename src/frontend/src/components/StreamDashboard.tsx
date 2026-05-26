import type { StreamStats } from '@/hooks/useStreamStats';

type Props = {
  stats: StreamStats | null;
};

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export function StreamDashboard({ stats }: Props) {
  if (!stats) {
    return (
      <div className="rounded-lg bg-gray-100 p-4 text-sm text-gray-500 text-center">
        統計データ待機中...
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-gray-900 text-white p-4 grid grid-cols-2 gap-3 text-sm w-full">
      <div className="flex flex-col items-center bg-gray-800 rounded p-3">
        <span className="text-gray-400 text-xs mb-1">配信時間</span>
        <span className="font-mono text-lg font-semibold">
          {formatElapsed(stats.elapsed_seconds)}
        </span>
      </div>
      <div className="flex flex-col items-center bg-gray-800 rounded p-3">
        <span className="text-gray-400 text-xs mb-1">視聴者数</span>
        <span className="font-mono text-lg font-semibold">{stats.viewer_count ?? '-'}</span>
      </div>
      <div className="flex flex-col items-center bg-gray-800 rounded p-3">
        <span className="text-gray-400 text-xs mb-1">ビットレート</span>
        <span className="font-mono text-lg font-semibold">
          {stats.bitrate_kbps ?? '-'} <span className="text-xs">kbps</span>
        </span>
      </div>
      <div className="flex flex-col items-center bg-gray-800 rounded p-3">
        <span className="text-gray-400 text-xs mb-1">FPS</span>
        <span className="font-mono text-lg font-semibold">{stats.fps ?? '-'}</span>
      </div>
      <div className="col-span-2 flex flex-col items-center bg-gray-800 rounded p-3">
        <span className="text-gray-400 text-xs mb-1">ドロップフレーム</span>
        <span className="font-mono text-lg font-semibold">{stats.dropped_frames ?? '-'}</span>
      </div>
    </div>
  );
}
