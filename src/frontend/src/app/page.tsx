'use client';

import LoginButton from '@/components/LoginButton';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { config } from '@/lib/env';

export default function Home() {
  const { user, isLoading } = useCurrentUser();

  const handleSignOut = async () => {
    await fetch(`${config.apiBaseUrl}/auth/sign_out`, {
      method: 'DELETE',
      credentials: 'include',
    });
    window.location.reload();
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-4">YouTube Live 配信</h1>

      {isLoading ? (
        <p className="text-gray-400">読み込み中...</p>
      ) : user ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-gray-700">
            ようこそ、<span className="font-semibold">{user.name}</span> さん
          </p>
          <button
            onClick={handleSignOut}
            className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
          >
            ログアウト
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-gray-500">
            Google アカウントでログインして配信を開始できます。
          </p>
          <LoginButton />
        </div>
      )}
    </main>
  );
}
