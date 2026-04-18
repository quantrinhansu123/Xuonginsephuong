'use client';

import React, { useState, useEffect } from 'react';
import { 
  Table, Input, Button, Space, Card, Typography, 
  Row, Col, Select, message, Tag, Tooltip, DatePicker, Popconfirm
} from 'antd';
import { 
  SearchOutlined, 
  PlusOutlined, 
  ReloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  UserOutlined,
  DeleteOutlined,
  EyeOutlined,
  FilterOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import CustomerDetailModal from '@/components/crm/CustomerDetailModal';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function CrmPage() {
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [debtFilter, setDebtFilter] = useState('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      const { data: customers, error } = await query;
      if (error) throw error;
      
      let filtered = customers || [];
      
      // Search filter
      if (search) {
        filtered = filtered.filter(c => 
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.toLowerCase().includes(search.toLowerCase()) ||
          c.phone?.includes(search)
        );
      }

      // Debt filter
      if (debtFilter === 'has_debt') {
        filtered = filtered.filter(c => (c.current_debt || 0) > 0);
      } else if (debtFilter === 'no_debt') {
        filtered = filtered.filter(c => (c.current_debt || 0) === 0);
      } else if (debtFilter === 'high_debt') {
        filtered = filtered.filter(c => (c.current_debt || 0) > 10000000);
      }

      // Date range filter
      if (dateRange) {
        filtered = filtered.filter(c => {
          const created = dayjs(c.created_at);
          return created.isAfter(dateRange[0].startOf('day')) && created.isBefore(dateRange[1].endOf('day'));
        });
      }

      setData(customers || []);
      setFilteredData(filtered);
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi tải danh sách khách hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [categoryFilter, debtFilter, dateRange]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);
      if (error) throw error;
      message.success('Đã xóa khách hàng');
      fetchCustomers();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi xóa khách hàng. Có thể khách hàng này đang có đơn hàng.');
    }
  };

  // Export filtered data
  const exportToExcel = () => {
    const exportData = filteredData.map(c => ({
      "Mã KH": c.code,
      "Tên": c.name,
      "SĐT": c.phone,
      "Địa chỉ": c.address,
      "Phân loại": c.category,
      "Công nợ": c.current_debt,
      "Đã tạm ứng": c.prepaid_amount,
      "Tổng doanh thu": c.total_revenue,
      "Ngày tạo": new Date(c.created_at).toLocaleDateString('vi-VN')
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, `CRM_KhachHang_${new Date().toISOString().split('T')[0]}.xlsx`);
    message.success(`Đã xuất ${filteredData.length} khách hàng ra Excel`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF() as any;
    const tableColumn = ["Ma KH", "Ten", "SDT", "Phan loai", "Cong no"];
    const tableRows = filteredData.map(c => [
      c.code,
      c.name,
      c.phone || "",
      c.category || "",
      c.current_debt?.toLocaleString() + " d"
    ]);

    doc.autoTable(tableColumn, tableRows, { startY: 20 });
    doc.text(`DANH SACH KHACH HANG - ${filteredData.length} KH`, 14, 15);
    doc.save(`CRM_KhachHang_${new Date().toISOString().split('T')[0]}.pdf`);
    message.success(`Đã xuất ${filteredData.length} khách hàng ra PDF`);
  };

  const columns = [
    {
      title: 'Khách hàng',
      key: 'customer',
      onCell: () => ({ 'data-label': 'Khách hàng' } as any),
      render: (_: any, record: any) => (
        <Space>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <UserOutlined />
          </div>
          <div className="text-left">
            <div className="font-bold text-slate-800 leading-tight">{record.name}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{record.code}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      key: 'phone',
      onCell: () => ({ 'data-label': 'SĐT' } as any),
      render: (text: string) => <Text className="font-mono text-slate-600 font-medium">{text || '---'}</Text>
    },
    {
      title: 'Phân loại',
      dataIndex: 'category',
      key: 'category',
      onCell: () => ({ 'data-label': 'Loại' } as any),
      render: (cat: string) => (
        <Tag color={cat === 'Khách VIP' ? 'gold' : cat === 'Đại lý' ? 'purple' : 'blue'} className="rounded-lg border-none font-bold px-3 py-0.5">
          {cat?.toUpperCase() || 'KHÁCH LẺ'}
        </Tag>
      ),
    },
    {
      title: 'Công nợ',
      dataIndex: 'current_debt',
      key: 'debt',
      align: 'right' as const,
      onCell: () => ({ 'data-label': 'Công nợ' } as any),
      render: (debt: number) => (
        <span className={`font-black tracking-tight ${debt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
          {debt?.toLocaleString()} đ
        </span>
      ),
    },
    {
      title: 'Tổng doanh thu',
      dataIndex: 'total_revenue',
      key: 'revenue',
      align: 'right' as const,
      onCell: () => ({ 'data-label': 'Doanh thu' } as any),
      render: (rev: number) => <Text className="font-bold text-slate-600">{rev?.toLocaleString()} đ</Text>,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'created_at',
      key: 'created_at',
      onCell: () => ({ 'data-label': 'Ngày tạo' } as any),
      render: (date: string) => <Text className="text-slate-400 font-medium">{new Date(date).toLocaleDateString('vi-VN')}</Text>,
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      onCell: () => ({ 'data-label': 'Thao tác' } as any),
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="Xem chi tiết">
            <Button type="text" icon={<EyeOutlined className="text-slate-400" />} onClick={() => { setSelectedCustomer(record); setModalVisible(true); }} />
          </Tooltip>
          <Popconfirm title="Xóa khách hàng này?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy">
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in px-4 sm:px-0 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <Title level={2} className="m-0 font-black tracking-tight text-slate-900 leading-tight">
            MASTER <span className="text-indigo-600 uppercase">CRM</span>
          </Title>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 w-8 bg-indigo-600 rounded-full" />
            <Text className="premium-label text-slate-400">Quản lý đối tác • Phân tích công nợ & doanh thu</Text>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Button icon={<FileExcelOutlined />} onClick={exportToExcel} className="h-12 flex-1 sm:flex-none px-6 rounded-2xl font-bold border-slate-200">EXCEL</Button>
          <Button icon={<FilePdfOutlined />} onClick={exportToPDF} className="h-12 flex-1 sm:flex-none px-6 rounded-2xl font-bold border-slate-200">PDF</Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => { setSelectedCustomer(null); setModalVisible(true); }}
            className="h-12 w-full sm:w-auto px-8 rounded-2xl font-bold bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 shadow-lg border-none"
          >
            THÊM KHÁCH HÀNG
          </Button>
        </div>
      </div>

      <div className="glass-card p-4 rounded-[28px] grid grid-cols-12 gap-4 items-center">
        <div className="col-span-12 lg:col-span-4">
          <Input 
            prefix={<SearchOutlined className="text-slate-400" />} 
            placeholder="Tìm theo tên, mã KH, số điện thoại..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            onPressEnter={fetchCustomers}
            className="premium-select h-11"
            allowClear
          />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-2">
          <Select 
            className="w-full premium-select" 
            value={categoryFilter} 
            onChange={setCategoryFilter}
          >
            <Option value="all">Tất cả phân loại</Option>
            <Option value="Khách lẻ">Khách lẻ</Option>
            <Option value="Khách VIP">Khách VIP</Option>
            <Option value="Đại lý">Đại lý</Option>
          </Select>
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-2">
          <Select 
            className="w-full premium-select" 
            value={debtFilter} 
            onChange={setDebtFilter}
          >
            <Option value="all">Tất cả công nợ</Option>
            <Option value="no_debt">Không nợ</Option>
            <Option value="has_debt">Đang nợ</Option>
            <Option value="high_debt">Nợ cao (&gt; 10tr)</Option>
          </Select>
        </div>
        <div className="col-span-12 sm:col-span-10 lg:col-span-3">
          <RangePicker 
            className="w-full premium-datepicker" 
            placeholder={['Từ ngày', 'Đến ngày']}
            onChange={(dates) => setDateRange(dates as any)}
          />
        </div>
        <div className="col-span-12 sm:col-span-2 lg:col-span-1">
          <Button icon={<ReloadOutlined />} onClick={fetchCustomers} className="h-11 w-full rounded-xl border-slate-200 flex items-center justify-center" />
        </div>
      </div>

      <div className="premium-shadow rounded-[32px] overflow-hidden bg-white border border-slate-100">
        <Table 
          
          columns={columns} 
          dataSource={filteredData} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 12, placement: 'bottomCenter' } as any}
          className="designer-table"
        />
      </div>

      <CustomerDetailModal 
        visible={modalVisible} 
        customer={selectedCustomer} 
        onClose={() => { setModalVisible(false); fetchCustomers(); }} 
      />
    </div>
  );
}
