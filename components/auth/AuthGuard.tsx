'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Spin, Result, Button } from 'antd';
import { getUser, hasPermission, canAccessPortal, User } from '@/lib/auth';

interface AuthGuardProps {
  children: React.ReactNode;
  portal: 'management' | 'operation';
  module: string;
}

export default function AuthGuard({ children, portal, module }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const currentUser = getUser();
      
      // Not logged in
      if (!currentUser) {
        router.push('/login');
        return;
      }

      setUser(currentUser);

      // Check portal access
      if (!canAccessPortal(currentUser, portal)) {
        setAccessDenied(true);
        return;
      }

      // Check module permission
      if (!hasPermission(currentUser, module)) {
        setAccessDenied(true);
        return;
      }

      setLoading(false);
    };

    checkAuth();
  }, [router, portal, module, pathname]);

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
        <Result
          status="403"
          title="403 - Không có quyền truy cập"
          subTitle="Bạn không có quyền truy cập module này. Vui lòng liên hệ quản trị viên."
          extra={[
            <Button type="primary" key="back" onClick={() => router.back()}>
              Quay lại
            </Button>,
            <Button key="logout" onClick={() => {
              localStorage.removeItem('ppms_user');
              router.push('/login');
            }}>
              Đăng xuất
            </Button>,
          ]}
        />
      </div>
    );
  }

  return <>{children}</>;
}
