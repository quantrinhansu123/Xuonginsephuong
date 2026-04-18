'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Spin } from 'antd';
import MainLayout from "../../components/layouts/MainLayout";
import { getUser, hasPermission, canAccessPortal, User } from '@/lib/auth';

// Module mapping from pathname
const getModuleFromPath = (pathname: string): string => {
  if (pathname.includes('/dashboard')) return 'dashboard';
  if (pathname.includes('/crm')) return 'crm';
  if (pathname.includes('/orders')) return 'orders';
  if (pathname.includes('/organization')) return 'organization';
  if (pathname.includes('/config')) return 'config';
  if (pathname.includes('/profile')) return 'profile';
  return '';
};

export default function ManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const currentUser = getUser();
      
      if (!currentUser) {
        router.push('/login');
        return;
      }

      // Check portal access
      if (!canAccessPortal(currentUser, 'management')) {
        // Redirect operation users to their portal
        if (currentUser.role?.portal === 'operation') {
          router.push('/operation/tasks');
          return;
        }
        setAccessDenied(true);
        return;
      }

      // Check module permission
      const module = getModuleFromPath(pathname);
      if (module && !hasPermission(currentUser, module)) {
        setAccessDenied(true);
        return;
      }

      setUser(currentUser);
      setLoading(false);
    };

    checkAuth();
  }, [router, pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" description="Đang kiểm tra quyền truy cập..." />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-red-600 mb-2">Không có quyền truy cập</h2>
          <p className="text-gray-500 mb-4">Bạn không có quyền truy cập module này.</p>
          <div className="flex gap-2 justify-center">
            <button 
              onClick={() => router.back()}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Quay lại
            </button>
            <button 
              onClick={() => {
                localStorage.removeItem('ppms_user');
                router.push('/login');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <MainLayout portal="management">{children}</MainLayout>;
}
