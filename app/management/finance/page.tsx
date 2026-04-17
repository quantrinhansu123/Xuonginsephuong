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
  SwapOutlined
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
      form.resetFields();
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
        <div className="space-y-4">
          <Row gutter={16}>
            <Col span={6}>
              <Card className="bg-green-50 border-green-100">
                <Statistic title="Tổng thu" value={stats.totalIn} suffix="đ" styles={{ content: { color: '#52c41a', fontWeight: 'bold' } }} prefix={<ArrowUpOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="bg-red-50 border-red-100">
                <Statistic title="Tổng chi" value={stats.totalOut} suffix="đ" styles={{ content: { color: '#f5222d', fontWeight: 'bold' } }} prefix={<ArrowDownOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="bg-blue-50 border-blue-100">
                <Statistic title="Dòng tiền ròng" value={stats.netFlow} suffix="đ" styles={{ content: { color: stats.netFlow >= 0 ? '#1890ff' : '#f5222d', fontWeight: 'bold' } }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="bg-orange-50 border-orange-100">
                <Statistic title="Số giao dịch" value={stats.transactionCount} suffix="lần" styles={{ content: { color: '#fa8c16', fontWeight: 'bold' } }} />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} align="middle">
            <Col span={6}>
              <Input prefix={<SearchOutlined />} placeholder="Tìm kiếm..." value={search} onChange={e => setSearch(e.target.value)} allowClear />
            </Col>
            <Col span={4}>
              <Select className="w-full" value={typeFilter} onChange={setTypeFilter}>
                <Option value="all">Tất cả loại</Option>
                <Option value="income">Thu</Option>
                <Option value="expense">Chi</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select className="w-full" value={categoryFilter} onChange={setCategoryFilter} allowClear placeholder="Danh mục">
                <Option value="all">Tất cả DM</Option>
                {categories.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
              </Select>
            </Col>
            <Col span={4}>
              <Select className="w-full" value={accountFilter} onChange={setAccountFilter} allowClear placeholder="Tài khoản">
                <Option value="all">Tất cả TK</Option>
                {cashAccounts.map(a => <Option key={a.id} value={a.id}>{a.name}</Option>)}
              </Select>
            </Col>
            <Col span={4}>
              <RangePicker className="w-full" onChange={d => setDateRange(d as any)} />
            </Col>
            <Col span={2}>
              <Button icon={<ReloadOutlined />} onClick={fetchData} block />
            </Col>
          </Row>

          <Table 
            columns={transactionColumns} 
            dataSource={transactions} 
            rowKey="id" 
            loading={loading} 
            pagination={{ pageSize: 15 }}
            scroll={{ x: 1200 }}
          />
        </div>
      )
    },
    {
      key: '2',
      label: <span><WalletOutlined /> Sổ quỹ</span>,
      children: (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Title level={5} className="m-0">Danh sách tài khoản</Title>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingAccount(null); accountForm.resetFields(); setAccountModalVisible(true); }}>
              Thêm tài khoản
            </Button>
          </div>
          
          <Row gutter={16}>
            {cashAccounts.map(acc => (
              <Col span={6} key={acc.id}>
                <Card 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => { setSelectedAccount(acc); }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {acc.type === 'bank' && <BankOutlined className="text-blue-500 text-lg" />}
                    {acc.type === 'cash' && <WalletOutlined className="text-green-500 text-lg" />}
                    {acc.type === 'momo' && <CreditCardOutlined className="text-purple-500 text-lg" />}
                    <Text strong>{acc.name}</Text>
                  </div>
                  <Statistic 
                    value={acc.balance || 0} 
                    suffix="đ" 
                    styles={{ content: { color: (acc.balance || 0) >= 0 ? '#1890ff' : '#f5222d', fontWeight: 'bold', fontSize: 20 } }}
                  />
                  {acc.type === 'bank' && acc.account_number && (
                    <Text type="secondary" className="text-xs">{acc.bank_name} - {acc.account_number}</Text>
                  )}
                </Card>
              </Col>
            ))}
          </Row>

          <Table columns={accountColumns} dataSource={cashAccounts} rowKey="id" pagination={false} />
        </div>
      )
    },
    {
      key: '3',
      label: <span><BarChartOutlined /> Báo cáo</span>,
      children: (
        <div className="space-y-6">
          <Row gutter={16}>
            <Col span={12}>
              <Card title="Thu chi theo ngày (14 ngày gần nhất)">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getDailyData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} />
                    <Tooltip formatter={(v: any) => v?.toLocaleString() + ' đ'} />
                    <Legend />
                    <Line type="monotone" dataKey="thu" stroke="#52c41a" name="Thu" strokeWidth={2} />
                    <Line type="monotone" dataKey="chi" stroke="#f5222d" name="Chi" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Chi theo danh mục">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={getCategoryData()} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}>
                      {getCategoryData().map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => v?.toLocaleString() + ' đ'} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Card title="Số dư theo tài khoản">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getAccountBalanceData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} />
                    <Tooltip formatter={(v: any) => v?.toLocaleString() + ' đ'} />
                    <Bar dataKey="balance" fill="#1890ff" name="Số dư" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <Title level={3} className="m-0"><DollarOutlined className="text-green-600" /> Quản lý Tài chính</Title>
          <Text type="secondary">Theo dõi thu chi, sổ quỹ và báo cáo tài chính</Text>
        </div>
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={exportToExcel}>Xuất Excel</Button>
          <Button icon={<SwapOutlined />} onClick={() => setTransferModalVisible(true)}>Chuyển khoản</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setTransactionModalVisible(true); }}>Tạo giao dịch</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Làm mới</Button>
        </Space>
      </div>

      <Card className="shadow-sm">
        <Tabs defaultActiveKey="1" items={tabItems} />
      </Card>

      {/* Transaction Modal */}
      <Modal
        title="Tạo giao dịch thu/chi"
        open={transactionModalVisible}
        onCancel={() => setTransactionModalVisible(false)}
        footer={null}
        width={600}
      >
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