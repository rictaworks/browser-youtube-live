'use client';

import { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVideoSlash } from '@fortawesome/free-solid-svg-icons';

interface CameraPreviewProps {
  stream: MediaStream | null;
}

export default function CameraPreview({ stream }: CameraPreviewProps) {
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
      <div className="flex h-48 w-full items-center justify-center rounded-lg bg-gray-800 text-gray-500">
        <FontAwesomeIcon icon={faVideoSlash} className="mr-2" />
        カメラ未接続
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
      aria-label="カメラプレビュー"
    />
  );
}
