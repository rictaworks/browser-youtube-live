import type { StreamStats } from '@/hooks/useStreamStats';
import type { QualityChangeEvent } from '@/hooks/useQualityChange';

type Props = {
  stats: StreamStats | null;
  qualityChange?: QualityChangeEvent | null;
};

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export function StreamDashboard({ stats, qualityChange }: Props) {
  if (!stats) {
    return (
      <div className="rounded-lg bg-gray-100 p-4 text-sm text-gray-500 text-center">
        統計データ待機中...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      {qualityChange && (
        <div
          className={`rounded-md px-4 py-2 text-sm font-semibold ${
            qualityChange.action === 'downgrade'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-green-100 text-green-800'
          }`}
        >
          {qualityChange.action === 'downgrade' ? '品質低下' : '品質改善'}:{' '}
          {qualityChange.new_bitrate} kbps / {qualityChange.new_resolution}
        </div>
      )}
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
          <span className="text-gray-400 text-xs mb-1">解像度</span>
          <span className="font-mono text-lg font-semibold">
            {qualityChange?.new_resolution ?? '-'}
          </span>
        </div>
        <div className="flex flex-col items-center bg-gray-800 rounded p-3">
          <span className="text-gray-400 text-xs mb-1">FPS</span>
          <span className="font-mono text-lg font-semibold">{stats.fps ?? '-'}</span>
        </div>
        <div className="flex flex-col items-center bg-gray-800 rounded p-3">
          <span className="text-gray-400 text-xs mb-1">ドロップフレーム</span>
          <span className="font-mono text-lg font-semibold">{stats.dropped_frames ?? '-'}</span>
        </div>
      </div>
    </div>
  );
}
