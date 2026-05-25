'use client';

import MediaPreview from '@/components/MediaPreview';
import { faVideoSlash } from '@fortawesome/free-solid-svg-icons';

interface CameraPreviewProps {
  stream: MediaStream | null;
}

export default function CameraPreview({ stream }: CameraPreviewProps) {
  return (
    <MediaPreview
      stream={stream}
      emptyIcon={faVideoSlash}
      emptyText="カメラ未接続"
      label="カメラプレビュー"
    />
  );
}
