import { config } from '@/lib/env';

export type QualityPresetResponse = {
  name: string;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  codec: string;
  enabled: boolean;
};

export async function getQualityPresets(): Promise<QualityPresetResponse[]> {
  const res = await fetch(`${config.apiBaseUrl}/quality_presets`);
  if (!res.ok) {
    throw new Error('品質プリセットの取得に失敗しました');
  }
  return res.json() as Promise<QualityPresetResponse[]>;
}
