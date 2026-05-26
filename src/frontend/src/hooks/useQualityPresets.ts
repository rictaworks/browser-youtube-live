import { useState, useEffect } from 'react';
import { getQualityPresets, QualityPresetResponse } from '@/lib/qualityPresets';

type UseQualityPresetsResult = {
  presets: QualityPresetResponse[];
  isLoading: boolean;
  error: string | null;
};

export function useQualityPresets(): UseQualityPresetsResult {
  const [presets, setPresets] = useState<QualityPresetResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getQualityPresets()
      .then(setPresets)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : '品質プリセットの取得に失敗しました');
      })
      .finally(() => setIsLoading(false));
  }, []);

  return { presets, isLoading, error };
}
