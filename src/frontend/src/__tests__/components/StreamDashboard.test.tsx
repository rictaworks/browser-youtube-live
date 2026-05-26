import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { StreamDashboard } from '@/components/StreamDashboard';
import type { StreamStats } from '@/hooks/useStreamStats';

const mockStats: StreamStats = {
  bitrate_kbps: 3000,
  fps: 30.0,
  dropped_frames: 2,
  viewer_count: 42,
  buffer_size_kb: 256,
  elapsed_seconds: 3661,
  status: 'live',
};

describe('StreamDashboard', () => {
  test('statsがnullのとき待機メッセージを表示する', () => {
    render(<StreamDashboard stats={null} />);
    expect(screen.getByText(/待機中/)).toBeInTheDocument();
  });

  test('ビットレートを表示する', () => {
    render(<StreamDashboard stats={mockStats} />);
    expect(screen.getByText(/3000/)).toBeInTheDocument();
  });

  test('視聴者数を表示する', () => {
    render(<StreamDashboard stats={mockStats} />);
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  test('経過時間を HH:MM:SS 形式で表示する', () => {
    render(<StreamDashboard stats={mockStats} />);
    expect(screen.getByText('01:01:01')).toBeInTheDocument();
  });

  test('elapsed_seconds が 0 のとき 00:00:00 を表示する', () => {
    render(<StreamDashboard stats={{ ...mockStats, elapsed_seconds: 0 }} />);
    expect(screen.getByText('00:00:00')).toBeInTheDocument();
  });

  test('FPSを表示する', () => {
    render(<StreamDashboard stats={mockStats} />);
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  test('ドロップフレームを表示する', () => {
    render(<StreamDashboard stats={mockStats} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
