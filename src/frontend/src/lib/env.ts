export const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? 'development';

export const isDevelopment = APP_ENV === 'development';
export const isProduction = APP_ENV === 'production';

export const config = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000',
  bridgeWsUrl: process.env.NEXT_PUBLIC_BRIDGE_WS_URL ?? 'ws://localhost:8080',
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '',
} as const;
