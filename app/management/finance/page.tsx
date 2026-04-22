'use client';

import React, { useState, useEffect } from 'react';
import {
  Table, Card, Typography, Row, Col, Space, Button,
  Select, DatePicker, Tag, message, Statistic, Tabs,
  Input, Segmented, Modal, Form, InputNumber, Popconfirm,
  Descriptions, Badge, Tooltip as AntTooltip, Dropdown
} from 'antd';
import {
  DollarOutlined,
  ReloadOutlined,
  FileExcelOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  SearchOutlined,
  WarningOutlined,
  PlusOutlined,
  PrinterOutlined,
  FundOutlined,
  BarChartOutlined,
  WalletOutlined,
  CalendarOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  BankOutlined,
  CreditCardOutlined,
  MoreOutlined,
  CheckOutlined,
  CloseOutlined,
  SwapOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

const COLORS = ['#1890ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1'];

// Transaction type labels
const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  'income': { label: 'Thu', color: 'green' },
  'expense': { label: 'Chi', color: 'red' }
};

// Reference type labels
const REFERENCE_LABELS: Record<string, string> = {
  'order_payment': 'Thanh toán đơn hàng',
  'refund': 'Hoàn tiền',
  'salary': 'Lương nhân viên',
  'material': 'Mua vật liệu',
  'utility': 'Điện nước, dịch vụ',
  'other': 'Khác'
};

