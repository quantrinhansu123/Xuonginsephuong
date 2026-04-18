'use client';

import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Typography, Row, Col, Space, Button, 
  Input, Form, Modal, InputNumber, Select, Tag, message, 
  Tabs, Statistic, Badge, Alert, Empty, Segmented
} from 'antd';
import { 
  DatabaseOutlined, 
  PlusOutlined, 
  HistoryOutlined, 
  CalculatorOutlined, 
  WarningOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ReloadOutlined,
  SearchOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import dayjs from 'dayjs';
import A4Calculator from '@/components/warehouse/A4Calculator';
import MaterialDetailModal from '@/components/warehouse/MaterialDetailModal';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const { Title, Text } = Typography;
const { Option } = Select;

export default function WarehousePage() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [materialModalVisible, setMaterialModalVisible] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [form] = Form.useForm();
  const [exportType, setExportType] = useState('import');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: mats } = await supabase.from('materials').select('*').order('name', { ascending: true });
      setMaterials(mats || []);

      const { data: logData } = await supabase.from('inventory_logs')
        .select('*, materials(name, unit), production_orders(code)')
        .order('created_at', { ascending: false }).limit(50);
      setLogs(logData || []);

      const { data: orderData } = await supabase.from('production_orders')
        .select('id, code, title')
        .neq('status', 'completed')
        .order('created_at', { ascending: false });
      setOrders(orderData || []);

    } catch (err) {
      console.error(err);
      message.error('Lỗi khi tải dữ liệu kho');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTransaction = async (values: any) => {
    try {
      const { quantity, material_id, type, reason, order_id } = values;
      const mat = materials.find(m => m.id === material_id);
      
      if (type === 'export' && mat.stock_quantity < quantity) {
        return message.error('Tồn kho không đủ để xuất!');
      }

      const { error: logError } = await supabase
        .from('inventory_logs')
        .insert([{
          material_id,
          order_id: type === 'export' ? order_id : null,
          quantity,
          type,
          reason: type === 'export' ? `Cấp phát cho LSX: ${orders.find(o => o.id === order_id)?.code}. ${reason || ''}` : reason,
          created_at: new Date().toISOString()
        }]);
      if (logError) throw logError;

      const newStock = type === 'import' ? mat.stock_quantity + quantity : mat.stock_quantity - quantity;
      const { error: updateError } = await supabase
        .from('materials')
        .update({ stock_quantity: newStock })
        .eq('id', material_id);
      
      if (updateError) throw updateError;

      message.success('Đã cập nhật giao dịch kho');
      setTransactionModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi thực hiện giao dịch');
    }
  };

  const lowStockMaterials = materials.filter(m => m.stock_quantity <= m.min_stock);

  const handleMaterialClick = (material: any) => {
    setSelectedMaterial(material);
    setMaterialModalVisible(true);
  };

  const tabItems = [
    {
      key: '1',
      label: <span><DatabaseOutlined /> Tồn kho thực tế</span>,
      children: (
        <Table 
          columns={[
            { title: 'Vật tư', dataIndex: 'name', key: 'name', render: (t: string) => <Text strong>{t}</Text> },
            { title: 'Đơn vị', dataIndex: 'unit', key: 'unit' },
            { 
              title: 'Tồn kho', 
              dataIndex: 'stock_quantity', 
              key: 'stock_quantity', 
              render: (q: number, record: any) => (
                <Text strong className={q <= record.min_stock ? 'text-red-600' : 'text-blue-600'}>
                  {q.toLocaleString()}
                </Text>
              )
            },
            { title: 'Ngưỡng t.thiểu', dataIndex: 'min_stock', key: 'min_stock' },
            { 
              title: 'Trạng thái', 
              key: 'status',
              render: (_: any, record: any) => (
                record.stock_quantity <= record.min_stock 
                  ? <Tag color="red" icon={<WarningOutlined />}>BÁO ĐỘNG HẾT HÀNG</Tag> 
                  : <Tag color="green">ĐỦ HÀNG</Tag>
              )
            },
            {
              title: 'Thao tác',
              key: 'action',
              width: 80,
              render: (_: any, record: any) => (
                <Button type="text" icon={<EyeOutlined />} onClick={() => handleMaterialClick(record)} />
              ),
            }
          ]} 
          dataSource={materials} 
          rowKey="id" 
          loading={loading} 
        />
      )
    },
    {
      key: '2',
      label: <span><HistoryOutlined /> Nhật ký cấp phát</span>,
      children: (
        <Table 
          columns={[
            { title: 'Thời gian', dataIndex: 'created_at', key: 'created_at', render: (d: string) => dayjs(d).format('DD/MM HH:mm') },
            { title: 'Vật tư', dataIndex: ['materials', 'name'], key: 'material' },
            { title: 'LSX Liên kết', dataIndex: ['production_orders', 'code'], key: 'lsx', render: (v: string) => v ? <Tag color="blue">{v}</Tag> : '---' },
            { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', align: 'right' as const, render: (q: number, r: any) => <Text strong color={r.type === 'import' ? 'green' : 'red'}>{r.type === 'import' ? '+' : '-'}{q.toLocaleString()}</Text> },
            { title: 'Ghi chú/Lý do', dataIndex: 'reason', key: 'reason', ellipsis: true }
          ]} 
          dataSource={logs} 
          rowKey="id" 
          loading={loading} 
        />
      )
    },
    {
      key: '3',
      label: <span><CalculatorOutlined /> Quy đổi A4</span>,
      children: <div className="max-w-4xl mx-auto py-10"><A4Calculator /></div>
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <Title level={2} className="m-0 bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">KHO VẬT TƯ CHI TIẾT</Title>
          <Text type="secondary">Cảnh báo tồn kho tối thiểu và liên kết cấp phát LSX</Text>
        </div>
        <Space size="middle">
          <Button icon={<FileExcelOutlined />} onClick={exportMaterialsToExcel} shape="round">Xuất Excel</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setTransactionModalVisible(true)} shape="round" className="bg-blue-600 h-10 px-6 font-bold shadow-lg">GIAO DỊCH KHO</Button>
        </Space>
      </div>

      {lowStockMaterials.length > 0 && (
        <Alert
          message={<Text strong className="text-red-800">CẢNH BÁO TỒN KHO DƯỚI NGƯỠNG AN TOÀN</Text>}
          description={
            <div className="mt-2">
              {lowStockMaterials.map(m => <Tag key={m.id} color="red" className="mb-1">{m.name}: Chỉ còn {m.stock_quantity} {m.unit}</Tag>)}
            </div>
          }
          type="error"
          showIcon
          icon={<WarningOutlined className="text-xl" />}
          className="border-red-200 bg-red-50 rounded-2xl shadow-sm"
        />
      )}

      <Row gutter={24}>
        <Col span={8}><Card className="shadow-sm rounded-2xl text-center items-center flex flex-col pointer-events-none border-blue-100 bg-blue-50/50"><Statistic title="Tổng vật tư" value={materials.length} prefix={<DatabaseOutlined />} /></Card></Col>
        <Col span={8}><Card className="shadow-sm rounded-2xl text-center items-center flex flex-col pointer-events-none border-red-100 bg-red-50/50"><Statistic title="Sắp hết hàng" value={lowStockMaterials.length} prefix={<WarningOutlined />} valueStyle={{ color: '#ef4444' }} /></Card></Col>
        <Col span={8}><Card className="shadow-sm rounded-2xl text-center items-center flex flex-col pointer-events-none border-green-100 bg-green-50/50"><Statistic title="Hoàn thành cấp phát (24h)" value={logs.filter(l => l.type === 'export').length} prefix={<ArrowDownOutlined />} /></Card></Col>
      </Row>

      <Tabs defaultActiveKey="1" items={tabItems} className="warehouse-tabs bg-white p-6 rounded-2xl shadow-sm border border-gray-100" />

      <MaterialDetailModal
        visible={materialModalVisible}
        material={selectedMaterial}
        onClose={() => { setMaterialModalVisible(false); fetchData(); }}
        onRefresh={fetchData}
      />

      <Modal
        title={
          <Space className="p-2">
            <div className="bg-blue-100 p-2 rounded-lg"><PlusOutlined className="text-blue-600" /></div>
            <Text strong className="text-lg">Tạo giao dịch kho</Text>
          </Space>
        }
        open={transactionModalVisible}
        onCancel={() => setTransactionModalVisible(false)}
        footer={null}
        width={500}
        centered
        className="transaction-modal"
      >
        <Form form={form} layout="vertical" onFinish={handleTransaction} initialValues={{ type: 'import' }} onValuesChange={(v) => v.type && setExportType(v.type)}>
          <Form.Item name="type" label="Loại giao dịch" rules={[{ required: true }]}>
            <Segmented 
              block 
              options={[
                { label: 'NHẬP KHO', value: 'import', icon: <ArrowUpOutlined /> },
                { label: 'XUẤT KHO / CẤP PHÁT', value: 'export', icon: <ArrowDownOutlined /> }
              ]} 
              className="mb-4"
            />
          </Form.Item>
          <Form.Item name="material_id" label="Vật tư" rules={[{ required: true }]}>
            <Select placeholder="Chọn vật tư trong kho" size="large">
              {materials.map(m => <Option key={m.id} value={m.id}>{m.name} (Tồn: {m.stock_quantity})</Option>)}
            </Select>
          </Form.Item>
          {exportType === 'export' && (
            <Form.Item name="order_id" label="Cấp phát cho Đơn hàng (LSX)" rules={[{ required: true, message: 'Vui lòng chọn LSX liên kết' }]}>
              <Select placeholder="Tìm LSX đang hoạt động..." size="large" showSearch filterOption={(input, option) => (option?.children as any || '').toLowerCase().includes(input.toLowerCase())}>
                {orders.map(o => <Option key={o.id} value={o.id}>{o.code} - {o.title}</Option>)}
              </Select>
            </Form.Item>
          )}
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="quantity" label="Số lượng" rules={[{ required: true }]}>
                <InputNumber min={0.1} className="w-full" size="large" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label="Ghi chú thêm">
            <Input.TextArea rows={2} placeholder="Nội dung diễn giải..." />
          </Form.Item>
          <div className="flex justify-end gap-3 pt-4">
            <Button onClick={() => setTransactionModalVisible(false)} size="large">Hủy</Button>
            <Button type="primary" htmlType="submit" size="large" className="bg-blue-600 px-8">Xác nhận</Button>
          </div>
        </Form>
      </Modal>

      <style jsx global>{`
        .warehouse-tabs .ant-tabs-nav::before { border-bottom: 2px solid #f1f5f9; }
        .warehouse-tabs .ant-tabs-tab-active { font-weight: 900; }
      `}</style>
    </div>
  );

  function exportMaterialsToExcel() {
    const exportData = materials.map(m => ({
      "Vật tư": m.name,
      "Đơn vị": m.unit,
      "Tồn kho": m.stock_quantity,
      "Ngưỡng tối thiểu": m.min_stock,
      "Trạng thái": m.stock_quantity <= m.min_stock ? 'CẦN NHẬP' : 'ĐỦ'
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Materials");
    XLSX.writeFile(wb, `Kho_TonKho_${new Date().toISOString().split('T')[0]}.xlsx`);
    message.success(`Đã xuất ${materials.length} vật tư ra Excel`);
  }
}

