import { startStream, stopStream, StreamSessionState } from '@/hooks/useStreamSession';
import * as api from '@/lib/streamSession';

jest.mock('@/lib/streamSession');
const mockCreate = api.createStreamSession as jest.MockedFunction<typeof api.createStreamSession>;
const mockRegister = api.registerBridgeSession as jest.MockedFunction<
  typeof api.registerBridgeSession
>;

const mockApiResponse = {
  id: 'session-uuid-1',
  broadcast_id: 'broadcast_abc',
  rtmp_url: 'rtmp://a.rtmp.youtube.com/live2/key-abc',
  status: 'created',
  quality: '720p',
};

const mockStream = {
  getTracks: jest.fn(() => []),
} as unknown as MediaStream;

const mockRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  state: 'inactive' as RecordingState,
  ondataavailable: null as ((e: BlobEvent) => void) | null,
};

// MediaRecorder モック
(global as any).MediaRecorder = jest.fn(() => mockRecorder);
(MediaRecorder as any).isTypeSupported = jest.fn(() => true);

// WebSocket モック
class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: (() => void) | null = null;
  send = jest.fn();
  close = jest.fn();
  constructor(public url: string) {
    setTimeout(() => this.onopen?.(), 0);
  }
}
(global as any).WebSocket = MockWebSocket;

beforeEach(() => {
  jest.clearAllMocks();
  mockRecorder.state = 'inactive';
});

describe('startStream', () => {
  test('CREATING → CONNECTING → STREAMING の順で状態が遷移する', async () => {
    mockCreate.mockResolvedValue(mockApiResponse);
    mockRegister.mockResolvedValue(undefined);

    const states: string[] = [];
    const onStateChange = (s: StreamSessionState) => states.push(s.phase);

    const result = await startStream(mockStream, '720p', onStateChange);

    expect(states).toContain('CREATING');
    expect(states).toContain('CONNECTING');
    expect(result.phase).toBe('STREAMING');
  });

  test('createStreamSession が呼ばれる', async () => {
    mockCreate.mockResolvedValue(mockApiResponse);
    mockRegister.mockResolvedValue(undefined);

    await startStream(mockStream, '720p', () => {});

    expect(mockCreate).toHaveBeenCalledWith('720p');
  });

  test('registerBridgeSession が session_id と rtmp_url で呼ばれる', async () => {
    mockCreate.mockResolvedValue(mockApiResponse);
    mockRegister.mockResolvedValue(undefined);

    await startStream(mockStream, '720p', () => {});

    expect(mockRegister).toHaveBeenCalledWith(
      'session-uuid-1',
      'rtmp://a.rtmp.youtube.com/live2/key-abc'
    );
  });

  test('createStreamSession 失敗時に ERROR 状態になる', async () => {
    mockCreate.mockRejectedValue(new Error('quota exceeded'));
    mockRegister.mockResolvedValue(undefined);

    const result = await startStream(mockStream, '720p', () => {});

    expect(result.phase).toBe('ERROR');
    if (result.phase === 'ERROR') {
      expect(result.error).toContain('quota exceeded');
    }
  });

  test('registerBridgeSession 失敗時に ERROR 状態になる', async () => {
    mockCreate.mockResolvedValue(mockApiResponse);
    mockRegister.mockRejectedValue(new Error('bridge error'));

    const result = await startStream(mockStream, '720p', () => {});

    expect(result.phase).toBe('ERROR');
  });
});

describe('stopStream', () => {
  test('IDLE 状態を返す', () => {
    const ws = new MockWebSocket('ws://test') as unknown as WebSocket;
    const recorder = { ...mockRecorder, state: 'recording' as RecordingState };
    const result = stopStream(ws, recorder as unknown as MediaRecorder);
    expect(result.phase).toBe('IDLE');
  });
});
