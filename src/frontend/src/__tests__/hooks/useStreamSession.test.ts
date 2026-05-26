import {
  startStream,
  stopStream,
  recoverAndReconnectStream,
  MAX_RECONNECT_ATTEMPTS,
  StreamSessionState,
} from '@/hooks/useStreamSession';
import * as api from '@/lib/streamSession';

jest.mock('@/lib/streamSession');
const mockCreate = api.createStreamSession as jest.MockedFunction<typeof api.createStreamSession>;
const mockRegister = api.registerBridgeSession as jest.MockedFunction<
  typeof api.registerBridgeSession
>;
const mockEnd = api.endStreamSession as jest.MockedFunction<typeof api.endStreamSession>;
const mockTerminate = api.terminateBridgeSession as jest.MockedFunction<
  typeof api.terminateBridgeSession
>;
const mockRecover = api.recoverStreamSession as jest.MockedFunction<
  typeof api.recoverStreamSession
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
const MockMediaRecorderCtor = jest.fn(() => mockRecorder);
Object.assign(global, { MediaRecorder: MockMediaRecorderCtor });
(MockMediaRecorderCtor as unknown as { isTypeSupported: jest.Mock }).isTypeSupported = jest.fn(
  () => true
);

// WebSocket モック
class MockWebSocket {
  static OPEN = 1;
  static lastInstance: MockWebSocket | null = null;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  send = jest.fn();
  close = jest.fn(() => {
    this.onclose?.({ wasClean: true, code: 1000, reason: '' } as CloseEvent);
  });
  constructor(public url: string) {
    MockWebSocket.lastInstance = this;
    setTimeout(() => this.onopen?.(), 0);
  }
  simulateUnexpectedClose(): void {
    this.readyState = 3;
    this.onclose?.({ wasClean: false, code: 1006, reason: '' } as CloseEvent);
  }
}
Object.assign(global, { WebSocket: MockWebSocket });

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
  test('ENDING → COMPLETED の順で状態が遷移する', async () => {
    mockEnd.mockResolvedValue({ ...mockApiResponse, status: 'ended' });
    mockTerminate.mockResolvedValue(undefined);

    const ws = new MockWebSocket('ws://test') as unknown as WebSocket;
    const recorder = { ...mockRecorder, state: 'recording' as RecordingState };
    const states: string[] = [];
    const onStateChange = (s: StreamSessionState) => states.push(s.phase);

    const result = await stopStream(
      ws,
      recorder as unknown as MediaRecorder,
      'session-uuid-1',
      onStateChange
    );

    expect(states).toContain('ENDING');
    expect(result.phase).toBe('COMPLETED');
  });

  test('endStreamSession と terminateBridgeSession が呼ばれる', async () => {
    mockEnd.mockResolvedValue({ ...mockApiResponse, status: 'ended' });
    mockTerminate.mockResolvedValue(undefined);

    await stopStream(null, null, 'session-uuid-1', () => {});

    expect(mockEnd).toHaveBeenCalledWith('session-uuid-1');
    expect(mockTerminate).toHaveBeenCalledWith('session-uuid-1');
  });

  test('sessionId が null のとき API を呼ばない', async () => {
    const result = await stopStream(null, null, null, () => {});

    expect(mockEnd).not.toHaveBeenCalled();
    expect(mockTerminate).not.toHaveBeenCalled();
    expect(result.phase).toBe('COMPLETED');
  });

  test('recorder.stop() と ws.close() が呼ばれる', async () => {
    mockEnd.mockResolvedValue({ ...mockApiResponse, status: 'ended' });
    mockTerminate.mockResolvedValue(undefined);

    const ws = new MockWebSocket('ws://test') as unknown as WebSocket;
    const recorder = {
      stop: jest.fn(),
      state: 'recording' as RecordingState,
    } as unknown as MediaRecorder;

    await stopStream(ws, recorder, 'sess-1', () => {});

    expect(recorder.stop).toHaveBeenCalled();
    expect(ws.close).toHaveBeenCalled();
  });

  test('endStreamSession 失敗時も COMPLETED に遷移する', async () => {
    mockEnd.mockRejectedValue(new Error('already ended'));
    mockTerminate.mockResolvedValue(undefined);

    const result = await stopStream(null, null, 'sess-1', () => {});
    expect(result.phase).toBe('COMPLETED');
  });
});

