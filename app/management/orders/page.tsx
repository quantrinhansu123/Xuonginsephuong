'use client';

import React, { useState, useEffect } from 'react';
import { 
  Table, Input, Button, Space, Tag, Card, Typography, 
  Row, Col, Select, message, Tooltip, Progress, DatePicker, Popconfirm
} from 'antd';
import { 
  SearchOutlined, 
  PlusOutlined, 
  FileExcelOutlined, 
  FilePdfOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  FilterOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import CreateOrderModal from '@/components/orders/CreateOrderModal';
import OrderDetailModal from '@/components/orders/OrderDetailModal';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function OrdersPage() {
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('production_orders')
        .select(`
          *,
          customers (name, phone)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data: orders, error } = await query;
      if (error) throw error;
      
      let filtered = orders || [];
      
      // Search filter
      if (search) {
        filtered = filtered.filter(o => 
          o.code.toLowerCase().includes(search.toLowerCase()) ||
          o.title.toLowerCase().includes(search.toLowerCase()) ||
          o.customers?.name?.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Date range filter
      if (dateRange) {
        filtered = filtered.filter(o => {
          const created = dayjs(o.created_at);
          return created.isAfter(dateRange[0].startOf('day')) && created.isBefore(dateRange[1].endOf('day'));
        });
      }

      setData(orders || []);
      setFilteredData(filtered);
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi tải danh sách đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, dateRange]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('production_orders')
        .delete()
        .eq('id', id);
      if (error) throw error;
      message.success('Đã xóa đơn hàng');
      fetchOrders();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi xóa đơn hàng');
    }
  };

  // Export filtered data
  const exportToExcel = () => {
    const exportData = filteredData.map(o => ({
      "Mã đơn": o.code,
      "Khách hàng": o.customers?.name,
      "Nội dung": o.title,
      "Số lượng": o.specs?.quantity,
      "Đơn vị": o.specs?.unit,
      "Khổ giấy": o.specs?.size,
      "Trạng thái": o.status.toUpperCase(),
      "Tổng tiền": o.financials?.total_with_vat?.toLocaleString(),
      "Đã thu": o.financials?.received?.toLocaleString(),
      "Ngày tạo": new Date(o.created_at).toLocaleDateString('vi-VN')
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, `LSX_DonHang_${new Date().toISOString().split('T')[0]}.xlsx`);
    message.success(`Đã xuất ${filteredData.length} đơn hàng ra Excel`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF() as any;
    const tableColumn = ["Ma don", "Khach hang", "Noi dung", "SL", "Trang thai", "Ngay"];
    const tableRows = filteredData.map(o => [
      o.code,
      o.customers?.name || "",
      o.title?.substring(0, 30),
      o.specs?.quantity,
      o.status,
      new Date(o.created_at).toLocaleDateString('vi-VN')
    ]);

    doc.autoTable(tableColumn, tableRows, { startY: 20 });
    doc.text(`DANH SACH LENH SAN XUAT - ${filteredData.length} DON`, 14, 15);
    doc.save(`LSX_DonHang_${new Date().toISOString().split('T')[0]}.pdf`);
    message.success(`Đã xuất ${filteredData.length} đơn hàng ra PDF`);
  };

  const columns = [
    {
      title: 'Mã Đơn',
      dataIndex: 'code',
      key: 'code',
      onCell: () => ({ 'data-label': 'Mã Đơn' } as any),
      render: (text: string) => <Text strong className="text-blue-600 font-mono tracking-tighter">{text}</Text>,
    },
    {
      title: 'Khách hàng',
      dataIndex: ['customers', 'name'],
      key: 'customer',
      onCell: () => ({ 'data-label': 'Khách hàng' } as any),
      render: (name: string) => <Text className="font-bold text-slate-800 leading-tight">{name}</Text>,
    },
    {
      title: 'Nội dung in',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      onCell: () => ({ 'data-label': 'Nội dung' } as any),
    },
    {
      title: 'Số lượng',
      key: 'quantity',
      onCell: () => ({ 'data-label': 'Số lượng' } as any),
      render: (record: any) => (
        <span className="font-bold text-slate-600">
          {record.specs?.quantity?.toLocaleString()} <span className="text-[10px] text-slate-400 uppercase">{record.specs?.unit}</span>
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      onCell: () => ({ 'data-label': 'Tình trạng' } as any),
      render: (status: string) => {
        const configs: any = {
          completed: { color: 'emerald', icon: <CheckCircleOutlined />, label: 'HOÀN TẤT' },
          in_progress: { color: 'blue', icon: <ClockCircleOutlined />, label: 'PRODUCTION' },
          pending: { color: 'amber', icon: <WarningOutlined />, label: 'CHỜ XỬ LÝ' }
        };
        const cfg = configs[status] || { color: 'slate', icon: <ClockCircleOutlined />, label: status.toUpperCase() };
        return <Tag color={cfg.color} icon={cfg.icon} className="rounded-lg border-none font-bold px-3 py-0.5">{cfg.label}</Tag>;
      },
    },
    {
      title: 'Thanh toán',
      key: 'financials',
      width: 150,
      onCell: () => ({ 'data-label': 'Thu tiền' } as any),
      render: (record: any) => {
        const received = record.financials?.received || 0;
        const total = record.financials?.total_with_vat || 0;
        const percent = total > 0 ? Math.round((received / total) * 100) : 0;
        return (
          <div className="w-full min-w-[100px]">
            <Progress 
              percent={percent} 
              size="small" 
              strokeColor={percent === 100 ? '#10b981' : '#6366f1'} 
              format={p => <span className="text-[10px] font-bold text-slate-500">{p}%</span>}
            />
          </div>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      fixed: 'right' as const,
      width: 100,
      onCell: () => ({ 'data-label': 'Thao tác' } as any),
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="Xem chi tiết">
            <Button 
              type="text" 
              icon={<EyeOutlined className="text-slate-400" />} 
              onClick={() => { setSelectedOrder(record); setDetailModalVisible(true); }} 
            />
          </Tooltip>
          <Popconfirm title="Xóa đơn hàng này?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy">
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
            MASTER <span className="text-indigo-600 uppercase">ORDERS</span>
          </Title>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 w-8 bg-indigo-600 rounded-full" />
            <Text className="premium-label text-slate-400">Điều hành sản xuất • Quản lý tiến độ & Tài chính</Text>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Button icon={<FileExcelOutlined />} onClick={exportToExcel} className="h-12 flex-1 sm:flex-none px-6 rounded-2xl font-bold border-slate-200">EXCEL</Button>
          <Button icon={<FilePdfOutlined />} onClick={exportToPDF} className="h-12 flex-1 sm:flex-none px-6 rounded-2xl font-bold border-slate-200">PDF</Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => setCreateModalVisible(true)}
            className="h-12 w-full sm:w-auto px-8 rounded-2xl font-bold bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 shadow-lg border-none"
          >
            LÊN LỆNH MỚI
          </Button>
        </div>
      </div>

      <div className="glass-card p-4 rounded-[28px] grid grid-cols-12 gap-4 items-center">
        <div className="col-span-12 lg:col-span-4">
          <Input 
            prefix={<SearchOutlined className="text-slate-400" />} 
            placeholder="Mã đơn, khách hàng, nội dung..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            onPressEnter={fetchOrders}
            className="premium-select h-11"
            allowClear
          />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <Select 
            className="w-full premium-select" 
            value={statusFilter} 
            onChange={setStatusFilter}
          >
            <Option value="all">TẤT CẢ TRẠNG THÁI</Option>
            <Option value="pending">CHỜ XỨ LÝ</Option>
            <Option value="in_progress">ĐANG SẢN XUẤT</Option>
            <Option value="completed">ĐÃ HOÀN THÀNH</Option>
          </Select>
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <RangePicker 
            className="w-full premium-datepicker" 
            placeholder={['Từ ngày', 'Đến ngày']}
            onChange={(dates) => setDateRange(dates as any)}
          />
        </div>
        <div className="col-span-12 sm:col-span-12 lg:col-span-2">
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchOrders} 
            className="h-11 w-full rounded-xl border-slate-200 font-bold flex items-center justify-center bg-white" 
          >
            LÀM MỚI
          </Button>
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

      <CreateOrderModal visible={createModalVisible} onClose={() => { setCreateModalVisible(false); fetchOrders(); }} />
      <OrderDetailModal visible={detailModalVisible} order={selectedOrder} onClose={() => setDetailModalVisible(false)} />
    </div>
  );
}
