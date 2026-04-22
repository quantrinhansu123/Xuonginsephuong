import React from 'react';
import { ConfigProvider, theme } from 'antd';

export const themeConfig = {
  token: {
    colorPrimary: '#0047ab', // Cobalt Blue
    colorSuccess: '#10b981', // Emerald 500
    colorWarning: '#f59e0b', // Amber 500
    colorError: '#d62828', // Brand Red
    colorInfo: '#1f6feb', // Cobalt Info
    colorText: '#1e293b',
    colorTextSecondary: '#64748b',
    colorBgBase: '#f8fafc',
    colorBgContainer: '#ffffff',
    colorBorder: '#e2e8f0',
    borderRadius: 16,
    borderRadiusLG: 20,
    borderRadiusSM: 12,
    boxShadowTertiary: '0 4px 20px rgba(0, 0, 0, 0.04)',
    boxShadowSecondary: '0 10px 40px rgba(0, 71, 171, 0.14)',
    fontFamily: 'var(--font-roboto), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  components: {
    Table: {
      headerBg: '#f1f5f9',
      headerColor: '#0f172a',
      rowHoverBg: '#f8fafc',
      borderColor: '#f1f5f9',
      headerSplitColor: 'transparent',
      cellPaddingBlock: 16,
      fontSize: 14,
    },
    Button: {
      borderRadius: 12,
      contentFontSize: 14,
      fontWeight: 600,
      controlHeight: 42,
      primaryShadow: '0 8px 20px rgba(0, 71, 171, 0.28)',
      defaultShadow: '0 2px 8px rgba(0,0,0,0.05)',
    },
    Card: {
      borderRadiusLG: 24,
      boxShadowTertiary: '0 20px 50px rgba(15, 23, 42, 0.05)',
      headerBg: 'transparent',
      paddingLG: 24,
    },
    Modal: {
      borderRadiusLG: 28,
      titleFontSize: 20,
      titleColor: '#0f172a',
      contentBg: '#ffffff',
      headerBg: '#ffffff',
      footerBg: '#f8fafc',
      paddingLG: 32,
    },
    Tabs: {
      itemColor: '#94a3b8',
      itemSelectedColor: '#0047ab',
      itemHoverColor: '#003a8c',
      inkBarColor: '#0047ab',
      titleFontSize: 15,
      horizontalItemPadding: '12px 16px',
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
