'use client';

import React, { useState, useEffect } from 'react';
import { 
  Modal, Tabs, Form, Input, Select, Button, Table, 
  Typography, Space, Row, Col, Tag, message, 
  Divider, Card, Empty, Popconfirm, InputNumber, Statistic, Descriptions, Alert
} from 'antd';
import { 
  SaveOutlined, 
  DeleteOutlined,
  InfoCircleOutlined,
  HistoryOutlined,
  DatabaseOutlined,
  WarningOutlined,
  PlusOutlined,
  MinusOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface MaterialDetailModalProps {
  visible: boolean;
  material: any;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function MaterialDetailModal({ visible, material, onClose, onRefresh }: MaterialDetailModalProps) {
  const [form] = Form.useForm();
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [adjustForm] = Form.useForm();

  useEffect(() => {
    if (visible && material) {
      form.setFieldsValue({
        name: material.name,
        unit: material.unit,
        stock_quantity: material.stock_quantity,
        min_stock: material.min_stock,
        unit_price: material.unit_price,
        supplier: material.supplier,
      });
      fetchLogs();
    } else if (visible) {
      form.resetFields();
      setLogs([]);
    }
  }, [visible, material, form]);

  const fetchLogs = async () => {
    if (!material) return;
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('inventory_logs')
        .select(`*, production_orders (code)`)
        .eq('material_id', material.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      if (material) {
        const { error } = await supabase
          .from('materials')
          .update(values)
          .eq('id', material.id);
        if (error) throw error;
        message.success('Đã cập nhật vật tư');
      } else {
        const { error } = await supabase
          .from('materials')
          .insert([values]);
        if (error) throw error;
        message.success('Đã thêm vật tư mới');
      }
      onRefresh?.();
      onClose();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi lưu thông tin');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', material.id);
      if (error) throw error;
      message.success('Đã xóa vật tư');
      onRefresh?.();
      onClose();
    } catch (err) {
      message.error('Lỗi khi xóa vật tư');
    } finally {
      setDeleting(false);
    }
  };

  const handleAdjustStock = async (values: any) => {
    setSaving(true);
    try {
      const adjustment = values.type === 'import' ? values.quantity : -values.quantity;
      const newStock = material.stock_quantity + adjustment;

      if (newStock < 0) {
        message.error('Tồn kho không thể âm');
        setSaving(false);
        return;
      }

      // Update stock
      const { error: updateError } = await supabase
        .from('materials')
        .update({ stock_quantity: newStock })
        .eq('id', material.id);
      
      if (updateError) throw updateError;

      // Log transaction
      const { error: logError } = await supabase
        .from('inventory_logs')
        .insert([{
          material_id: material.id,
          quantity: values.quantity,
          type: values.type,
          reason: values.reason || `Điều chỉnh tồn kho: ${values.type === 'import' ? 'Nhập' : 'Xuất'}`,
          created_at: new Date().toISOString()
        }]);
      
      if (logError) throw logError;

      message.success('Đã điều chỉnh tồn kho');
      setAdjustModalVisible(false);
      adjustForm.resetFields();
      onRefresh?.();
      fetchLogs();
    } catch (err) {
      message.error('Lỗi khi điều chỉnh');
    } finally {
      setSaving(false);
    }
  };

  const isLowStock = material && material.stock_quantity <= material.min_stock;

  const logColumns = [
    { 
      title: 'Thời gian', 
      dataIndex: 'created_at', 
      key: 'date',
      render: (d: string) => dayjs(d).format('DD/MM HH:mm')
    },
    { 
      title: 'Loại', 
      dataIndex: 'type', 
      key: 'type',
      render: (t: string) => (
        <Tag color={t === 'import' ? 'green' : 'red'}>
          {t === 'import' ? 'NHẬP' : 'XUẤT'}
        </Tag>
      )
    },
    { 
      title: 'Số lượng', 
      dataIndex: 'quantity', 
      key: 'quantity',
      align: 'right' as const,
      render: (q: number, r: any) => (
        <Text strong style={{ color: r.type === 'import' ? '#52c41a' : '#f5222d' }}>
          {r.type === 'import' ? '+' : '-'}{q.toLocaleString()}
        </Text>
      )
    },
    { 
      title: 'LSX', 
      dataIndex: ['production_orders', 'code'], 
      key: 'lsx',
      render: (code: string) => code ? <Tag color="blue">{code}</Tag> : '---'
    },
    { 
      title: 'Ghi chú', 
      dataIndex: 'reason', 
      key: 'reason',
      ellipsis: true
    },
  ];

  const tabItems = [
    {
      key: '1',
      label: <span><InfoCircleOutlined /> Thông tin vật tư</span>,
      children: (
        <div className="p-4">
          {isLowStock && (
            <Alert
              message="CẢNH BÁO TỒN KHO THẤP"
              description={`Tồn kho hiện tại (${material?.stock_quantity}) đang dưới ngưỡng tối thiểu (${material?.min_stock})`}
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              className="mb-4"
            />
          )}
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item name="name" label="Tên vật tư" rules={[{ required: true }]}>
                  <Input placeholder="VD: Giấy A4 80gsm" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="unit" label="Đơn vị tính" rules={[{ required: true }]}>
                  <Select>
                    <Option value="Tờ">Tờ</Option>
                    <Option value="Cuộn">Cuộn</Option>
                    <Option value="Kg">Kg</Option>
                    <Option value="Ram">Ram</Option>
                    <Option value="Hộp">Hộp</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="category" label="Phân loại" rules={[{ required: true }]}>
                  <Select placeholder="Chọn loại">
                    <Option value="Giấy">Giấy</Option>
                    <Option value="Mực">Mực</Option>
                    <Option value="Khuôn in">Khuôn in</Option>
                    <Option value="Hóa chất">Hóa chất</Option>
                    <Option value="Vật tư phụ">Vật tư phụ</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="stock_quantity" label="Tồn kho hiện tại">
                  <InputNumber className="w-full" disabled />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="min_stock" label="Ngưỡng tối thiểu" rules={[{ required: true }]}>
                  <InputNumber className="w-full" min={0} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="unit_price" label="Đơn giá (đ)">
                  <InputNumber className="w-full" min={0} />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="supplier" label="Nhà cung cấp">
                  <Input placeholder="Tên nhà cung cấp" />
                </Form.Item>
              </Col>
            </Row>
            <Divider />
            <div className="flex justify-between mt-4">
              {material ? (
                <Popconfirm
                  title="Xóa vật tư này?"
                  onConfirm={handleDelete}
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true, loading: deleting }}
                >
                  <Button danger icon={<DeleteOutlined />}>Xóa Vật tư</Button>
                </Popconfirm>
              ) : <div />}
              <Space>
                <Button onClick={onClose}>Hủy</Button>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                  {material ? 'Lưu thay đổi' : 'Tạo mới'}
                </Button>
              </Space>
            </div>
          </Form>
        </div>
      ),
    },
    {
      key: '2',
      label: <span><HistoryOutlined /> Lịch sử giao dịch</span>,
      disabled: !material,
      children: (
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <Text strong>Lịch sử nhập/xuất gần đây</Text>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => setAdjustModalVisible(true)}
            >
              Điều chỉnh tồn kho
            </Button>
          </div>
          <Table 
            columns={logColumns} 
            dataSource={logs} 
            rowKey="id" 
            loading={loadingLogs}
            pagination={{ pageSize: 10 }}
            size="small"
            locale={{ emptyText: <Empty description="Chưa có giao dịch nào" /> }}
          />
        </div>
      ),
    },
    {
      key: '3',
      label: <span><DatabaseOutlined /> Thống kê</span>,
      disabled: !material,
      children: (
        <div className="p-4">
          <Row gutter={16}>
            <Col span={8}>
              <Card className="bg-blue-50 border-blue-100 text-center">
                <Statistic 
                  title="Tổng nhập (30 ngày)" 
                  value={logs.filter(l => l.type === 'import').reduce((sum, l) => sum + l.quantity, 0)}
                  prefix={<PlusOutlined className="text-green-500" />}
                  valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card className="bg-red-50 border-red-100 text-center">
                <Statistic 
                  title="Tổng xuất (30 ngày)" 
                  value={logs.filter(l => l.type === 'export').reduce((sum, l) => sum + l.quantity, 0)}
                  prefix={<MinusOutlined className="text-red-500" />}
                  valueStyle={{ color: '#f5222d', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card className="bg-green-50 border-green-100 text-center">
                <Statistic 
                  title="Giá trị tồn kho" 
                  value={(material?.stock_quantity || 0) * (material?.unit_price || 0)}
                  suffix="đ"
                  valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={material ? `Vật tư: ${material.name}` : 'Thêm Vật tư mới'}
        open={visible}
        onCancel={onClose}
        footer={null}
        width={900}
      >
        <Tabs defaultActiveKey="1" items={tabItems} destroyOnHidden />
      </Modal>

      <Modal
        title="Điều chỉnh tồn kho"
        open={adjustModalVisible}
        onCancel={() => setAdjustModalVisible(false)}
        footer={null}
        width={400}
      >
        <Form form={adjustForm} layout="vertical" onFinish={handleAdjustStock} initialValues={{ type: 'import' }}>
          <Form.Item name="type" label="Loại điều chỉnh">
            <Select>
              <Option value="import"><Tag color="green">NHẬP KHO</Tag></Option>
              <Option value="export"><Tag color="red">XUẤT KHO</Tag></Option>
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="Số lượng" rules={[{ required: true }]}>
            <InputNumber className="w-full" min={1} />
          </Form.Item>
          <Form.Item name="reason" label="Lý do">
            <TextArea rows={2} placeholder="Ghi chú lý do điều chỉnh..." />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setAdjustModalVisible(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Xác nhận</Button>
          </div>
        </Form>
      </Modal>
    </>
  );
}
