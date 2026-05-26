'use client';

import Link from 'next/link';
import LoginButton from '@/components/LoginButton';
import CameraPreview from '@/components/CameraPreview';
import ScreenPreview from '@/components/ScreenPreview';
import MediaPreview from '@/components/MediaPreview';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserMedia } from '@/hooks/useUserMedia';
import { useDisplayMedia } from '@/hooks/useDisplayMedia';
import { useCanvasMixer } from '@/hooks/useCanvasMixer';
import {
  startStream,
  stopStream,
  recoverAndReconnectStream,
  StreamSessionState,
  IDLE,
} from '@/hooks/useStreamSession';
import { useStreamStats } from '@/hooks/useStreamStats';
import { useQualityChange } from '@/hooks/useQualityChange';
import { StreamDashboard } from '@/components/StreamDashboard';
import { useQualityPresets } from '@/hooks/useQualityPresets';
import { config } from '@/lib/env';
import type { Quality } from '@/lib/captureUserMedia';
import { useState, useRef, useCallback, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faVideo,
  faStop,
  faDesktop,
  faLayerGroup,
  faBroadcastTower,
  faHistory,
} from '@fortawesome/free-solid-svg-icons';

export default function Home() {
  const { user, isLoading } = useCurrentUser();
  const { state: cameraState, start: startCamera, stop: stopCamera } = useUserMedia();
  const { state: screenState, start: startScreen, stop: stopScreen } = useDisplayMedia();
  const { state: mixerState, start: startMix, stop: stopMix } = useCanvasMixer();
  const { presets: qualityPresets, error: presetsError } = useQualityPresets();
  const [quality, setQuality] = useState<Quality>('720p');
  const [streamState, setStreamState] = useState<StreamSessionState>(IDLE);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

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

  const handleStartStream = async () => {
    const stream = mixerState.status === 'mixing' ? mixerState.mixedStream : null;
    if (!stream) return;

    const next = await startStream(stream, quality, setStreamState);
    if (next.phase === 'STREAMING') {
      wsRef.current = next.ws;
      recorderRef.current = next.recorder;
    }
  };

  const handleStopStream = useCallback(async () => {
    const sessionId = streamState.phase === 'STREAMING' ? streamState.sessionId : null;
    const ws = wsRef.current;
    const recorder = recorderRef.current;
    wsRef.current = null;
    recorderRef.current = null;
    await stopStream(ws, recorder, sessionId, setStreamState);
  }, [streamState]);

  const streamingWs = streamState.phase === 'STREAMING' ? streamState.ws : null;
  const streamStats = useStreamStats(streamingWs);
  const qualityChange = useQualityChange(streamingWs);

  const reconnectSessionId = streamState.phase === 'RECONNECTING' ? streamState.sessionId : null;
  const reconnectAttempt = streamState.phase === 'RECONNECTING' ? streamState.attempt : 0;

  useEffect(() => {
    if (!reconnectSessionId) return;
    const stream = mixerState.status === 'mixing' ? mixerState.mixedStream : null;
    if (!stream) {
      setStreamState({ phase: 'ERROR', error: '映像ストリームが失われました' });
      return;
    }
    let cancelled = false;
    recoverAndReconnectStream(stream, reconnectSessionId, reconnectAttempt, (state) => {
      if (!cancelled) setStreamState(state);
    }).then((next) => {
      if (!cancelled && next.phase === 'STREAMING') {
        wsRef.current = next.ws;
        recorderRef.current = next.recorder;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reconnectSessionId, reconnectAttempt, mixerState]);

  const cameraStream = cameraState.status === 'capturing' ? cameraState.stream : null;
  const screenStream = screenState.status === 'capturing' ? screenState.stream : null;
  const mixedStream = mixerState.status === 'mixing' ? mixerState.mixedStream : null;
  const canMix = cameraState.status === 'capturing' && screenState.status === 'capturing';
  const canStream = mixerState.status === 'mixing' && streamState.phase === 'IDLE';
  const isStreaming = streamState.phase === 'STREAMING';
  const isEnding = streamState.phase === 'ENDING';
  const isCompleted = streamState.phase === 'COMPLETED';
  const isReconnecting = streamState.phase === 'RECONNECTING';
  const isStreamBusy =
    streamState.phase === 'CREATING' ||
    streamState.phase === 'CONNECTING' ||
    isEnding ||
    isReconnecting;

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

          {presetsError && (
            <p className="text-yellow-600 text-sm">
              品質プリセットの取得に失敗しました。デフォルト品質を使用します。
            </p>
          )}

          {streamState.phase === 'ERROR' && (
            <p className="text-red-500 text-sm">配信エラー: {streamState.error}</p>
          )}

          {isStreaming && (
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="flex items-center gap-2 rounded-md bg-red-100 px-4 py-2 text-sm font-semibold text-red-700">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                配信中
              </div>
              <StreamDashboard stats={streamStats} qualityChange={qualityChange} />
            </div>
          )}

          {isReconnecting && (
            <div className="flex items-center gap-2 rounded-md bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-700">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              再接続中... ({reconnectAttempt}/3)
            </div>
          )}

          {isEnding && (
            <div className="flex items-center gap-2 rounded-md bg-yellow-100 px-4 py-2 text-sm font-semibold text-yellow-700">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              配信終了中...
            </div>
          )}

          {isCompleted && (
            <div className="flex items-center gap-2 rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600">
              配信が終了しました
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as Quality)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
              disabled={
                cameraState.status === 'capturing' ||
                cameraState.status === 'loading' ||
                isStreaming ||
                isStreamBusy
              }
            >
              {qualityPresets.length > 0 ? (
                qualityPresets.map((p) => (
                  <option key={p.name} value={p.name} disabled={!p.enabled}>
                    {p.name}
                    {!p.enabled ? ' (デモ版では利用不可)' : ''}
                  </option>
                ))
              ) : (
                <option value="720p">720p</option>
              )}
            </select>

            {cameraState.status === 'capturing' ? (
              <button
                onClick={stopCamera}
                disabled={isStreaming || isStreamBusy}
                className="flex items-center gap-2 rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faStop} />
                カメラ停止
              </button>
            ) : (
              <button
                onClick={() => startCamera({ video: true, audio: true, quality })}
                disabled={cameraState.status === 'loading' || isStreaming || isStreamBusy}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faVideo} />
                {cameraState.status === 'loading' ? '接続中...' : 'カメラ開始'}
              </button>
            )}

            {screenState.status === 'capturing' ? (
              <button
                onClick={stopScreen}
                disabled={isStreaming || isStreamBusy}
                className="flex items-center gap-2 rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faStop} />
                共有停止
              </button>
            ) : (
              <button
                onClick={startScreen}
                disabled={screenState.status === 'loading' || isStreaming || isStreamBusy}
                className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faDesktop} />
                {screenState.status === 'loading' ? '接続中...' : '画面共有'}
              </button>
            )}

            {mixerState.status === 'mixing' ? (
              <button
                onClick={stopMix}
                disabled={isStreaming || isStreamBusy}
                className="flex items-center gap-2 rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
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

            {isStreaming || isEnding ? (
              <button
                onClick={handleStopStream}
                disabled={isEnding}
                className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faStop} />
                {isEnding ? '終了中...' : '配信停止'}
              </button>
            ) : isCompleted ? (
              <button
                onClick={() => setStreamState(IDLE)}
                className="flex items-center gap-2 rounded-md bg-gray-500 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-600 transition-colors"
              >
                リセット
              </button>
            ) : (
              <button
                onClick={handleStartStream}
                disabled={!canStream || isStreamBusy}
                title={
                  !canStream
                    ? 'PiP合成を開始してから配信できます'
                    : isStreamBusy
                      ? '接続中...'
                      : 'YouTube Live 配信を開始'
                }
                className="flex items-center gap-2 rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-40"
              >
                <FontAwesomeIcon icon={faBroadcastTower} />
                {streamState.phase === 'CREATING'
                  ? 'ブロードキャスト作成中...'
                  : streamState.phase === 'CONNECTING'
                    ? '接続中...'
                    : '配信開始'}
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <Link
              href="/history"
              className="flex items-center gap-2 rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 transition-colors"
            >
              <FontAwesomeIcon icon={faHistory} />
              配信履歴
            </Link>
            <button
              onClick={handleSignOut}
              className="rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-gray-500">Google アカウントでログインして配信を開始できます。</p>
          <LoginButton />
        </div>
      )}
    </main>
  );
}
