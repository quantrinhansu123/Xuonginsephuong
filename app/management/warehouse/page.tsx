'use client';

import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Typography, Row, Col, Space, Button, 
  Input, Form, Modal, InputNumber, Select, Tag, message, 
  Tabs, Statistic, Badge, Alert, Empty, Segmented, Popconfirm
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
  EyeOutlined,
  EditOutlined,
  DeleteOutlined
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
  const [deletingMaterialId, setDeletingMaterialId] = useState<number | null>(null);

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

      // Đồng bộ snapshot vật tư cấp phát vào production_orders.material_allocations
      if (type === 'export' && order_id && mat) {
        const { data: orderSnapshot, error: orderSnapshotError } = await supabase
          .from('production_orders')
          .select('material_allocations')
          .eq('id', order_id)
          .single();

        if (orderSnapshotError) throw orderSnapshotError;

        const allocations = Array.isArray(orderSnapshot?.material_allocations)
          ? [...orderSnapshot.material_allocations]
          : [];

        const existingIndex = allocations.findIndex((item: any) => item?.material_id === material_id);
        if (existingIndex >= 0) {
          const currentQty = Number(allocations[existingIndex]?.quantity || 0);
          allocations[existingIndex] = {
            ...allocations[existingIndex],
            material_id,
            name: mat.name,
            unit: mat.unit,
            quantity: Number((currentQty + Number(quantity)).toFixed(2)),
          };
        } else {
          allocations.push({
            material_id,
            name: mat.name,
            unit: mat.unit,
            quantity: Number(Number(quantity).toFixed(2)),
          });
        }

        const { error: syncError } = await supabase
          .from('production_orders')
          .update({
            material_allocations: allocations,
            updated_at: new Date().toISOString(),
          })
          .eq('id', order_id);

        if (syncError) throw syncError;
      }

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
  const todayExportCount = logs.filter((l) => l.type === 'export' && dayjs(l.created_at).isSame(dayjs(), 'day')).length;

  const stats = [
    {
      title: 'TỔNG VẬT TƯ',
      value: materials.length,
      icon: <DatabaseOutlined />,
      cardClass: 'border-slate-200 bg-white',
      valueClass: 'text-slate-900',
      iconWrapClass: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
    },
    {
      title: 'SẮP HẾT HÀNG',
      value: lowStockMaterials.length,
      icon: <WarningOutlined />,
      cardClass: lowStockMaterials.length > 0 ? 'border-rose-200 bg-rose-50/70' : 'border-slate-200 bg-white',
      valueClass: lowStockMaterials.length > 0 ? 'text-rose-600' : 'text-slate-900',
      iconWrapClass: lowStockMaterials.length > 0 ? 'bg-rose-100 text-rose-600 border border-rose-200' : 'bg-slate-100 text-slate-500 border border-slate-200',
    },
    {
      title: 'CẤP PHÁT HÔM NAY',
      value: todayExportCount,
      icon: <ArrowDownOutlined />,
      cardClass: 'border-emerald-200 bg-emerald-50/60',
      valueClass: 'text-emerald-700',
      iconWrapClass: 'bg-emerald-100 text-emerald-600 border border-emerald-200',
    },
  ];

  const handleMaterialClick = (material: any) => {
    setSelectedMaterial(material);
    setMaterialModalVisible(true);
  };

  const handleDeleteMaterial = async (material: any) => {
    setDeletingMaterialId(material.id);
    try {
      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', material.id);

      if (error) throw error;
      message.success(`Đã xóa vật tư: ${material.name}`);
      fetchData();
    } catch (err) {
      console.error(err);
      message.error('Không thể xóa vật tư');
    } finally {
      setDeletingMaterialId(null);
    }
  };

  const tabItems = [
    {
      key: '1',
      label: <span className="px-4"><DatabaseOutlined /> Tồn kho thực tế</span>,
      children: (
        <div className="premium-shadow rounded-[28px] overflow-hidden bg-white mt-4 border border-slate-100">
          <Table 
            
            columns={[
              { 
                title: 'Vật tư', 
                dataIndex: 'name', 
                key: 'name', 
                onCell: () => ({ 'data-label': 'Vật tư' } as any),
                render: (t: string) => <Text strong className="text-slate-900">{t}</Text> 
              },
              { title: 'Đơn vị', dataIndex: 'unit', key: 'unit', onCell: () => ({ 'data-label': 'Đơn vị' } as any) },
              { 
                title: 'Tồn kho', 
                dataIndex: 'stock_quantity', 
                key: 'stock_quantity', 
                onCell: () => ({ 'data-label': 'Tồn kho' } as any),
                render: (q: number, record: any) => (
                  <Text strong className={(q || 0) <= (record.min_stock || 0) ? 'text-rose-600 animate-pulse' : 'text-indigo-600 font-mono text-lg'}>
                    {(q || 0).toLocaleString()}
                  </Text>
                )
              },
              { title: 'Ngưỡng t.thiểu', dataIndex: 'min_stock', key: 'min_stock', onCell: () => ({ 'data-label': 'Tối thiểu' } as any), render: (v: number) => <Text className="text-slate-400 font-mono">{v}</Text> },
              { 
                title: 'Trạng thái', 
                key: 'status',
                onCell: () => ({ 'data-label': 'Trạng thái' } as any),
                render: (_: any, record: any) => (
                  record.stock_quantity <= record.min_stock 
                    ? <Tag color="rose" className="border-none font-black px-3 rounded-full uppercase text-[10px]">Cần nhập hàng</Tag> 
                    : <Tag color="emerald" className="border-none font-black px-3 rounded-full uppercase text-[10px]">An toàn</Tag>
                )
              },
              {
                title: 'Thao tác',
                key: 'action',
                width: 140,
                align: 'right' as const,
                onCell: () => ({ 'data-label': 'Thao tác' } as any),
                render: (_: any, record: any) => (
                  <Space size={4}>
                    <Button
                      size="small"
                      className="rounded-lg border-slate-200 text-slate-600"
                      icon={<EditOutlined />}
                      onClick={() => handleMaterialClick(record)}
                    >
                      Sửa
                    </Button>
                    <Popconfirm
                      title="Xóa vật tư này?"
                      description={`Vật tư: ${record.name}`}
                      okText="Xóa"
                      cancelText="Hủy"
                      okButtonProps={{ danger: true, loading: deletingMaterialId === record.id }}
                      onConfirm={() => handleDeleteMaterial(record)}
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ),
              }
            ]} 
            dataSource={materials} 
            rowKey="id" 
            loading={loading} 
            className="designer-table"
            pagination={{ pageSize: 12, placement: 'bottomCenter' } as any}
          />
        </div>
      )
    },
    {
      key: '2',
      label: <span className="px-4"><HistoryOutlined /> Nhật ký cấp phát</span>,
      children: (
        <div className="premium-shadow rounded-[28px] overflow-hidden bg-white mt-4 border border-slate-100">
          <Table 
            
            columns={[
              { title: 'Thời gian', dataIndex: 'created_at', key: 'created_at', onCell: () => ({ 'data-label': 'Thời gian' } as any), render: (d: string) => <Text className="text-slate-400 font-mono text-xs">{dayjs(d).format('DD/MM HH:mm')}</Text> },
              { title: 'Vật tư', dataIndex: ['materials', 'name'], key: 'material', onCell: () => ({ 'data-label': 'Vật tư' } as any), render: (t: string) => <Text strong className="text-slate-800">{t}</Text> },
              { title: 'LSX Liên kết', dataIndex: ['production_orders', 'code'], key: 'lsx', onCell: () => ({ 'data-label': 'LSX' } as any), render: (v: string) => v ? <Tag color="blue" className="font-mono font-bold border-none">{v}</Tag> : <Text className="text-slate-300">---</Text> },
              { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', align: 'right' as const, onCell: () => ({ 'data-label': 'Số lượng' } as any), render: (q: number, r: any) => <Text strong className={r.type === 'import' ? 'text-emerald-600' : 'text-rose-600'}>{r.type === 'import' ? '+' : '-'}{(q || 0).toLocaleString()}</Text> },
              { title: 'Ghi chú/Lý do', dataIndex: 'reason', key: 'reason', ellipsis: true, onCell: () => ({ 'data-label': 'Lý do' } as any), render: (t: string) => <Text className="text-slate-500 italic">{t}</Text> }
            ]} 
            dataSource={logs} 
            rowKey="id" 
            loading={loading} 
            className="designer-table"
            pagination={{ pageSize: 12, placement: 'bottomCenter' } as any}
          />
        </div>
      )
    },
    {
      key: '4',
      label: <span className="px-4 font-bold text-indigo-600"><PlusOutlined /> Danh mục & CRUD</span>,
      children: (
        <div className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => { setSelectedMaterial(null); setMaterialModalVisible(true); }}
                className="rounded-xl font-bold bg-indigo-600 border-none shadow-lg shadow-indigo-100"
              >
                THÊM VẬT TƯ MỚI
              </Button>
          </div>
          <div className="premium-shadow rounded-[28px] overflow-hidden bg-white border border-slate-100">
            <Table 
              
              columns={[
                { title: 'Tên Vật Tư', dataIndex: 'name', key: 'name', onCell: () => ({ 'data-label': 'Tên' } as any), render: (t: string) => <Text strong className="text-slate-800">{t}</Text> },
                { title: 'Phân loại', dataIndex: 'category', key: 'category', onCell: () => ({ 'data-label': 'Loại' } as any), render: (c: string) => <Tag color="blue" className="rounded-lg border-none font-bold px-2">{c || 'Chưa phân loại'}</Tag> },
                { title: 'Nhà cung cấp', dataIndex: 'supplier', key: 'supplier', onCell: () => ({ 'data-label': 'NCC' } as any), render: (s: string) => <Text className="text-slate-500">{s || '---'}</Text> },
                { title: 'Đơn giá', dataIndex: 'unit_price', key: 'price', align: 'right' as const, onCell: () => ({ 'data-label': 'Giá' } as any), render: (p: number) => <Text strong className="text-slate-700 font-mono">{p?.toLocaleString()} đ</Text> },
                {
                  title: 'Thao tác',
                  key: 'action',
                  width: 140,
                  align: 'right' as const,
                  onCell: () => ({ 'data-label': 'Thao tác' } as any),
                  render: (_: any, record: any) => (
                    <Space size={4}>
                      <Button
                        size="small"
                        className="rounded-lg border-slate-200 text-slate-600"
                        icon={<EditOutlined />}
                        onClick={() => handleMaterialClick(record)}
                      >
                        Sửa
                      </Button>
                      <Popconfirm
                        title="Xóa vật tư này?"
                        description={`Vật tư: ${record.name}`}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true, loading: deletingMaterialId === record.id }}
                        onConfirm={() => handleDeleteMaterial(record)}
                      >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  ),
                }
              ]} 
              dataSource={materials} 
              rowKey="id" 
              loading={loading} 
              className="designer-table"
              pagination={{ pageSize: 12, placement: 'bottomCenter' } as any}
            />
          </div>
        </div>
      )
    },
    {
      key: '3',
      label: <span className="px-4"><CalculatorOutlined /> Quy đổi A4</span>,
      children: <div className="max-w-4xl mx-auto py-10 animate-in"><A4Calculator /></div>
    }
  ];

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

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in px-1">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-indigo-50 p-6 shadow-sm">
        <div className="flex justify-between items-end gap-4">
        <div>
          <Title level={2} className="m-0 font-black tracking-tight text-slate-900">
            MASTER <span className="text-indigo-600">WAREHOUSE</span>
          </Title>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 w-8 bg-indigo-600 rounded-full" />
            <Text className="premium-label text-slate-400">Kiểm soát vật tư • Định mức & Điều phối tồn kho</Text>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button icon={<FileExcelOutlined />} onClick={exportMaterialsToExcel} className="h-11 px-5 rounded-xl font-semibold border-slate-200">
            Xuất Excel
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => setTransactionModalVisible(true)}
            className="h-11 px-6 rounded-xl font-semibold shadow-indigo-200 shadow-md bg-indigo-600 border-none"
          >
            Giao dịch kho
          </Button>
        </div>
      </div>
      </div>

      {lowStockMaterials.length > 0 && (
        <Alert
          title={<Text strong className="text-red-800">Cảnh báo tồn kho dưới ngưỡng an toàn</Text>}
          description={
            <div className="mt-2 flex flex-wrap gap-2">
              {lowStockMaterials.map(m => (
                <Tag key={m.id} color="red" className="m-0 rounded-lg border-red-200 px-2.5 py-0.5">
                  {m.name}: còn {m.stock_quantity} {m.unit}
                </Tag>
              ))}
            </div>
          }
          type="error"
          showIcon
          icon={<WarningOutlined />}
          className="border-red-200 bg-red-50 rounded-2xl shadow-sm"
        />
      )}

      <Row gutter={[24, 24]}>
        {stats.map((stat, idx) => (
          <Col span={8} key={idx}>
            <div className={`p-5 rounded-2xl border shadow-sm flex items-center justify-between ${stat.cardClass}`}>
              <div className="flex flex-col">
                <Text className="text-[11px] font-bold tracking-wider text-slate-500 mb-1 whitespace-nowrap">{stat.title}</Text>
                <span className={`text-3xl font-black tracking-tight ${stat.valueClass}`}>{stat.value}</span>
              </div>
              <div className={`p-3 rounded-xl text-xl shadow-sm ${stat.iconWrapClass}`}>
                {stat.icon}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <Tabs defaultActiveKey="1" items={tabItems} className="premium-tabs-layout" />

      <MaterialDetailModal
        visible={materialModalVisible}
        material={selectedMaterial}
        onClose={() => { setMaterialModalVisible(false); fetchData(); }}
        onRefresh={fetchData}
      />

      <Modal
        title={
          <div className="flex flex-col gap-1 pr-12">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl text-lg">
                <DatabaseOutlined />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-slate-900 leading-tight">GIAO DỊCH KHO</span>
                <Text className="text-[10px] font-black uppercase tracking-wider text-indigo-500">Inventory Transaction</Text>
              </div>
            </div>
          </div>
        }
        open={transactionModalVisible}
        onCancel={() => setTransactionModalVisible(false)}
        footer={null}
        width={500}
        centered
        className="premium-modal no-padding-body"
      >
        <div className="p-8">
          <Form form={form} layout="vertical" onFinish={handleTransaction} initialValues={{ type: 'import' }} onValuesChange={(v) => v.type && setExportType(v.type)}>
            <Form.Item name="type" label={<Text className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Phân loại</Text>} rules={[{ required: true }]}>
              <Segmented 
                block 
                options={[
                  { label: 'NHẬP KHO', value: 'import', icon: <ArrowUpOutlined /> },
                  { label: 'CẤP PHÁT', value: 'export', icon: <ArrowDownOutlined /> }
                ]} 
                className="premium-segmented"
              />
            </Form.Item>
            <Form.Item name="material_id" label={<Text className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Chọn Vật tư</Text>} rules={[{ required: true }]}>
              <Select placeholder="Tìm vật tư..." className="premium-select" size="large">
                {materials.map(m => <Option key={m.id} value={m.id}>{m.name} (Tồn: {m.stock_quantity})</Option>)}
              </Select>
            </Form.Item>
            {exportType === 'export' && (
              <Form.Item name="order_id" label={<Text className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Sản xuất (LSX)</Text>} rules={[{ required: true, message: 'Vui lòng chọn LSX liên kết' }]}>
                <Select placeholder="Tìm LSX..." className="premium-select" size="large" showSearch filterOption={(input, option) => (option?.children as any || '').toLowerCase().includes(input.toLowerCase())}>
                  {orders.map(o => <Option key={o.id} value={o.id}>{o.code} - {o.title}</Option>)}
                </Select>
              </Form.Item>
            )}
            <Form.Item name="quantity" label={<Text className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Số lượng</Text>} rules={[{ required: true }]}>
              <InputNumber min={0.1} className="w-full premium-select h-11" size="large" />
            </Form.Item>
            <Form.Item name="reason" label={<Text className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Diễn giải</Text>}>
              <Input.TextArea rows={3} placeholder="..." className="rounded-xl border-slate-200" />
            </Form.Item>
            <div className="flex justify-end gap-3 pt-6">
              <Button onClick={() => setTransactionModalVisible(false)} className="h-11 px-6 rounded-xl font-bold">HỦY</Button>
              <Button type="primary" htmlType="submit" className="h-11 px-10 rounded-xl font-bold bg-indigo-600 shadow-indigo-100 shadow-lg border-none">XÁC NHẬN</Button>
            </div>
          </Form>
        </div>
      </Modal>

      <style jsx global>{`
        .premium-tabs-layout .ant-tabs-nav { margin-bottom: 12px !important; }
        .premium-tabs-layout .ant-tabs-nav-wrap { padding: 0 8px !important; }
        .premium-tabs-layout .ant-tabs-tab { padding: 12px 8px !important; font-size: 11px !important; font-weight: 800 !important; text-transform: uppercase !important; color: #94a3b8 !important; letter-spacing: 1px !important; }
        .premium-tabs-layout .ant-tabs-tab-active .ant-tabs-tab-btn { color: #0047ab !important; }
        .premium-tabs-layout .ant-tabs-ink-bar { background: #0047ab !important; height: 3px !important; border-radius: 3px 3px 0 0 !important; }
        .premium-tabs-layout .ant-table-thead > tr > th {
          background: #f8fafc !important;
          color: #64748b !important;
          font-size: 11px !important;
          letter-spacing: 0.08em !important;
          text-transform: uppercase !important;
        }
        .premium-tabs-layout .ant-table-tbody > tr:hover > td {
          background: #f8fafc !important;
        }
      `}</style>
    </div>
  );
}