'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHistory,
  faChevronLeft,
  faChevronRight,
  faHome,
} from '@fortawesome/free-solid-svg-icons';
import { StreamHistoryTable } from '@/components/StreamHistoryTable';
import {
  listStreamSessions,
  type StreamHistoryResponse,
  StreamApiError,
} from '@/lib/streamSession';

export default function StreamHistoryPage() {
  const [data, setData] = useState<StreamHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listStreamSessions({ page })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof StreamApiError ? err.message : '配信履歴の取得に失敗しました';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="flex w-full max-w-4xl items-center justify-between mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <FontAwesomeIcon icon={faHistory} />
          配信履歴
        </h1>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 transition-colors"
        >
          <FontAwesomeIcon icon={faHome} />
          ホームへ
        </Link>
      </div>

      <div className="w-full max-w-4xl">
        {loading && <p className="text-gray-500 text-center py-8">読み込み中...</p>}
        {error && (
          <div className="rounded-md bg-red-100 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
        )}
        {!loading && !error && data && (
          <>
            <StreamHistoryTable sessions={data.sessions} />
            {data.total_pages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-2 rounded-md bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-40"
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                  前へ
                </button>
                <span className="text-sm text-gray-600">
                  {data.page} / {data.total_pages} ページ（全 {data.total_count} 件）
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                  disabled={page >= data.total_pages}
                  className="flex items-center gap-2 rounded-md bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-40"
                >
                  次へ
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
