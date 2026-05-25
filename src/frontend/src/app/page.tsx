'use client';

import LoginButton from '@/components/LoginButton';
import CameraPreview from '@/components/CameraPreview';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserMedia } from '@/hooks/useUserMedia';
import { config } from '@/lib/env';
import type { Quality } from '@/lib/captureUserMedia';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVideo, faStop } from '@fortawesome/free-solid-svg-icons';

export default function Home() {
  const { user, isLoading } = useCurrentUser();
  const { state, start, stop } = useUserMedia();
  const [quality, setQuality] = useState<Quality>('720p');

  const handleSignOut = async () => {
    await fetch(`${config.apiBaseUrl}/auth/sign_out`, {
      method: 'DELETE',
      credentials: 'include',
    });
    window.location.reload();
  };

  const handleStartCamera = () => {
    start({ video: true, audio: true, quality });
  };

  const stream = state.status === 'capturing' ? state.stream : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-4">YouTube Live 配信</h1>

      {isLoading ? (
        <p className="text-gray-400">読み込み中...</p>
      ) : user ? (
        <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
          <p className="text-gray-700">
            ようこそ、<span className="font-semibold">{user.name}</span> さん
          </p>

          <CameraPreview stream={stream} />

          {state.status === 'error' && (
            <p className="text-red-500 text-sm">
              {state.error.name === 'PermissionDeniedError'
                ? 'カメラ・マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。'
                : state.error.name === 'DeviceNotFoundError'
                  ? 'カメラ・マイクが見つかりません。デバイスを確認してください。'
                  : `エラーが発生しました: ${state.error.message}`}
            </p>
          )}

          <div className="flex items-center gap-3">
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as Quality)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              disabled={state.status === 'capturing' || state.status === 'loading'}
            >
              <option value="1080p">1080p</option>
              <option value="720p">720p</option>
              <option value="480p">480p</option>
            </select>

            {state.status === 'capturing' ? (
              <button
                onClick={stop}
                className="flex items-center gap-2 rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
              >
                <FontAwesomeIcon icon={faStop} />
                カメラ停止
              </button>
            ) : (
              <button
                onClick={handleStartCamera}
                disabled={state.status === 'loading'}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faVideo} />
                {state.status === 'loading' ? '接続中...' : 'カメラ開始'}
              </button>
            )}
          </div>

          <button
            onClick={handleSignOut}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 transition-colors"
          >
            ログアウト
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-gray-500">
            Google アカウントでログインして配信を開始できます。
          </p>
          <LoginButton />
        </div>
      )}
    </main>
  );
}
