import React from 'react';
import { ConfigProvider, theme } from 'antd';

export const themeConfig = {
  token: {
    colorPrimary: '#2563eb',
    colorSuccess: '#16a34a',
    colorWarning: '#ea580c',
    colorError: '#dc2626',
    colorInfo: '#0ea5e9',
    colorText: '#0f172a',
    colorTextSecondary: '#475569',
    colorBgBase: '#f8fafc',
    colorBgContainer: '#ffffff',
    colorBorder: '#e2e8f0',
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 10,
    boxShadowTertiary: '0 2px 10px rgba(15, 23, 42, 0.06)',
    boxShadowSecondary: '0 10px 30px rgba(37, 99, 235, 0.08)',
    fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial',
  },
  components: {
    Table: {
      headerBg: '#eff6ff',
      headerColor: '#1e3a8a',
      rowHoverBg: '#f8fbff',
      borderColor: '#dbeafe',
      headerSplitColor: '#dbeafe',
      cellPaddingBlock: 14,
    },
    Button: {
      borderRadius: 10,
      contentFontSize: 14,
      fontWeight: 600,
      controlHeight: 40,
      primaryShadow: '0 10px 24px rgba(37, 99, 235, 0.25)',
    },
    Card: {
      borderRadiusLG: 16,
      boxShadowTertiary: '0 12px 28px rgba(15, 23, 42, 0.07)',
      headerBg: 'transparent',
    },
    Modal: {
      borderRadiusLG: 20,
      titleFontSize: 18,
      titleColor: '#0f172a',
      contentBg: '#ffffff',
      headerBg: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
      footerBg: '#ffffff',
    },
    Tabs: {
      itemColor: '#64748b',
      itemSelectedColor: '#1e3a8a',
      itemHoverColor: '#2563eb',
      inkBarColor: '#2563eb',
    },
    Input: {
      borderRadius: 10,
      hoverBorderColor: '#93c5fd',
      activeBorderColor: '#60a5fa',
    },
    Select: {
      borderRadius: 10,
      optionSelectedBg: '#eff6ff',
    },
    Tag: {
      borderRadiusSM: 999,
      defaultBg: '#f1f5f9',
      defaultColor: '#334155',
    },
    Divider: {
      colorSplit: '#e2e8f0',
    },
  },
};

const ThemeConfig = ({ children }: { children: React.ReactNode }) => {
  return (
    <ConfigProvider theme={themeConfig}>
      {children}
    </ConfigProvider>
  );
};

export default ThemeConfig;
