'use client';

import LoginButton from '@/components/LoginButton';
import CameraPreview from '@/components/CameraPreview';
import ScreenPreview from '@/components/ScreenPreview';
import MediaPreview from '@/components/MediaPreview';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserMedia } from '@/hooks/useUserMedia';
import { useDisplayMedia } from '@/hooks/useDisplayMedia';
import { useCanvasMixer } from '@/hooks/useCanvasMixer';
import { config } from '@/lib/env';
import type { Quality } from '@/lib/captureUserMedia';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVideo, faStop, faDesktop, faLayerGroup } from '@fortawesome/free-solid-svg-icons';

export default function Home() {
  const { user, isLoading } = useCurrentUser();
  const { state: cameraState, start: startCamera, stop: stopCamera } = useUserMedia();
  const { state: screenState, start: startScreen, stop: stopScreen } = useDisplayMedia();
  const { state: mixerState, start: startMix, stop: stopMix } = useCanvasMixer();
  const [quality, setQuality] = useState<Quality>('720p');

  const handleSignOut = async () => {
    await fetch(`${config.apiBaseUrl}/auth/sign_out`, {
      method: 'DELETE',
      credentials: 'include',
    });
    window.location.reload();
  };

  const handleStartMix = () => {
    if (cameraState.status !== 'capturing' || screenState.status !== 'capturing') return;
    startMix(screenState.stream, cameraState.stream, quality);
  };

  const cameraStream = cameraState.status === 'capturing' ? cameraState.stream : null;
  const screenStream = screenState.status === 'capturing' ? screenState.stream : null;
  const mixedStream = mixerState.status === 'mixing' ? mixerState.mixedStream : null;
  const canMix = cameraState.status === 'capturing' && screenState.status === 'capturing';

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

          {mixerState.status === 'mixing' ? (
            <div className="w-full">
              <p className="text-sm font-medium text-gray-600 mb-2">合成プレビュー（PiP）</p>
              <MediaPreview
                stream={mixedStream}
                emptyIcon={faLayerGroup}
                emptyText="合成中..."
                label="PiP合成プレビュー"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-gray-600">カメラ</p>
                <CameraPreview stream={cameraStream} />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-gray-600">画面共有</p>
                <ScreenPreview stream={screenStream} />
              </div>
            </div>
          )}

          {cameraState.status === 'error' && (
            <p className="text-red-500 text-sm">
              {cameraState.error.name === 'PermissionDeniedError'
                ? 'カメラ・マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。'
                : cameraState.error.name === 'DeviceNotFoundError'
                  ? 'カメラ・マイクが見つかりません。デバイスを確認してください。'
                  : `カメラエラー: ${cameraState.error.message}`}
            </p>
          )}

          {screenState.status === 'error' && (
            <p className="text-red-500 text-sm">
              {screenState.error.name === 'PermissionDeniedError'
                ? '画面共有がキャンセルまたは拒否されました。'
                : screenState.error.name === 'NotSupportedError'
                  ? 'このブラウザは画面共有に対応していません（Chrome / Firefox / Edge をご利用ください）。'
                  : `画面共有エラー: ${screenState.error.message}`}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as Quality)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              disabled={cameraState.status === 'capturing' || cameraState.status === 'loading'}
            >
              <option value="1080p">1080p</option>
              <option value="720p">720p</option>
              <option value="480p">480p</option>
            </select>

            {cameraState.status === 'capturing' ? (
              <button
                onClick={stopCamera}
                className="flex items-center gap-2 rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
              >
                <FontAwesomeIcon icon={faStop} />
                カメラ停止
              </button>
            ) : (
              <button
                onClick={() => startCamera({ video: true, audio: true, quality })}
                disabled={cameraState.status === 'loading'}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faVideo} />
                {cameraState.status === 'loading' ? '接続中...' : 'カメラ開始'}
              </button>
            )}

            {screenState.status === 'capturing' ? (
              <button
                onClick={stopScreen}
                className="flex items-center gap-2 rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
              >
                <FontAwesomeIcon icon={faStop} />
                共有停止
              </button>
            ) : (
              <button
                onClick={startScreen}
                disabled={screenState.status === 'loading'}
                className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faDesktop} />
                {screenState.status === 'loading' ? '接続中...' : '画面共有'}
              </button>
            )}

            {mixerState.status === 'mixing' ? (
              <button
                onClick={stopMix}
                className="flex items-center gap-2 rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
              >
                <FontAwesomeIcon icon={faStop} />
                合成停止
              </button>
            ) : (
              <button
                onClick={handleStartMix}
                disabled={!canMix}
                title={canMix ? 'PiP合成を開始' : 'カメラと画面共有を両方開始してください'}
                className="flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition-colors disabled:opacity-40"
              >
                <FontAwesomeIcon icon={faLayerGroup} />
                PiP合成
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
