import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import StreamHistoryPage from '@/app/history/page';
import * as api from '@/lib/streamSession';

jest.mock('@/lib/streamSession', () => {
  const actual = jest.requireActual('@/lib/streamSession');
  return {
    ...actual,
    listStreamSessions: jest.fn(),
  };
});
const mockList = api.listStreamSessions as jest.MockedFunction<typeof api.listStreamSessions>;

const buildPayload = (
  overrides: Partial<api.StreamHistoryResponse> = {}
): api.StreamHistoryResponse => ({
  sessions: [
    {
      id: 'sess-1',
      status: 'ended',
      quality: '720p',
      started_at: '2026-05-25T10:00:00Z',
      ended_at: '2026-05-25T10:30:00Z',
      created_at: '2026-05-25T09:59:00Z',
      duration_sec: 1800,
      max_viewers: 42,
      recording_url: null,
    },
  ],
  page: 1,
  per_page: 20,
  total_count: 1,
  total_pages: 1,
  ...overrides,
});

describe('StreamHistoryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('初回ロードで listStreamSessions を呼ぶ', async () => {
    mockList.mockResolvedValue(buildPayload());
    render(<StreamHistoryPage />);

    await waitFor(() => expect(mockList).toHaveBeenCalledWith({ page: 1 }));
  });

  test('読み込み中はプレースホルダーを表示する', () => {
    mockList.mockReturnValue(new Promise(() => {}));
    render(<StreamHistoryPage />);
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  test('成功時に StreamHistoryTable のセルを表示する', async () => {
    mockList.mockResolvedValue(buildPayload());
    render(<StreamHistoryPage />);

    await waitFor(() => expect(screen.getByText('720p')).toBeInTheDocument());
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  test('APIエラー時にエラーメッセージを表示する', async () => {
    mockList.mockRejectedValue(new api.StreamApiError('権限がありません'));
    render(<StreamHistoryPage />);

    await waitFor(() => expect(screen.getByText('権限がありません')).toBeInTheDocument());
  });

  test('total_pages > 1 のとき次/前ボタンが表示され、クリックでページ変更される', async () => {
    mockList.mockResolvedValue(buildPayload({ total_pages: 3, total_count: 50 }));
    render(<StreamHistoryPage />);

    const nextBtn = await screen.findByRole('button', { name: /次へ/ });
    expect(nextBtn).toBeEnabled();

    fireEvent.click(nextBtn);
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith({ page: 2 }));
  });

  test('total_pages = 1 のときページネーションは非表示', async () => {
    mockList.mockResolvedValue(buildPayload({ total_pages: 1 }));
    render(<StreamHistoryPage />);

    await waitFor(() => expect(screen.getByText('720p')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /次へ/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /前へ/ })).toBeNull();
  });
});
