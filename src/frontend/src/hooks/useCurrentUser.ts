import useSWR from 'swr';
import { config } from '@/lib/env';

interface CurrentUser {
  id: string;
  email: string;
  name: string;
}

const fetchCurrentUser = (url: string): Promise<CurrentUser> =>
  fetch(url, { credentials: 'include' }).then((res) => {
    if (res.status === 401) return Promise.resolve(null as unknown as CurrentUser);
    if (!res.ok) throw new Error(`ユーザー情報の取得に失敗しました: ${res.status}`);
    return res.json() as Promise<CurrentUser>;
  });

export function useCurrentUser() {
  const { data, error, isLoading, mutate } = useSWR<CurrentUser | null>(
    `${config.apiBaseUrl}/auth/me`,
    fetchCurrentUser,
    { shouldRetryOnError: false }
  );

  return {
    user: data ?? null,
    isLoading,
    isError: !!error,
    mutate,
  };
}
