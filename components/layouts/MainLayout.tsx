'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Menu, Breadcrumb, Button, Avatar, Dropdown, Typography } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  ShoppingCartOutlined,
  ContainerOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  PrinterOutlined,
  TeamOutlined,
  AppstoreOutlined,
  SettingOutlined,
  NodeIndexOutlined,
  ToolOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getUser, getAccessibleModules, User } from '@/lib/auth';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
  portal: 'management' | 'operation';
}

export default function MainLayout({ children, portal }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const savedUser = getUser();
    if (!savedUser) {
      router.push('/login');
    } else {
      setUser(savedUser);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('ppms_user');
    router.push('/login');
  };

  // Filter menu items based on user permissions
  const menuItems = useMemo(() => {
    if (!user) return [];
    
    const accessibleModules = getAccessibleModules(user);
    
    if (portal === 'management') {
      const items = [];
      
      if (accessibleModules.includes('dashboard')) {
        items.push({ key: '/management/dashboard', icon: <DashboardOutlined />, label: <Link href="/management/dashboard">Dashboard</Link> });
      }
      
      if (accessibleModules.includes('crm')) {
        items.push({ key: '/management/crm', icon: <UserOutlined />, label: <Link href="/management/crm">Khách hàng</Link> });
      }
      
      if (accessibleModules.includes('orders')) {
        items.push({ key: '/management/orders', icon: <ShoppingCartOutlined />, label: <Link href="/management/orders">Đơn hàng</Link> });
        items.push({ key: '/management/tientrinh', icon: <NodeIndexOutlined />, label: <Link href="/management/tientrinh">Tiến trình</Link> });
      }
      
      // Kho - cho phép quản lý xem kho
      if (accessibleModules.includes('warehouse')) {
        items.push({ key: '/management/warehouse', icon: <DatabaseOutlined />, label: <Link href="/management/warehouse">Kho Vật tư</Link> });
      }
      
      // Tài chính - cho phép quản lý xem tài chính
      if (accessibleModules.includes('finance')) {
        items.push({ key: '/management/finance', icon: <DollarOutlined />, label: <Link href="/management/finance">Tài chính</Link> });
      }
      
      if (accessibleModules.includes('organization')) {
        items.push({ 
          key: 'organization', 
          icon: <TeamOutlined />, 
          label: 'Tổ chức',
          children: [
            { key: '/management/organization/departments', icon: <AppstoreOutlined />, label: <Link href="/management/organization/departments">Bộ phận</Link> },
            { key: '/management/organization/staff', icon: <TeamOutlined />, label: <Link href="/management/organization/staff">Nhân sự</Link> },
          ]
        });
      }
      
      if (accessibleModules.includes('config')) {
        items.push({ 
          key: 'config', 
          icon: <SettingOutlined />, 
          label: 'Cấu hình',
          children: [
            { key: '/management/config', icon: <SettingOutlined />, label: <Link href="/management/config">Tổng quan</Link> },
            { key: '/management/config/workflows', icon: <NodeIndexOutlined />, label: <Link href="/management/config/workflows">Quy trình mẫu</Link> },
            { key: '/management/config/machines', icon: <ToolOutlined />, label: <Link href="/management/config/machines">Máy móc</Link> },
          ]
        });
      }
      
      return items;
    } else {
      // Operation portal - bao gồm cả Kho và Sản xuất
      const items = [];
      
      if (accessibleModules.includes('tasks')) {
        items.push({ key: '/operation/tasks', icon: <ContainerOutlined />, label: <Link href="/operation/tasks">Nhiệm vụ</Link> });
      }
      
      if (accessibleModules.includes('warehouse')) {
        items.push({ key: '/operation/warehouse', icon: <DatabaseOutlined />, label: <Link href="/operation/warehouse">Kho Vật tư</Link> });
      }
      
      // Thêm Tài chính cho role Kho
      if (accessibleModules.includes('finance')) {
        items.push({ key: '/operation/finance', icon: <DollarOutlined />, label: <Link href="/operation/finance">Tài chính</Link> });
      }
      
      return items;
    }
  }, [user, portal]);

  const userMenuItems = [
    { key: 'profile', label: <Link href="/profile">Hồ sơ cá nhân</Link>, icon: <UserOutlined /> },
    { type: 'divider' as const },
    { key: 'logout', label: 'Đăng xuất', icon: <LogoutOutlined />, danger: true, onClick: handleLogout },
  ];

  const getBreadcrumbs = () => {
    const paths = pathname.split('/').filter(p => p);
    return paths.map((path, index) => {
      const url = `/${paths.slice(0, index + 1).join('/')}`;
      const isLast = index === paths.length - 1;
      const label = path === 'management' ? 'Quản lý' 
                  : path === 'operation' ? 'Vận hành'
                  : path === 'dashboard' ? 'Dashboard'
                  : path === 'crm' ? 'Khách hàng'
                  : path === 'orders' ? 'Đơn hàng'
                  : path === 'tientrinh' ? 'Tiến trình'
                  : path === 'tasks' ? 'Nhiệm vụ'
                  : path === 'warehouse' ? 'Kho'
                  : path === 'departments' ? 'Bộ phận'
                  : path === 'staff' ? 'Nhân sự'
                  : path === 'organization' ? 'Tổ chức'
                  : path === 'config' ? 'Cấu hình'
                  : path === 'workflows' ? 'Quy trình mẫu'
                  : path === 'machines' ? 'Máy móc'
                  : path === 'profile' ? 'Hồ sơ'
                  : path;
      return { title: isLast ? label : <Link href={url}>{label}</Link> };
    });
  };

  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const rootSubmenuKeys = ['organization', 'config'];

  const onOpenChange = (keys: string[]) => {
    const latestOpenKey = keys.find((key) => openKeys.indexOf(key) === -1);
    if (latestOpenKey && rootSubmenuKeys.indexOf(latestOpenKey) === -1) {
      setOpenKeys(keys);
    } else {
      setOpenKeys(latestOpenKey ? [latestOpenKey] : []);
    }
  };

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 992);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!user) return null;

  return (
    <Layout className="min-h-screen bg-slate-50">
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed} 
        breakpoint="lg"
        collapsedWidth="0"
        onCollapse={(value) => setCollapsed(value)}
        theme="light" 
        className={`premium-sidebar border-none shadow-2xl z-30 transition-all duration-310`}
        width={260}
        style={{ 
          position: 'fixed', 
          top: 0, 
          height: '100vh', 
          left: 0,
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div className={`flex items-center p-6 ${collapsed ? 'justify-center' : 'justify-start'}`}>
          <div className="bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg w-12 h-12 shrink-0">
            <PrinterOutlined className="text-white text-2xl" />
          </div>
          {!collapsed && (
            <div className="ml-4 overflow-hidden">
              <div className="text-indigo-600 font-black text-xl tracking-tighter leading-none">PPMS</div>
              <div className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mt-1">Production</div>
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pb-6 px-3">
          <Menu 
            theme="light" 
            mode="inline" 
            selectedKeys={[pathname]} 
            openKeys={openKeys}
            onOpenChange={onOpenChange}
            items={menuItems} 
            className="border-none sidebar-menu" 
          />
        </div>
      </Sider>
      <Layout 
        className="bg-transparent transition-all duration-300" 
        style={{ marginLeft: isMobile ? 0 : (collapsed ? 0 : 260) }}
      >
        <Header 
          className="sticky top-0 p-0 flex items-center justify-between px-8 z-10 transition-all duration-300 glass-header" 
          style={{ 
            height: 72, 
            background: 'rgba(255, 255, 255, 0.8)', 
            backdropFilter: 'blur(12px)', 
            borderBottom: '1px solid rgba(226, 232, 240, 0.5)',
            width: '100%'
          }}
        >
          <div className="flex items-center gap-4">
            <Button 
              type="text" 
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} 
              onClick={() => setCollapsed(!collapsed)} 
              className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-xl" 
            />
            <Breadcrumb 
              items={getBreadcrumbs()} 
              className="hidden md:flex items-center font-medium text-slate-500 h-full pt-1"
            />
          </div>
          <div className="flex items-center gap-5">
            <div className="hidden sm:flex flex-col items-end justify-center h-full pt-1">
              <div className="font-bold text-slate-800 text-[14px] leading-none mb-1.5">{user.full_name || user.username}</div>
              <div className="text-[10px] text-indigo-500 font-black uppercase tracking-wider leading-none">{user.role?.name}</div>
            </div>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
              <div className="relative group cursor-pointer flex items-center">
                <Avatar 
                  size={46} 
                  icon={<UserOutlined />} 
                  className="bg-indigo-50 text-indigo-600 border-2 border-white shadow-sm group-hover:border-indigo-100 transition-all" 
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm"></div>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content className="m-4 sm:m-8 animate-in">
          <div className="min-h-[calc(100vh-160px)] pt-2">
            {children}
          </div>
        </Content>
      </Layout>

      <style jsx global>{`
        .sidebar-menu.ant-menu-inline { border-inline-end: none !important; }
        .sidebar-menu .ant-menu-item { 
          margin-block: 8px !important; 
          border-radius: 14px !important;
          height: 48px !important;
          line-height: 48px !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .sidebar-menu .ant-menu-item-selected {
          background-color: #6366f1 !important;
          color: white !important;
          box-shadow: 0 10px 20px rgba(99, 102, 241, 0.2) !important;
        }
        .sidebar-menu .ant-menu-item-selected a { color: white !important; }
        .sidebar-menu .ant-menu-item:hover:not(.ant-menu-item-selected) {
          background-color: #f1f5f9 !important;
        }
        .premium-sidebar .ant-menu-submenu-title {
          border-radius: 14px !important;
          margin-block: 8px !important;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </Layout>
  );
}
