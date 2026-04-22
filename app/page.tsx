'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = localStorage.getItem('ppms_user');
    if (user) {
      const parsed = JSON.parse(user);
      if (parsed.role?.portal === 'management') {
        router.push('/management/dashboard');
      } else {
        router.push('/operation/tasks');
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-blue-600 font-bold text-xl">
        In Hoà Phát Loading...
      </div>
    </div>
  );
}
