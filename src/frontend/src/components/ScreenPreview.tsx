'use client';

import MediaPreview from '@/components/MediaPreview';
import { faDesktop } from '@fortawesome/free-solid-svg-icons';

interface ScreenPreviewProps {
  stream: MediaStream | null;
}

export default function ScreenPreview({ stream }: ScreenPreviewProps) {
  return (
    <MediaPreview
      stream={stream}
      emptyIcon={faDesktop}
      emptyText="画面未共有"
      label="画面共有プレビュー"
    />
  );
}
