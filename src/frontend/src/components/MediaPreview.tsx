'use client';

import { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface MediaPreviewProps {
  stream: MediaStream | null;
  emptyIcon: IconDefinition;
  emptyText: string;
  label: string;
}

export default function MediaPreview({ stream, emptyIcon, emptyText, label }: MediaPreviewProps) {
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
        <FontAwesomeIcon icon={emptyIcon} className="mr-2" />
        {emptyText}
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
      aria-label={label}
    />
  );
}
