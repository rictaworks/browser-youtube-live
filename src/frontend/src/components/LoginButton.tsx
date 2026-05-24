'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import { config } from '@/lib/env';

export default function LoginButton() {
  const authUrl = `${config.apiBaseUrl}/auth/google`;

  return (
    <a
      href={authUrl}
      className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-md ring-1 ring-gray-300 hover:bg-gray-50 transition-colors"
    >
      <FontAwesomeIcon icon={faGoogle} className="h-4 w-4" />
      Google アカウントでログイン
    </a>
  );
}