const mockRecoverResponse = {
  recovered: true,
  session_id: 'session-uuid-1',
  rtmp_url: 'rtmp://a.rtmp.youtube.com/live2/key-abc',
  broadcast_id: 'broadcast_abc',
  new_broadcast: false,
};

describe('startStream - 予期せぬ WebSocket クローズ', () => {
  test('WS が予期せずクローズされたとき RECONNECTING に遷移する', async () => {
    mockCreate.mockResolvedValue(mockApiResponse);
    mockRegister.mockResolvedValue(undefined);

    const states: StreamSessionState[] = [];
    const onStateChange = (s: StreamSessionState) => states.push(s);

    await startStream(mockStream, '720p', onStateChange);

    const ws = MockWebSocket.lastInstance!;
    ws.simulateUnexpectedClose();

    const lastState = states[states.length - 1];
    expect(lastState.phase).toBe('RECONNECTING');
    if (lastState.phase === 'RECONNECTING') {
      expect(lastState.attempt).toBe(1);
      expect(lastState.sessionId).toBe('session-uuid-1');
    }
  });

  test('wasClean=true のクローズ（ユーザー停止）では RECONNECTING に遷移しない', async () => {
    mockCreate.mockResolvedValue(mockApiResponse);
    mockRegister.mockResolvedValue(undefined);

    const states: StreamSessionState[] = [];
    const onStateChange = (s: StreamSessionState) => states.push(s);

    await startStream(mockStream, '720p', onStateChange);
    const beforeLength = states.length;

    const ws = MockWebSocket.lastInstance!;
    ws.close();

    expect(states.length).toBe(beforeLength);
  });
});

describe('recoverAndReconnectStream', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('recoverStreamSession が sessionId で呼ばれる', async () => {
    mockRecover.mockResolvedValue(mockRecoverResponse);
    mockRegister.mockResolvedValue(undefined);

    const promise = recoverAndReconnectStream(mockStream, 'session-uuid-1', 1, () => {});
    await jest.runAllTimersAsync();
    await promise;

    expect(mockRecover).toHaveBeenCalledWith('session-uuid-1');
  });

  test('成功時に STREAMING 状態を返す', async () => {
    mockRecover.mockResolvedValue(mockRecoverResponse);
    mockRegister.mockResolvedValue(undefined);

    const promise = recoverAndReconnectStream(mockStream, 'session-uuid-1', 1, () => {});
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.phase).toBe('STREAMING');
  });

  test('回復失敗かつ最大試行回数に達したとき ERROR を返す', async () => {
    mockRecover.mockRejectedValue(new Error('回復に失敗しました'));

    const promise = recoverAndReconnectStream(
      mockStream,
      'session-uuid-1',
      MAX_RECONNECT_ATTEMPTS,
      () => {}
    );
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.phase).toBe('ERROR');
  });

  test('回復失敗かつ試行回数が最大未満のとき RECONNECTING(attempt+1) を返す', async () => {
    mockRecover.mockRejectedValue(new Error('回復に失敗しました'));

    const promise = recoverAndReconnectStream(mockStream, 'session-uuid-1', 1, () => {});
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.phase).toBe('RECONNECTING');
    if (result.phase === 'RECONNECTING') {
      expect(result.attempt).toBe(2);
    }
  });

  test('ブリッジ登録失敗かつ最大試行未満のとき RECONNECTING を返す', async () => {
    mockRecover.mockResolvedValue(mockRecoverResponse);
    mockRegister.mockRejectedValue(new Error('bridge error'));

    const promise = recoverAndReconnectStream(mockStream, 'session-uuid-1', 1, () => {});
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.phase).toBe('RECONNECTING');
  });
});
