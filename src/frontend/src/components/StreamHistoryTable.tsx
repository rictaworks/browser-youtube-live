import type { StreamHistoryItem } from '@/lib/streamSession';

type Props = {
  sessions: StreamHistoryItem[];
};

function formatDuration(sec: number | null): string {
  if (sec === null) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export function StreamHistoryTable({ sessions }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-lg bg-gray-100 p-6 text-sm text-gray-500 text-center">
        配信履歴がありません
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-100 text-gray-700">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">配信日時</th>
            <th className="px-3 py-2 text-right font-semibold">時間</th>
            <th className="px-3 py-2 text-right font-semibold">最大視聴者</th>
            <th className="px-3 py-2 text-left font-semibold">品質</th>
            <th className="px-3 py-2 text-left font-semibold">ステータス</th>
            <th className="px-3 py-2 text-left font-semibold">録画</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-gray-700">
                {formatDateTime(s.started_at ?? s.created_at)}
              </td>
              <td className="px-3 py-2 text-right font-mono">{formatDuration(s.duration_sec)}</td>
              <td className="px-3 py-2 text-right font-mono">
                {s.max_viewers === null ? '—' : s.max_viewers}
              </td>
              <td className="px-3 py-2">{s.quality}</td>
              <td className="px-3 py-2">{s.status}</td>
              <td className="px-3 py-2">
                {s.recording_url ? (
                  <a
                    href={s.recording_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    録画を見る
                  </a>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