export default function FinancePage() {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [cashAccounts, setCashAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // Modals
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  const [form] = Form.useForm();
  const [accountForm] = Form.useForm();
  const [transferForm] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const [stats, setStats] = useState({
    totalIn: 0,
    totalOut: 0,
    netFlow: 0,
    transactionCount: 0
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch transactions
      let query = supabase
        .from('transactions')
        .select(`
          *,
          category:transaction_categories(id, name, code, type),
          cash_account:cash_accounts(id, name, code, type),
          customer:customers(id, name, code),
          order:production_orders(id, code, title)
        `)
        .order('transaction_date', { ascending: false });

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }
      if (categoryFilter !== 'all') {
        query = query.eq('category_id', categoryFilter);
      }
      if (accountFilter !== 'all') {
        query = query.eq('cash_account_id', accountFilter);
      }
      if (dateRange) {
        query = query.gte('transaction_date', dateRange[0].format('YYYY-MM-DD'));
        query = query.lte('transaction_date', dateRange[1].format('YYYY-MM-DD'));
      }

      const { data: txData, error: txError } = await query;
      if (txError) throw txError;

      let filtered = txData || [];
      if (search) {
        filtered = filtered.filter(t =>
          t.code?.toLowerCase().includes(search.toLowerCase()) ||
          t.description?.toLowerCase().includes(search.toLowerCase()) ||
          t.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
          t.order?.code?.toLowerCase().includes(search.toLowerCase())
        );
      }
      setTransactions(filtered);

      // Fetch cash accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('cash_accounts')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (accountsError) throw accountsError;
      setCashAccounts(accountsData || []);

      // Fetch categories
      const { data: catData, error: catError } = await supabase
        .from('transaction_categories')
        .select('*')
        .eq('is_active', true)
        .order('type, name');
      if (catError) throw catError;
      setCategories(catData || []);

      // Fetch customers
      const { data: custData } = await supabase
        .from('customers')
        .select('id, name, code, current_debt')
        .order('name');
      setCustomers(custData || []);

      // Fetch orders
      const { data: orderData } = await supabase
        .from('production_orders')
        .select('id, code, title')
        .order('created_at', { ascending: false })
        .limit(100);
      setOrders(orderData || []);

      // Calculate stats
      const totalIn = filtered.filter(t => t.type === 'income' && t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0);
      const totalOut = filtered.filter(t => t.type === 'expense' && t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0);
      setStats({
        totalIn,
        totalOut,
        netFlow: totalIn - totalOut,
        transactionCount: filtered.length
      });

    } catch (err) {
      console.error(err);
      message.error('Lỗi khi tải dữ liệu tài chính');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [typeFilter, categoryFilter, accountFilter, dateRange]);

  // Transaction CRUD
  const handleCreateTransaction = async (values: any) => {
    setSaving(true);
    try {
      // Generate code
      const prefix = values.type === 'income' ? 'THU' : 'CHI';
      const { data: lastTx } = await supabase
        .from('transactions')
        .select('code')
        .like('code', `${prefix}-%`)
        .order('code', { ascending: false })
        .limit(1);

      const nextNum = lastTx && lastTx.length > 0
        ? parseInt(lastTx[0].code.split('-')[1]) + 1
        : 1;
      const code = `${prefix}-${String(nextNum).padStart(5, '0')}`;

      const { error } = await supabase
        .from('transactions')
        .insert([{
          code,
          type: values.type,
          category_id: values.category_id,
          cash_account_id: values.cash_account_id,
          amount: values.amount,
          customer_id: values.customer_id || null,
          order_id: values.order_id || null,
          reference_type: values.reference_type || 'other',
          description: values.description,
          transaction_date: values.transaction_date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
          status: 'completed',
          note: values.note
        }]);

      if (error) throw error;

      message.success('Đã tạo giao dịch thành công');
      setTransactionModalVisible(false);
      fetchData();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi tạo giao dịch');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTransaction = async (id: string, values: any) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          category_id: values.category_id,
          cash_account_id: values.cash_account_id,
          amount: values.amount,
          description: values.description,
          note: values.note,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      message.success('Đã cập nhật giao dịch');
      setDetailModalVisible(false);
      fetchData();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi cập nhật giao dịch');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      // First cancel the transaction to reverse balance
      await supabase
        .from('transactions')
        .update({ status: 'cancelled' })
        .eq('id', id);

      // Then delete
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      message.success('Đã xóa giao dịch');
      setDetailModalVisible(false);
      fetchData();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi xóa giao dịch');
    }
  };

  // Cash Account CRUD
  const handleSaveAccount = async (values: any) => {
    setSaving(true);
    try {
      if (editingAccount) {
        const { error } = await supabase
          .from('cash_accounts')
          .update({
            name: values.name,
            type: values.type,
            account_number: values.account_number,
            bank_name: values.bank_name,
            note: values.note,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingAccount.id);
        if (error) throw error;
        message.success('Đã cập nhật tài khoản');
      } else {
        const { error } = await supabase
          .from('cash_accounts')
          .insert([{
            code: values.code,
            name: values.name,
            type: values.type,
            account_number: values.account_number,
            bank_name: values.bank_name,
            balance: values.balance || 0,
            note: values.note
          }]);
        if (error) throw error;
        message.success('Đã tạo tài khoản thành công');
      }
      setAccountModalVisible(false);
      accountForm.resetFields();
      setEditingAccount(null);
      fetchData();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi lưu tài khoản');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      // Check if account has transactions
      const { data: txs } = await supabase
        .from('transactions')
        .select('id')
        .eq('cash_account_id', id)
        .limit(1);

      if (txs && txs.length > 0) {
        message.error('Không thể xóa tài khoản đã có giao dịch');
        return;
      }

      const { error } = await supabase
        .from('cash_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      message.success('Đã xóa tài khoản');
      fetchData();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi xóa tài khoản');
    }
  };

  // Internal Transfer
  const handleTransfer = async (values: any) => {
    setSaving(true);
    try {
      // Generate transfer code
      const { data: lastTransfer } = await supabase
        .from('transactions')
        .select('code')
        .like('code', 'CK-%')
        .order('code', { ascending: false })
        .limit(1);

      const nextNum = lastTransfer && lastTransfer.length > 0
        ? parseInt(lastTransfer[0].code.split('-')[1]) + 1
        : 1;
      const code = `CK-${String(nextNum).padStart(5, '0')}`;

      // Create expense transaction for from account
      await supabase.from('transactions').insert([{
        code: `${code}-OUT`,
        type: 'expense',
        category_id: categories.find(c => c.code === 'CHI-KHAC')?.id,
        cash_account_id: values.from_account_id,
        amount: values.amount,
        description: `Chuyển khoản đến ${cashAccounts.find(a => a.id === values.to_account_id)?.name}`,
        transaction_date: values.transfer_date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        status: 'completed',
        note: values.description
      }]);

      // Create income transaction for to account
      await supabase.from('transactions').insert([{
        code: `${code}-IN`,
        type: 'income',
        category_id: categories.find(c => c.code === 'THU-KHAC')?.id,
        cash_account_id: values.to_account_id,
        amount: values.amount,
        description: `Nhận chuyển khoản từ ${cashAccounts.find(a => a.id === values.from_account_id)?.name}`,
        transaction_date: values.transfer_date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        status: 'completed',
        note: values.description
      }]);

      message.success('Đã chuyển khoản thành công');
      setTransferModalVisible(false);
      transferForm.resetFields();
      fetchData();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi chuyển khoản');
    } finally {
      setSaving(false);
    }
  };

  const exportToExcel = () => {
    const exportData = transactions.map(t => ({
      "Mã GD": t.code,
      "Ngày": dayjs(t.transaction_date).format('DD/MM/YYYY'),
      "Loại": t.type === 'income' ? 'Thu' : 'Chi',
      "Danh mục": t.category?.name,
      "Tài khoản": t.cash_account?.name,
      "Khách hàng": t.customer?.name,
      "Đơn hàng": t.order?.code,
      "Số tiền": t.amount,
      "Mô tả": t.description,
      "Trạng thái": t.status === 'completed' ? 'Hoàn thành' : 'Đã hủy'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GiaoDich");
    XLSX.writeFile(wb, `TaiChinh_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    message.success(`Đã xuất ${transactions.length} giao dịch`);
  };

  // Chart data
  const getDailyData = () => {
    const dailyMap: Record<string, { date: string; thu: number; chi: number }> = {};
    transactions.filter(t => t.status === 'completed').forEach(t => {
      const date = dayjs(t.transaction_date).format('DD/MM');
      if (!dailyMap[date]) dailyMap[date] = { date, thu: 0, chi: 0 };
      if (t.type === 'income') dailyMap[date].thu += t.amount || 0;
      else dailyMap[date].chi += t.amount || 0;
    });
    return Object.values(dailyMap).slice(-14);
  };

  const getCategoryData = () => {
    const catMap: Record<string, { name: string; value: number }> = {};
    transactions.filter(t => t.status === 'completed' && t.type === 'expense').forEach(t => {
      const name = t.category?.name || 'Khác';
      if (!catMap[name]) catMap[name] = { name, value: 0 };
      catMap[name].value += t.amount || 0;
    });
    return Object.values(catMap).sort((a, b) => b.value - a.value).slice(0, 5);
  };

  const getAccountBalanceData = () => {
    return cashAccounts.map(a => ({
      name: a.name,
      balance: a.balance || 0,
      type: a.type
    }));
  };

  // Columns
  const transactionColumns = [
    {
      title: 'Mã GD',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (code: string, r: any) => (
        <Button type="link" className="p-0" onClick={() => { setSelectedTransaction(r); setDetailModalVisible(true); }}>
          {code}
        </Button>
      )
    },
    {
      title: 'Ngày',
      dataIndex: 'transaction_date',
      key: 'date',
      width: 100,
      render: (d: string) => dayjs(d).format('DD/MM/YYYY')
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      width: 70,
      render: (t: string) => (
        <Tag color={TYPE_LABELS[t]?.color || 'default'}>
          {TYPE_LABELS[t]?.label || t}
        </Tag>
      )
    },
    {
      title: 'Danh mục',
      key: 'category',
      render: (_: any, r: any) => r.category?.name || '---'
    },
    {
      title: 'Tài khoản',
      key: 'account',
      render: (_: any, r: any) => (
        <Space>
          {r.cash_account?.type === 'bank' && <BankOutlined />}
          {r.cash_account?.type === 'momo' && <CreditCardOutlined />}
          {r.cash_account?.type === 'cash' && <WalletOutlined />}
          <span>{r.cash_account?.name}</span>
        </Space>
      )
    },
    {
      title: 'Khách hàng/Đơn hàng',
      key: 'reference',
      render: (_: any, r: any) => (
        <div>
          {r.customer && <Text>{r.customer.name}</Text>}
          {r.order && <Text type="secondary" className="block text-xs">{r.order.code}</Text>}
        </div>
      )
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      render: (a: number, r: any) => (
        <Text strong style={{ color: r.type === 'income' ? '#52c41a' : '#f5222d' }}>
          {r.type === 'income' ? '+' : '-'}{a?.toLocaleString()} đ
        </Text>
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={s === 'completed' ? 'green' : 'red'}>
          {s === 'completed' ? 'Hoàn thành' : 'Đã hủy'}
        </Tag>
      )
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 80,
      render: (_: any, r: any) => (
        <Space>
          <AntTooltip title="Xem chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelectedTransaction(r); setDetailModalVisible(true); }} />
          </AntTooltip>
        </Space>
      )
    }
  ];

  const accountColumns = [
    {
      title: 'Mã',
      dataIndex: 'code',
      key: 'code',
      width: 100
    },
    {
      title: 'Tên tài khoản',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      render: (t: string) => {
        const icons: Record<string, any> = { cash: <WalletOutlined />, bank: <BankOutlined />, momo: <CreditCardOutlined /> };
        const labels: Record<string, string> = { cash: 'Tiền mặt', bank: 'Ngân hàng', momo: 'Ví điện tử' };
        return <Tag icon={icons[t]}>{labels[t] || t}</Tag>;
      }
    },
    {
      title: 'Số TK/Ngân hàng',
      key: 'bank_info',
      render: (_: any, r: any) => r.type === 'bank' ? `${r.bank_name || ''} - ${r.account_number || ''}` : '---'
    },
    {
      title: 'Số dư',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      render: (b: number) => <Text strong style={{ color: b >= 0 ? '#1890ff' : '#f5222d' }}>{b?.toLocaleString()} đ</Text>
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_: any, r: any) => (
        <Space>
          <AntTooltip title="Sửa">
            <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingAccount(r); accountForm.setFieldsValue(r); setAccountModalVisible(true); }} />
          </AntTooltip>
          <Popconfirm title="Xóa tài khoản này?" onConfirm={() => handleDeleteAccount(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const tabItems = [
    {
      key: '1',
      label: <span><DollarOutlined /> Giao dịch</span>,
      children: (
        <div className="space-y-6">
          <Row gutter={[24, 24]}>
            <Col span={6}>
              <div className="ui-surface p-6 flex items-center justify-between border-none">
                <div className="flex flex-col">
                  <Text className="premium-label mb-1">Tổng thu</Text>
                  <div className="flex items-baseline gap-1 whitespace-nowrap">
                    <span className="text-2xl font-black text-emerald-600 leading-none">{(stats.totalIn || 0).toLocaleString()}</span>
                    <span className="text-xs font-bold text-slate-400">đ</span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600 text-2xl shadow-sm border border-emerald-100">
                  <ArrowUpOutlined />
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div className="ui-surface p-6 flex items-center justify-between border-none">
                <div className="flex flex-col">
                  <Text className="premium-label mb-1">Tổng chi</Text>
                  <div className="flex items-baseline gap-1 whitespace-nowrap">
                    <span className="text-2xl font-black text-rose-600 leading-none">{(stats.totalOut || 0).toLocaleString()}</span>
                    <span className="text-xs font-bold text-slate-400">đ</span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-rose-50 text-rose-600 text-2xl shadow-sm border border-rose-100">
                  <ArrowDownOutlined />
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div className="ui-surface p-6 flex items-center justify-between border-none">
                <div className="flex flex-col">
                  <Text className="premium-label mb-1">Dòng tiền ròng</Text>
                  <div className="flex items-baseline gap-1 whitespace-nowrap">
                    <span className={`text-2xl font-black leading-none ${stats.netFlow >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                      {(stats.netFlow || 0).toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-slate-400">đ</span>
                  </div>
                </div>
                <div className={`p-4 rounded-2xl ${stats.netFlow >= 0 ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-rose-50 text-rose-600 border-rose-100'} text-2xl shadow-sm border`}>
                  <FundOutlined />
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div className="ui-surface p-6 flex items-center justify-between border-none">
                <div className="flex flex-col">
                  <Text className="premium-label mb-1">Số giao dịch</Text>
                  <div className="flex items-baseline gap-1 whitespace-nowrap">
                    <span className="text-2xl font-black text-slate-900 leading-none">{stats.transactionCount}</span>
                    <span className="text-xs font-bold text-slate-400">lần</span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-100 text-slate-600 text-2xl shadow-sm border border-slate-200">
                  <HistoryOutlined />
                </div>
              </div>
            </Col>
          </Row>

          <div className="glass-card p-4 rounded-[28px] grid grid-cols-12 gap-4 items-center">
            <div className="col-span-3">
              <Input
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="Tìm giao dịch, khách..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="premium-select"
                allowClear
              />
            </div>
            <div className="col-span-2">
              <Select className="w-full premium-select" value={typeFilter} onChange={setTypeFilter}>
                <Option value="all">TẤT CẢ LOẠI</Option>
                <Option value="income">THU TIỀN</Option>
                <Option value="expense">CHI TIỀN</Option>
              </Select>
            </div>
            <div className="col-span-2">
              <Select className="w-full premium-select" value={categoryFilter} onChange={setCategoryFilter} allowClear placeholder="DANH MỤC">
                <Option value="all">TẤT CẢ DM</Option>
                {categories.map(c => <Option key={c.id} value={c.id}>{c.name.toUpperCase()}</Option>)}
              </Select>
            </div>
            <div className="col-span-2">
              <Select className="w-full premium-select" value={accountFilter} onChange={setAccountFilter} allowClear placeholder="TÀI KHOẢN">
                <Option value="all">TẤT CẢ TK</Option>
                {cashAccounts.map(a => <Option key={a.id} value={a.id}>{a.name.toUpperCase()}</Option>)}
              </Select>
            </div>
            <div className="col-span-3">
              <RangePicker className="w-full premium-datepicker" onChange={d => setDateRange(d as any)} />
            </div>
          </div>

          <div className="premium-shadow rounded-[32px] overflow-hidden bg-white">
            <Table
              columns={transactionColumns}
              dataSource={transactions}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 12, placement: 'bottomCenter' } as any}
              className="designer-table"
              scroll={{ x: 'max-content' }}
            />
          </div>
        </div>
      )
    },
    {
      key: '2',
      label: <span><WalletOutlined /> Sổ quỹ</span>,
      children: (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Text className="premium-label text-slate-900">Danh sách tài khoản thanh toán</Text>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingAccount(null); accountForm.resetFields(); setAccountModalVisible(true); }} className="rounded-xl font-bold bg-indigo-600 border-none px-6">
              THÊM TÀI KHOẢN
            </Button>
          </div>

          <Row gutter={[20, 20]}>
            {cashAccounts.map(acc => (
              <Col span={6} key={acc.id}>
                <div
                  className="ui-surface p-5 cursor-pointer flex flex-col justify-between h-full bg-white border-slate-100"
                  onClick={() => { setSelectedAccount(acc); }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl bg-${acc.type === 'bank' ? 'blue' : acc.type === 'momo' ? 'purple' : 'emerald'}-50 text-${acc.type === 'bank' ? 'blue' : acc.type === 'momo' ? 'purple' : 'emerald'}-600 text-xl`}>
                      {acc.type === 'bank' && <BankOutlined />}
                      {acc.type === 'cash' && <WalletOutlined />}
                      {acc.type === 'momo' && <CreditCardOutlined />}
                    </div>
                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{acc.type}</Text>
                  </div>
                  <div>
                    <Text strong className="text-slate-900 block mb-1">{acc.name}</Text>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className={`text-xl font-black ${(acc.balance || 0) >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{acc.balance?.toLocaleString()}</span>
                      <span className="text-xs font-bold text-slate-400">đ</span>
                    </div>
                    {acc.type === 'bank' && acc.account_number && (
                      <Text className="text-[10px] text-slate-400 font-mono block truncate">{acc.bank_name} • {acc.account_number}</Text>
                    )}
                  </div>
                </div>
              </Col>
            ))}
          </Row>

          <div className="premium-shadow rounded-[28px] overflow-hidden">
            <Table columns={accountColumns} dataSource={cashAccounts} rowKey="id" pagination={false} className="designer-table" />
          </div>
        </div>
      )
    },
    {
      key: '3',
      label: <span><BarChartOutlined /> Báo cáo</span>,
      children: (
        <div className="space-y-8">
          <Row gutter={[24, 24]}>
            <Col span={12}>
              <div className="ui-surface p-6 bg-white border-slate-100">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><BarChartOutlined /></div>
                  <Text className="premium-label text-slate-900">Thu chi theo ngày (14 ngày gần nhất)</Text>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getDailyData()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                    <Tooltip cursor={{ stroke: '#0047ab', strokeWidth: 2 }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} formatter={(v: any) => v?.toLocaleString() + ' đ'} />
                    <Legend iconType="circle" />
                    <Line type="monotone" dataKey="thu" stroke="#10b981" name="Thu" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="chi" stroke="#f43f5e" name="Chi" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Col>
            <Col span={12}>
              <div className="ui-surface p-6 bg-white border-slate-100">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><FundOutlined /></div>
                  <Text className="premium-label text-slate-900">Chi theo danh mục</Text>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={getCategoryData()} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={60} paddingAngle={5} cornerRadius={8}>
                      {getCategoryData().map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} formatter={(v: any) => v?.toLocaleString() + ' đ'} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Col>
          </Row>
          <div className="ui-surface p-6 bg-white border-slate-100">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><WalletOutlined /></div>
              <Text className="premium-label text-slate-900">Số dư theo tài khoản</Text>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getAccountBalanceData()} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} formatter={(v: any) => v?.toLocaleString() + ' đ'} />
                <Bar dataKey="balance" fill="url(#barGradient)" radius={[8, 8, 0, 0]}>
                  {getAccountBalanceData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.balance >= 0 ? '#0047ab' : '#d62828'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in">
      <div className="flex justify-between items-end">
        <div>
          <Title level={2} className="m-0 font-black tracking-tight text-slate-900">
            MASTER <span className="text-emerald-600">FINANCE</span>
          </Title>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 w-8 bg-emerald-600 rounded-full" />
            <Text className="premium-label text-slate-400">Dòng tiền • Thu chi & Sổ quỹ doanh nghiệp</Text>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button icon={<FileExcelOutlined />} onClick={exportToExcel} className="h-12 px-6 rounded-2xl font-bold border-slate-200">XUẤT EXCEL</Button>
          <Button icon={<SwapOutlined />} onClick={() => setTransferModalVisible(true)} className="h-12 px-6 rounded-2xl font-bold border-slate-200">CHUYỂN KHOẢN</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setTransactionModalVisible(true)}
            className="h-12 px-8 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 shadow-lg border-none"
          >
            TẠO GIAO DỊCH
          </Button>
        </div>
      </div>

      <div className="bg-transparent border-none">
        <Tabs defaultActiveKey="1" items={tabItems} centered className="premium-tabs-layout mt-4" />
      </div>

      {/* Transaction Modal */}
      <Modal
        title={
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><DollarOutlined /></div>
            <div>
              <div className="text-lg font-black text-slate-900 leading-tight">TẠO GIAO DỊCH</div>
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Financial Entry</Text>
            </div>
          </div>
        }
        open={transactionModalVisible}
        onCancel={() => setTransactionModalVisible(false)}
        footer={null}
        width={600}
        centered
        className="premium-modal no-padding-body"
      >
        <div className="p-8">
          <Form form={form} layout="vertical" onFinish={handleCreateTransaction} initialValues={{ type: 'income', transaction_date: dayjs() }}>
            <Form.Item name="type" label="Loại giao dịch">
              <Segmented block options={[{ label: 'THU TIỀN', value: 'income' }, { label: 'CHI TIỀN', value: 'expense' }]} />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="category_id" label="Danh mục" rules={[{ required: true }]}>
                  <Select placeholder="Chọn danh mục">
                    {categories.filter(c => c.type === form.getFieldValue('type')).map(c => (
                      <Option key={c.id} value={c.id}>{c.name}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="cash_account_id" label="Tài khoản" rules={[{ required: true }]}>
                  <Select placeholder="Chọn tài khoản">
                    {cashAccounts.map(a => (
                      <Option key={a.id} value={a.id}>{a.name} ({a.type === 'bank' ? a.bank_name : a.type})</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="amount" label="Số tiền" rules={[{ required: true }]}>
                  <InputNumber className="w-full" min={0} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="transaction_date" label="Ngày giao dịch">
                  <DatePicker className="w-full" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="customer_id" label="Khách hàng">
                  <Select placeholder="Chọn khách hàng" allowClear showSearch filterOption={(i, o) => (o?.children as any || '').toLowerCase().includes(i.toLowerCase())}>
                    {customers.map(c => <Option key={c.id} value={c.id}>{c.name} ({c.code})</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="order_id" label="Đơn hàng">
                  <Select placeholder="Chọn đơn hàng" allowClear showSearch filterOption={(i, o) => (o?.children as any || '').toLowerCase().includes(i.toLowerCase())}>
                    {orders.map(o => <Option key={o.id} value={o.id}>{o.code} - {o.title}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="reference_type" label="Mục đích">
              <Select placeholder="Chọn mục đích">
                {Object.entries(REFERENCE_LABELS).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="description" label="Mô tả">
              <TextArea rows={2} placeholder="Nội dung giao dịch..." />
            </Form.Item>
            <Form.Item name="note" label="Ghi chú">
              <TextArea rows={1} placeholder="Ghi chú thêm..." />
            </Form.Item>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setTransactionModalVisible(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={saving}>Tạo giao dịch</Button>
            </div>
          </Form>
        </div>
      </Modal>

      {/* Account Modal */}
      <Modal
        title={editingAccount ? 'Sửa tài khoản' : 'Thêm tài khoản'}
        open={accountModalVisible}
        onCancel={() => { setAccountModalVisible(false); setEditingAccount(null); }}
        footer={null}
        width={500}
      >
        <Form form={accountForm} layout="vertical" onFinish={handleSaveAccount}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="code" label="Mã tài khoản" rules={[{ required: true }]}>
                <Input placeholder="VD: TK-TM-2" disabled={!!editingAccount} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label="Tên tài khoản" rules={[{ required: true }]}>
                <Input placeholder="VD: Tiền mặt quỹ chính" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="type" label="Loại tài khoản" rules={[{ required: true }]}>
            <Select>
              <Option value="cash">Tiền mặt</Option>
              <Option value="bank">Tài khoản ngân hàng</Option>
              <Option value="momo">Ví điện tử (MoMo, ZaloPay...)</Option>
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="bank_name" label="Tên ngân hàng">
                <Input placeholder="VD: Vietcombank" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="account_number" label="Số tài khoản">
                <Input placeholder="Số tài khoản" />
              </Form.Item>
            </Col>
          </Row>
          {!editingAccount && (
            <Form.Item name="balance" label="Số dư ban đầu">
              <InputNumber className="w-full" min={0} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            </Form.Item>
          )}
          <Form.Item name="note" label="Ghi chú">
            <TextArea rows={2} placeholder="Ghi chú..." />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => { setAccountModalVisible(false); setEditingAccount(null); }}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={saving}>{editingAccount ? 'Cập nhật' : 'Tạo tài khoản'}</Button>
          </div>
        </Form>
      </Modal>

      {/* Transfer Modal */}
      <Modal
        title="Chuyển khoản nội bộ"
        open={transferModalVisible}
        onCancel={() => setTransferModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={transferForm} layout="vertical" onFinish={handleTransfer} initialValues={{ transfer_date: dayjs() }}>
          <Form.Item name="from_account_id" label="Từ tài khoản" rules={[{ required: true }]}>
            <Select placeholder="Chọn tài khoản nguồn">
              {cashAccounts.map(a => <Option key={a.id} value={a.id}>{a.name} - Số dư: {a.balance?.toLocaleString()} đ</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="to_account_id" label="Đến tài khoản" rules={[{ required: true }]}>
            <Select placeholder="Chọn tài khoản đích">
              {cashAccounts.map(a => <Option key={a.id} value={a.id}>{a.name} - Số dư: {a.balance?.toLocaleString()} đ</Option>)}
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="amount" label="Số tiền" rules={[{ required: true }]}>
                <InputNumber className="w-full" min={0} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="transfer_date" label="Ngày chuyển">
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Ghi chú">
            <TextArea rows={2} placeholder="Lý do chuyển khoản..." />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setTransferModalVisible(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Chuyển khoản</Button>
          </div>
        </Form>
      </Modal>

      {/* Transaction Detail Modal */}
      <Modal
        title={`Chi tiết giao dịch: ${selectedTransaction?.code || ''}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedTransaction && (
          <Tabs items={[
            {
              key: '1',
              label: 'Thông tin',
              children: (
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="Mã GD">{selectedTransaction.code}</Descriptions.Item>
                  <Descriptions.Item label="Ngày">{dayjs(selectedTransaction.transaction_date).format('DD/MM/YYYY')}</Descriptions.Item>
                  <Descriptions.Item label="Loại">
                    <Tag color={TYPE_LABELS[selectedTransaction.type]?.color}>{TYPE_LABELS[selectedTransaction.type]?.label}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Trạng thái">
                    <Tag color={selectedTransaction.status === 'completed' ? 'green' : 'red'}>
                      {selectedTransaction.status === 'completed' ? 'Hoàn thành' : 'Đã hủy'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Danh mục">{selectedTransaction.category?.name}</Descriptions.Item>
                  <Descriptions.Item label="Tài khoản">{selectedTransaction.cash_account?.name}</Descriptions.Item>
                  <Descriptions.Item label="Số tiền">
                    <Text strong style={{ color: selectedTransaction.type === 'income' ? '#52c41a' : '#f5222d', fontSize: 16 }}>
                      {selectedTransaction.type === 'income' ? '+' : '-'}{selectedTransaction.amount?.toLocaleString()} đ
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Mục đích">{REFERENCE_LABELS[selectedTransaction.reference_type] || 'Khác'}</Descriptions.Item>
                  <Descriptions.Item label="Khách hàng">{selectedTransaction.customer?.name || '---'}</Descriptions.Item>
                  <Descriptions.Item label="Đơn hàng">{selectedTransaction.order?.code || '---'}</Descriptions.Item>
                  <Descriptions.Item label="Mô tả" span={2}>{selectedTransaction.description || '---'}</Descriptions.Item>
                  <Descriptions.Item label="Ghi chú" span={2}>{selectedTransaction.note || '---'}</Descriptions.Item>
                  <Descriptions.Item label="Ngày tạo">{dayjs(selectedTransaction.created_at).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
                </Descriptions>
              )
            },
            {
              key: '2',
              label: 'Thao tác',
              children: (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <Text type="secondary">Các thao tác có thể thực hiện:</Text>
                  </div>
                  <Space>
                    {selectedTransaction.status === 'completed' && (
                      <Popconfirm
                        title="Hủy giao dịch này? Số dư tài khoản sẽ được hoàn lại."
                        onConfirm={async () => {
                          await supabase.from('transactions').update({ status: 'cancelled' }).eq('id', selectedTransaction.id);
                          message.success('Đã hủy giao dịch');
                          setDetailModalVisible(false);
                          fetchData();
                        }}
                      >
                        <Button danger icon={<CloseOutlined />}>Hủy giao dịch</Button>
                      </Popconfirm>
                    )}
                    <Popconfirm
                      title="Xóa vĩnh viễn giao dịch này?"
                      onConfirm={() => handleDeleteTransaction(selectedTransaction.id)}
                    >
                      <Button danger icon={<DeleteOutlined />}>Xóa</Button>
                    </Popconfirm>
                  </Space>
                </div>
              )
            }
          ]} />
        )}
      </Modal>
    </div>
  );
}