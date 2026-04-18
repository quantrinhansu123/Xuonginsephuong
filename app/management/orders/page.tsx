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
      render: (text: string) => <Text strong className="text-blue-600">{text}</Text>,
    },
    {
      title: 'Khách hàng',
      dataIndex: ['customers', 'name'],
      key: 'customer',
      render: (name: string) => <Text>{name}</Text>,
    },
    {
      title: 'Nội dung in',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Số lượng',
      key: 'quantity',
      render: (record: any) => `${record.specs?.quantity?.toLocaleString()} ${record.specs?.unit}`,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = status === 'completed' ? 'green' : status === 'in_progress' ? 'blue' : 'orange';
        let icon = status === 'completed' ? <CheckCircleOutlined /> : status === 'in_progress' ? <ClockCircleOutlined /> : <WarningOutlined />;
        return <Tag color={color} icon={icon}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Tiền thu',
      key: 'financials',
      render: (record: any) => {
        const received = record.financials?.received || 0;
        const total = record.financials?.total_with_vat || 0;
        const percent = total > 0 ? Math.round((received / total) * 100) : 0;
        return (
          <Tooltip title={`${received.toLocaleString()} / ${total.toLocaleString()} đ`}>
            <Progress percent={percent} size="small" status={percent === 100 ? 'success' : 'active'} />
          </Tooltip>
        );
      },
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
      fixed: 'right' as const,
      width: 100,
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="Xem chi tiết">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
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
    <div className="space-y-6">
      <div className="ui-surface flex justify-between items-center p-5">
        <div>
          <Title level={3} className="m-0 ui-section-title">Lệnh Sản Xuất</Title>
          <Text type="secondary">Quản lý và theo dõi tiến độ các đơn hàng sản xuất</Text>
        </div>
        <Space size="middle">
          <Button icon={<FileExcelOutlined />} onClick={exportToExcel}>Xuất Excel ({filteredData.length})</Button>
          <Button icon={<FilePdfOutlined />} onClick={exportToPDF}>Xuất PDF</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            Lên Lệnh Mới
          </Button>
        </Space>
      </div>

      <Card className="ui-surface border-none p-2" bodyStyle={{ padding: 18 }}>
        <Row gutter={16} align="middle" className="mb-4">
          <Col span={6}>
            <Input 
              prefix={<SearchOutlined />} 
              placeholder="Tìm theo mã đơn, khách hàng, nội dung..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              onPressEnter={fetchOrders}
              allowClear
            />
          </Col>
          <Col span={4}>
            <Select 
              className="w-full" 
              value={statusFilter} 
              onChange={setStatusFilter}
              suffixIcon={<FilterOutlined />}
            >
              <Option value="all">Tất cả trạng thái</Option>
              <Option value="pending">Chờ xử lý</Option>
              <Option value="in_progress">Đang sản xuất</Option>
              <Option value="completed">Đã hoàn thành</Option>
            </Select>
          </Col>
          <Col span={8}>
            <RangePicker 
              className="w-full" 
              placeholder={['Từ ngày', 'Đến ngày']}
              onChange={(dates) => setDateRange(dates as any)}
            />
          </Col>
          <Col span={4}>
            <Button icon={<ReloadOutlined />} onClick={fetchOrders} block>Làm mới</Button>
          </Col>
        </Row>

        <div className="mb-4 flex items-center justify-between">
          <Tag color="blue" className="px-3 py-1 font-medium">Đang hiển thị: {filteredData.length} / {data.length} đơn hàng</Tag>
          <Text type="secondary">Dữ liệu cập nhật theo thời gian thực</Text>
        </div>

        <Table 
          columns={columns} 
          dataSource={filteredData} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: true, showTotal: (total) => `Tổng ${total} đơn hàng` }}
          className="designer-table"
          scroll={{ x: 1200 }}
        />
      </Card>

      <CreateOrderModal visible={createModalVisible} onClose={() => { setCreateModalVisible(false); fetchOrders(); }} />
      <OrderDetailModal visible={detailModalVisible} order={selectedOrder} onClose={() => setDetailModalVisible(false)} />

    </div>
  );
}
