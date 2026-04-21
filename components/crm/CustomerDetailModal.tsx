'use client';

import React, { useState, useEffect } from 'react';
import { 
  Modal, Tabs, Form, Input, Select, Button, Table, 
  Typography, Space, Row, Col, Statistic, Tag, message, 
  Avatar, Divider, Card, Empty, Popconfirm, InputNumber
} from 'antd';
import { 
  SaveOutlined, 
  ShoppingCartOutlined, 
  WalletOutlined, 
  InfoCircleOutlined, 
  UserOutlined,
  DeleteOutlined,
  PlusOutlined,
  EyeOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import OrderDetailModal from '../orders/OrderDetailModal';
import CreateOrderModal from '../orders/CreateOrderModal';
import { Progress } from 'antd';

const { Text } = Typography;
const { Option } = Select;

interface CustomerDetailModalProps {
  visible: boolean;
  customer: any;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function CustomerDetailModal({ visible, customer, onClose, onRefresh }: CustomerDetailModalProps) {
  const [form] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [orderDetailVisible, setOrderDetailVisible] = useState(false);
  const [createOrderVisible, setCreateOrderVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    if (visible && customer) {
      form.setFieldsValue(customer);
      fetchOrders();
      fetchPayments();
    } else if (visible) {
      form.resetFields();
      setOrders([]);
      setPayments([]);
    }
  }, [visible, customer, form]);

  const fetchOrders = async () => {
    if (!customer) return;
    setLoadingOrders(true);
    try {
      const { data, error } = await supabase
        .from('production_orders')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchPayments = async () => {
    if (!customer) return;
    setLoadingPayments(true);
    try {
      const { data, error } = await supabase
        .from('payment_logs')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPayments(false);
    }
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      if (customer) {
        const { error } = await supabase
          .from('customers')
          .update(values)
          .eq('id', customer.id);
        if (error) throw error;
        message.success('Đã cập nhật thông tin khách hàng');
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([{ ...values, code: values.code || `KH${Date.now().toString().slice(-6)}` }]);
        if (error) throw error;
        message.success('Đã thêm khách hàng mới');
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
        .from('customers')
        .delete()
        .eq('id', customer.id);
      if (error) throw error;
      message.success('Đã xóa khách hàng');
      onRefresh?.();
      onClose();
    } catch (err) {
      message.error('Lỗi khi xóa khách hàng. Có thể khách hàng này đang có đơn hàng.');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddPayment = async (values: any) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('payment_logs')
        .insert([{
          customer_id: customer.id,
          amount: values.amount,
          type: values.type,
          method: values.method,
          note: values.note,
          created_at: new Date().toISOString()
        }]);
      
      if (error) throw error;

      const newPrepaid = (customer.prepaid_amount || 0) + (values.type === 'payment' ? values.amount : -values.amount);
      const newDebt = (customer.current_debt || 0) - (values.type === 'payment' ? values.amount : -values.amount);
      
      await supabase.from('customers').update({
        prepaid_amount: newPrepaid,
        current_debt: newDebt
      }).eq('id', customer.id);

      message.success('Đã ghi nhận thanh toán');
      setPaymentModalVisible(false);
      paymentForm.resetFields();
      fetchPayments();
      onRefresh?.();
    } catch (err) {
      message.error('Lỗi khi ghi nhận thanh toán');
    } finally {
      setSaving(false);
    }
  };

  const orderColumns = [
    { 
      title: 'Mã đơn', 
      dataIndex: 'code', 
      key: 'code', 
      render: (t: string) => <Text strong className="text-blue-600">{t}</Text> 
    },
    { 
      title: 'Nội dung', 
      dataIndex: 'title', 
      key: 'title',
      ellipsis: true
    },
    { 
      title: 'Trạng thái', 
      dataIndex: 'status', 
      key: 'status', 
      render: (status: string) => {
        const configs: any = {
          completed: { color: 'green', label: 'HOÀN TẤT' },
          in_progress: { color: 'blue', label: 'SẢN XUẤT' },
          pending: { color: 'orange', label: 'CHỜ XỬ LÝ' }
        };
        const cfg = configs[status] || { color: 'default', label: status.toUpperCase() };
        return <Tag color={cfg.color} className="rounded-md font-medium">{cfg.label}</Tag>;
      }
    },
    { 
      title: 'Tiến độ', 
      key: 'progress', 
      width: 120,
      render: (record: any) => {
        // Simple heuristic for progress if not calculated
        const statusMap: any = { completed: 100, in_progress: 50, pending: 0 };
        const percent = statusMap[record.status] || 0;
        return <Progress percent={percent} size="small" strokeColor={percent === 100 ? '#52c41a' : '#1890ff'} />;
      }
    },
    { 
      title: 'Tổng tiền', 
      key: 'total', 
      align: 'right' as const,
      render: (record: any) => <Text strong>{record.financials?.total_with_vat?.toLocaleString()} đ</Text>
    },
    { 
      title: 'Ngày lên đơn', 
      dataIndex: 'created_at', 
      key: 'created_at', 
      render: (d: string) => <Text type="secondary">{new Date(d).toLocaleDateString('vi-VN')}</Text> 
    },
    {
      title: 'Thao tác',
      key: 'action',
      align: 'center' as const,
      render: (record: any) => (
        <Button 
          type="text" 
          icon={<EyeOutlined className="text-blue-500" />} 
          onClick={() => {
            setSelectedOrder(record);
            setOrderDetailVisible(true);
          }}
        />
      )
    }
  ];

  const tabItems = [
    {
      key: '1',
      label: <span><InfoCircleOutlined /> Thông tin chung</span>,
      children: (
        <div className="p-4">
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ category: 'Khách lẻ', payment_term: 'Thanh toán ngay' }}
          >
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item name="code" label="Mã Khách hàng">
                  <Input placeholder="Tự động nếu để trống" disabled={!!customer} />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item name="name" label="Tên Khách hàng" rules={[{ required: true }]}>
                  <Input placeholder="Nhập tên khách hàng" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true }]}>
                  <Input placeholder="Nhập SĐT" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="category" label="Phân loại">
                  <Select>
                    <Option value="Khách lẻ">Khách lẻ</Option>
                    <Option value="Khách VIP">Khách VIP</Option>
                    <Option value="Đại lý">Đại lý</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="address" label="Địa chỉ">
                  <Input.TextArea rows={2} placeholder="Địa chỉ chi tiết" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="payment_term" label="Hạn thanh toán">
                  <Select>
                    <Option value="Thanh toán ngay">Thanh toán ngay</Option>
                    <Option value="Sau 7 ngày">Sau 7 ngày</Option>
                    <Option value="Công nợ tháng">Công nợ tháng</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Divider />
            <div className="flex justify-between mt-4">
              {customer ? (
                <Popconfirm
                  title="Xóa khách hàng?"
                  description="Hành động này không thể hoàn tác."
                  onConfirm={handleDelete}
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true, loading: deleting }}
                >
                  <Button danger icon={<DeleteOutlined />}>Xóa Khách hàng</Button>
                </Popconfirm>
              ) : <div />}
              <Space>
                <Button onClick={onClose}>Hủy</Button>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                  {customer ? 'Lưu thay đổi' : 'Tạo mới'}
                </Button>
              </Space>
            </div>
          </Form>
        </div>
      ),
    },
    {
      key: '2',
      label: <span><ShoppingCartOutlined /> Đơn hàng & LSX</span>,
      disabled: !customer,
      children: (
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <Text strong className="text-lg">Danh sách đơn hàng của khách</Text>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => setCreateOrderVisible(true)}
              className="bg-indigo-600 border-none"
            >
              Tạo đơn mới
            </Button>
          </div>
          <Table 
            columns={orderColumns} 
            dataSource={orders} 
            rowKey="id" 
            loading={loadingOrders}
            pagination={{ pageSize: 5 }}
            size="middle"
            locale={{ emptyText: <Empty description="Chưa có đơn hàng nào" /> }}
            className="border border-slate-100 rounded-lg overflow-hidden"
          />
        </div>
      ),
    },
    {
      key: '3',
      label: <span><WalletOutlined /> Báo cáo Công nợ</span>,
      disabled: !customer,
      children: (
        <div className="p-4 space-y-6">
          <div className="flex justify-between items-start">
            <Row gutter={16} style={{ flex: 1 }}>
              <Col span={8}>
                <Card className="bg-blue-50 border-blue-100">
                  <Statistic 
                    title="Tổng doanh thu" 
                    value={customer?.total_revenue || 0} 
                    suffix="đ" 
                    valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card className="bg-green-50 border-green-100">
                  <Statistic 
                    title="Đã tạm ứng" 
                    value={customer?.prepaid_amount || 0} 
                    suffix="đ" 
                    valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card className="bg-red-50 border-red-100">
                  <Statistic 
                    title="Còn nợ hiện tại" 
                    value={customer?.current_debt || 0} 
                    suffix="đ" 
                    valueStyle={{ color: '#f5222d', fontWeight: 'bold' }}
                  />
                </Card>
              </Col>
            </Row>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              style={{ marginLeft: 16 }}
              onClick={() => setPaymentModalVisible(true)}
            >
              Thu tiền
            </Button>
          </div>

          <Divider titlePlacement="left" plain>Lịch sử giao dịch & Thanh toán</Divider>
          <Table 
            columns={[
              { 
                title: 'Ngày', 
                dataIndex: 'created_at', 
                key: 'created_at', 
                render: (d: string) => new Date(d).toLocaleString('vi-VN') 
              },
              { title: 'Nội dung', dataIndex: 'note', key: 'note' },
              { title: 'Số tiền', dataIndex: 'amount', key: 'amount', align: 'right' as const, render: (v: number) => v?.toLocaleString() + ' đ' },
              { title: 'Loại', dataIndex: 'type', key: 'type', render: (t: string) => t === 'payment' ? <Tag color="green">THU</Tag> : <Tag color="red">CHI</Tag> }
            ]}
            dataSource={payments}
            rowKey="id"
            loading={loadingPayments}
            size="small"
            pagination={{ pageSize: 8 }}
          />
        </div>
      ),
    }
  ];

  return (
    <>
      <Modal
        title={customer ? `Khách hàng: ${customer.name}` : 'Thêm Khách hàng'}
        open={visible}
        onCancel={onClose}
        footer={null}
        width={900}
      >
        <Tabs defaultActiveKey="1" items={tabItems} destroyOnHidden />
      </Modal>

      <OrderDetailModal 
        visible={orderDetailVisible} 
        order={selectedOrder} 
        onClose={() => setOrderDetailVisible(false)} 
        onRefresh={fetchOrders}
      />

      <CreateOrderModal 
        visible={createOrderVisible} 
        customerId={customer?.id}
        onClose={() => {
          setCreateOrderVisible(false);
          fetchOrders();
          onRefresh?.();
        }}
        // In a real app, we might want to pre-select the customer
        // But the CreateOrderModal needs to support it. 
        // For now, it will open a fresh modal.
      />

      <Modal
        title="Ghi nhận thanh toán"
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        footer={null}
      >
        <Form form={paymentForm} layout="vertical" onFinish={handleAddPayment} initialValues={{ type: 'payment', method: 'bank_transfer' }}>
          <Form.Item name="amount" label="Số tiền" rules={[{ required: true }]}><InputNumber className="w-full" /></Form.Item>
          <Form.Item name="type" label="Loại"><Select><Option value="payment">Thu tiền</Option><Option value="refund">Trả tiền</Option></Select></Form.Item>
          <Form.Item name="method" label="Phương thức"><Select><Option value="cash">Tiền mặt</Option><Option value="bank_transfer">Chuyển khoản</Option></Select></Form.Item>
          <Form.Item name="note" label="Ghi chú"><Input.TextArea /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={saving}>Ghi nhận</Button>
        </Form>
      </Modal>
    </>
  );
}
