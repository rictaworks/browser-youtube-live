import { render, screen } from '@testing-library/react';
import { StreamHistoryTable } from '@/components/StreamHistoryTable';
import type { StreamHistoryItem } from '@/lib/streamSession';

const item: StreamHistoryItem = {
  id: 'sess-1',
  status: 'ended',
  quality: '720p',
  started_at: '2026-05-25T10:00:00Z',
  ended_at: '2026-05-25T10:30:00Z',
  created_at: '2026-05-25T09:59:00Z',
  duration_sec: 1830,
  max_viewers: 42,
  recording_url: null,
};

describe('StreamHistoryTable', () => {
  test('セッションが空のときプレースホルダーを表示する', () => {
    render(<StreamHistoryTable sessions={[]} />);
    expect(screen.getByText('配信履歴がありません')).toBeInTheDocument();
  });

  test('品質・ステータス・最大視聴者数を表示する', () => {
    render(<StreamHistoryTable sessions={[item]} />);
    expect(screen.getByText('720p')).toBeInTheDocument();
    expect(screen.getByText('ended')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  test('duration_sec を HH:MM:SS 形式で表示する', () => {
    render(<StreamHistoryTable sessions={[item]} />);
    // 1830秒 = 00:30:30
    expect(screen.getByText('00:30:30')).toBeInTheDocument();
  });

  test('duration_sec が null の場合 ハイフン表示', () => {
    render(<StreamHistoryTable sessions={[{ ...item, duration_sec: null }]} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  test('max_viewers が null の場合 ハイフン表示', () => {
    render(<StreamHistoryTable sessions={[{ ...item, max_viewers: null }]} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  test('recording_url がある場合リンクを表示する', () => {
    render(
      <StreamHistoryTable sessions={[{ ...item, recording_url: 'https://youtu.be/abc123' }]} />
    );
    const link = screen.getByRole('link', { name: /録画/ });
    expect(link).toHaveAttribute('href', 'https://youtu.be/abc123');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
