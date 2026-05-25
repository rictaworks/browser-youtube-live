'use client';

import { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDesktop } from '@fortawesome/free-solid-svg-icons';

interface ScreenPreviewProps {
  stream: MediaStream | null;
}

export default function ScreenPreview({ stream }: ScreenPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  if (!stream) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-lg bg-gray-900 text-gray-500">
        <FontAwesomeIcon icon={faDesktop} className="mr-2" />
        画面未共有
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="w-full rounded-lg bg-black"
      aria-label="画面共有プレビュー"
    />
  );
}
