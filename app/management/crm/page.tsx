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
      render: (_: any, record: any) => (
        <Space>
          <UserOutlined className="text-blue-500" />
          <div>
            <div className="font-medium">{record.name}</div>
            <div className="text-xs text-gray-400">{record.code}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'Phân loại',
      dataIndex: 'category',
      key: 'category',
      render: (cat: string) => <Tag color={cat === 'Khách VIP' ? 'gold' : cat === 'Đại lý' ? 'purple' : 'blue'}>{cat}</Tag>,
    },
    {
      title: 'Công nợ hiện tại',
      dataIndex: 'current_debt',
      key: 'debt',
      align: 'right' as const,
      render: (debt: number) => (
        <Text type={debt > 0 ? 'danger' : 'success'} strong>
          {debt?.toLocaleString()} đ
        </Text>
      ),
    },
    {
      title: 'Tổng doanh thu',
      dataIndex: 'total_revenue',
      key: 'revenue',
      align: 'right' as const,
      render: (rev: number) => <Text>{rev?.toLocaleString()} đ</Text>,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="Xem chi tiết">
            <Button type="text" icon={<EyeOutlined />} onClick={() => { setSelectedCustomer(record); setModalVisible(true); }} />
          </Tooltip>
          <Popconfirm title="Xóa khách hàng này?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy">
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in">
      <div className="flex justify-between items-end">
        <div>
          <Title level={2} className="m-0 font-black tracking-tight text-slate-900">
            MASTER <span className="text-indigo-600">CRM</span>
          </Title>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 w-8 bg-indigo-600 rounded-full" />
            <Text className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Quản lý đối tác • Phân tích công nợ & doanh thu</Text>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button icon={<FileExcelOutlined />} onClick={exportToExcel} className="h-12 px-6 rounded-2xl font-bold border-slate-200">XUẤT EXCEL</Button>
          <Button icon={<FilePdfOutlined />} onClick={exportToPDF} className="h-12 px-6 rounded-2xl font-bold border-slate-200">XUẤT PDF</Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => { setSelectedCustomer(null); setModalVisible(true); }}
            className="h-12 px-8 rounded-2xl font-bold shadow-indigo-200 shadow-lg"
          >
            THÊM KHÁCH HÀNG
          </Button>
        </div>
      </div>

      <div className="glass-card p-4 rounded-[28px] grid grid-cols-12 gap-4 items-center">
        <div className="col-span-4">
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
        <div className="col-span-2">
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
        <div className="col-span-2">
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
        <div className="col-span-3">
          <RangePicker 
            className="w-full premium-datepicker" 
            placeholder={['Từ ngày', 'Đến ngày']}
            onChange={(dates) => setDateRange(dates as any)}
          />
        </div>
        <div className="col-span-1">
          <Button icon={<ReloadOutlined />} onClick={fetchCustomers} className="h-11 w-full rounded-xl border-slate-200" />
        </div>
      </div>

      <div className="premium-shadow rounded-[32px] overflow-hidden bg-white">
        <Table 
          columns={columns} 
          dataSource={filteredData} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 12, position: ['bottomCenter'] }}
          className="designer-table"
          scroll={{ x: 'max-content' }}
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
