'use client';

import React, { useState, useEffect } from 'react';
import { 
  Modal, Tabs, Typography, Row, Col, Space, Tag, 
  Steps, Divider, Table, Statistic, Button, message, 
  Timeline, Badge, Empty, Card, Avatar, Progress, List, InputNumber, Select, Form, Input
} from 'antd';
import { 
  PrinterOutlined, 
  NodeIndexOutlined, 
  DollarOutlined, 
  HistoryOutlined, 
  CheckCircleOutlined,
  PlayCircleOutlined,
  SyncOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
  WalletOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import dayjs from 'dayjs';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const { Title, Text } = Typography;
const { Option } = Select;

interface OrderDetailModalProps {
  visible: boolean;
  order: any;
  onClose: () => void;
  onRefresh?: () => void;
  userRole?: string;
}

export default function OrderDetailModal({ visible, order, onClose, onRefresh, userRole }: OrderDetailModalProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && order) {
      fetchTaskDetails();
      fetchPayments();
    }
  }, [visible, order]);

  const fetchTaskDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          departments (name, code),
          users:assigned_to (full_name),
          estimated_duration_seconds
        `)
        .eq('order_id', order.id)
        .order('sequence_order', { ascending: true });
      
      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    if (!order) return;
    setLoadingPayments(true);
    try {
      const { data, error } = await supabase
        .from('payment_logs')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPayments(false);
    }
  };

  const generateLSX_PDF = () => {
    const doc = new jsPDF() as any;
    
    // Add LSX Title
    doc.setFontSize(22);
    doc.text("LENH SAN XUAT (LSX)", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Ma don hang: ${order.code}`, 105, 28, { align: "center" });
    
    doc.setLineWidth(0.5);
    doc.line(20, 35, 190, 35);

    // Customer Info
    doc.setFontSize(12);
    doc.text("THONG TIN KHACH HANG", 20, 45);
    doc.setFontSize(10);
    doc.text(`Ten khach: ${order.customers?.name || 'KH-ANON'}`, 20, 52);
    doc.text(`SDT: ${order.customers?.phone || '---'}`, 20, 58);
    doc.text(`Dia chi: ${order.customers?.address || '---'}`, 20, 64);

    // Order Details
    doc.setFontSize(12);
    doc.text("THONG SO KY THUAT", 110, 45);
    doc.setFontSize(10);
    doc.text(`Noi dung: ${order.title}`, 110, 52);
    doc.text(`So luong: ${order.specs?.quantity} ${order.specs?.unit}`, 110, 58);
    doc.text(`Kho giay: ${order.specs?.size}`, 110, 64);
    doc.text(`Hinh thuc: In ${order.specs?.sides} mat`, 110, 70);

    // Workflow Table
    doc.setFontSize(12);
    doc.text("QUY TRINH SAN XUAT", 20, 85);
    
    const tableColumn = ["Buoc", "Bo phan", "Trang thai", "Ghi chu"];
    const tableRows = tasks.map((t, index) => [
      index + 1,
      t.departments?.name,
      t.status.toUpperCase(),
      t.issue_log || ''
    ]);

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 90,
      theme: 'grid',
      headStyles: { fillColor: [24, 144, 255] }
    });

    // Footer
    const finalY = (doc as any).lastAutoTable.cursor.y + 20;
    doc.text("Nguoi lap lenh", 40, finalY);
    doc.text("Quan ly xuong", 150, finalY);
    doc.setFontSize(8);
    doc.text(`Ngay phat lenh: ${dayjs().format('DD/MM/YYYY HH:mm')}`, 105, finalY + 30, { align: "center" });

    doc.save(`LSX_${order.code}.pdf`);
    message.success('Đã xuất lệnh sản xuất PDF');
  };

  const handleAddPayment = async (values: any) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('payment_logs')
        .insert([{
          customer_id: order.customer_id,
          order_id: order.id,
          amount: values.amount,
          type: values.type,
          method: values.method,
          note: values.note,
          created_at: new Date().toISOString()
        }]);
      
      if (error) throw error;

      // Update Order received amount
      const currentReceived = order.financials?.received || 0;
      const newReceived = currentReceived + (values.type === 'payment' ? values.amount : -values.amount);
      
      const newFinancials = { ...order.financials, received: newReceived };
      
      await supabase.from('production_orders')
        .update({ financials: newFinancials })
        .eq('id', order.id);

      message.success('Đã ghi nhận thanh toán cho đơn hàng');
      setPaymentModalVisible(false);
      form.resetFields();
      fetchPayments();
      onRefresh?.();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi ghi nhận thanh toán');
    } finally {
      setSaving(false);
    }
  };

  const calculateOverallProgress = () => {
    if (!tasks.length) return 0;
    const doneTasks = tasks.filter(t => t.status === 'done').length;
    return Math.round((doneTasks / tasks.length) * 100);
  };

  const tabItems = [
    {
      key: '1',
      label: <span><InfoCircleOutlined /> Thông tin in ấn</span>,
      children: (
        <div className="p-4">
          <Row gutter={[32, 24]}>
            <Col span={12}>
              <Card size="small" title="Thông số kỹ thuật" className="h-full border-blue-100 shadow-sm ui-soft-surface">
                <Space orientation="vertical" className="w-full">
                  <div className="flex justify-between border-b pb-2">
                    <Text type="secondary">Nội dung:</Text>
                    <Text strong>{order?.title}</Text>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <Text type="secondary">Số lượng:</Text>
                    <Text strong>{order?.specs?.quantity?.toLocaleString()} {order?.specs?.unit}</Text>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <Text type="secondary">Khổ giấy:</Text>
                    <Text strong>{order?.specs?.size}</Text>
                  </div>
                  <div className="flex justify-between">
                    <Text type="secondary">Mặt in:</Text>
                    <Text strong>{order?.specs?.sides} mặt</Text>
                  </div>
                </Space>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title="Khách hàng & Hạn chót" className="h-full border-blue-100 shadow-sm ui-soft-surface">
                <Space orientation="vertical" className="w-full">
                  <div className="flex justify-between border-b pb-2">
                    <Text type="secondary">Khách hàng:</Text>
                    <Text strong>{order?.customers?.name || '---'}</Text>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <Text type="secondary">Số điện thoại:</Text>
                    <Text strong>{order?.customers?.phone || '---'}</Text>
                  </div>
                  <div className="flex justify-between">
                    <Text type="secondary">Ngày giao dự kiến:</Text>
                    <Tag color="volcano" icon={<ClockCircleOutlined />}>
                      {order?.deadline ? dayjs(order.deadline).format('DD/MM/YYYY') : 'Chưa cập nhật'}
                    </Tag>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        </div>
      )
    },
    {
      key: '2',
      label: <span><NodeIndexOutlined /> Theo dõi Tiến độ</span>,
      children: (
        <div className="p-4">
          <div className="mb-8 p-6 bg-blue-50 rounded-xl flex items-center justify-between border border-blue-100 shadow-inner">
            <div className="flex-1 mr-8">
              <Text strong className="block mb-2 text-lg">Tiến độ tổng quát: {calculateOverallProgress()}%</Text>
              <Progress percent={calculateOverallProgress()} status="active" strokeColor="#1890ff" strokeWidth={12} />
            </div>
            <Statistic value={tasks.filter(t => t.status === 'done').length} suffix={`/ ${tasks.length}`} title="Tasks hoàn thành" valueStyle={{ color: '#1890ff', fontWeight: 'bold' }} />
          </div>

          <Steps
            orientation="vertical"
            current={tasks.findIndex(t => t.status !== 'done')}
            className="order-detail-steps"
            items={tasks.map((task, idx) => {
              const operatorName = task.users?.full_name || 'Chưa có người nhận';
              const isIssue = task.status === 'issue' || task.material_shortage;
              
              // Calculate duration
              let durationStr = '';
              if (task.start_time && task.end_time) {
                const diff = dayjs(task.end_time).diff(dayjs(task.start_time), 'minute');
                durationStr = diff > 60 
                  ? `${Math.floor(diff/60)} giờ ${diff%60} phút` 
                  : `${diff} phút`;
              }

              return {
                title: (
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 font-mono text-sm">BƯỚC {idx + 1}</span>
                    <Text strong className="text-lg">{task.departments?.name}</Text>
                    {task.estimated_duration_seconds > 0 && (
                      <Tag className="m-0 border-none bg-slate-100 text-slate-500 text-[10px] font-bold">
                        KPI: {Math.round(task.estimated_duration_seconds / 60)} PHÚT
                      </Tag>
                    )}
                  </div>
                ),
                subTitle: task.status === 'done' && durationStr ? <Tag className="m-0 rounded-md font-normal border-none bg-slate-100 text-slate-500">Thực hiện trong: {durationStr}</Tag> : null,
                description: (
                  <div className="mt-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm ml-2">
                    <Row gutter={16}>
                      <Col span={12}>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Tag color={
                              task.status === 'done' ? 'green' : 
                              task.status === 'in_progress' ? 'blue' : 
                              task.status === 'issue' ? 'red' : 
                              task.status === 'ready' ? 'cyan' : 'default'
                            } className="rounded-md border-none font-bold uppercase text-[10px] px-2 py-0.5">
                              {task.status === 'done' ? 'HOÀN TẤT' : 
                               task.status === 'in_progress' ? 'ĐANG LÀM' :
                               task.status === 'ready' ? 'SẴN SÀNG' :
                               task.status === 'on_hold' ? 'TẠM HOÃN' :
                               task.status.toUpperCase()}
                            </Tag>
                            {task.material_shortage && <Tag color="error" className="animate-pulse rounded-md border-none font-bold text-[10px]">THIẾU VẬT TƯ</Tag>}
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs">
                            <Text type="secondary">Nhân sự:</Text>
                            <Text strong>{operatorName}</Text>
                          </div>

                          {task.machine_info?.machine_id && (
                            <div className="flex items-center gap-2 text-xs">
                              <Text type="secondary">Máy & Chế độ:</Text>
                              <Text className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100 italic">
                                {task.machine_info.machine_id} - {task.machine_info.mode}
                              </Text>
                            </div>
                          )}
                        </div>
                      </Col>
                      <Col span={12} className="border-l border-dashed border-slate-100 pl-4">
                        <div className="space-y-1">
                          {task.ready_at && (
                            <div className="flex justify-between text-[11px]">
                              <Text type="secondary">Sẵn sàng:</Text>
                              <Text>{dayjs(task.ready_at).format('HH:mm - DD/MM')}</Text>
                            </div>
                          )}
                          {task.start_time && (
                            <div className="flex justify-between text-[11px]">
                              <Text type="secondary">Bắt đầu:</Text>
                              <Text className="text-blue-500">{dayjs(task.start_time).format('HH:mm - DD/MM')}</Text>
                            </div>
                          )}
                          {task.end_time && (
                            <div className="flex justify-between text-[11px]">
                              <Text type="secondary">Hoàn tất:</Text>
                              <Text className="text-green-600">{dayjs(task.end_time).format('HH:mm - DD/MM')}</Text>
                            </div>
                          )}
                          {task.status === 'in_progress' && task.start_time && task.estimated_duration_seconds && (
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-dashed border-slate-100">
                               <Text type="secondary" className="text-[10px] font-bold">HẠN KPI:</Text>
                               <div className="flex flex-col items-end">
                                  <Text className={`text-[11px] font-black ${
                                    dayjs().isAfter(dayjs(task.start_time).add(task.estimated_duration_seconds, 'second')) ? 'text-red-500' : 'text-amber-500'
                                  }`}>
                                    {dayjs(task.start_time).add(task.estimated_duration_seconds, 'second').format('HH:mm DD/MM')}
                                  </Text>
                                  <Tag color={dayjs().isAfter(dayjs(task.start_time).add(task.estimated_duration_seconds, 'second')) ? 'red' : 'blue'} className="m-0 text-[8px] px-1 py-0 h-4 leading-3 border-none font-bold">
                                     {dayjs().isAfter(dayjs(task.start_time).add(task.estimated_duration_seconds, 'second')) ? 'QUÁ HẠN' : 'TRONG HẠN'}
                                  </Tag>
                               </div>
                            </div>
                          )}
                        </div>
                      </Col>
                    </Row>

                    {(task.status === 'issue' || task.status === 'on_hold') && task.issue_log && (
                      <div className="mt-3 p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-2">
                        <WarningOutlined className="text-rose-500 mt-0.5" />
                        <div className="text-xs text-rose-700">
                          <Text strong className="text-rose-700 block mb-0.5">Ghi chú/Sự cố:</Text>
                          {task.issue_log}
                        </div>
                      </div>
                    )}
                  </div>
                ),
                icon: task.status === 'done' ? <CheckCircleOutlined className="text-green-500" /> : 
                      task.status === 'in_progress' ? <SyncOutlined spin className="text-blue-500" /> : 
                      task.status === 'issue' ? <WarningOutlined className="text-red-500" /> : null
              };
            })}
          />
        </div>
      )
    },
    {
      key: '3',
      label: <span><DollarOutlined /> Dòng tiền</span>,
      children: (
        <div className="p-4 space-y-6">
          <Row gutter={24}>
            <Col span={10}>
              <Card title="Phải thu" headStyle={{ background: '#f8fafc' }} className="shadow-sm ui-soft-surface">
                <Statistic title="Giá trị đơn" value={order?.financials?.total || 0} suffix="đ" />
                <Divider plain>Chi tiết thuế</Divider>
                <div className="flex justify-between mb-4">
                  <Text type="secondary">Thuế VAT ({order?.financials?.vat || 0}%):</Text>
                  <Text>{(order?.financials?.total * (order?.financials?.vat / 100 || 0)).toLocaleString()} đ</Text>
                </div>
                <div className="bg-blue-50 p-3 rounded text-center">
                  <Statistic 
                    title="Tổng phải thu" 
                    value={order?.financials?.total_with_vat || (order?.financials?.total * (1 + (order?.financials?.vat || 0)/100))} 
                    suffix="đ" 
                    valueStyle={{ fontSize: 20, color: '#1890ff', fontWeight: 'bold' }}
                  />
                </div>
              </Card>
            </Col>
            <Col span={14}>
                <Card title="Lịch sử thanh toán" 
                  extra={(userRole === 'Kế toán' || userRole === 'Quản lý') && (
                    <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setPaymentModalVisible(true)}>Thu tiền</Button>
                  )} 
                  headStyle={{ background: '#f8fafc' }}
                  className="shadow-sm ui-soft-surface"
                >
                <Table 
                  columns={[
                    { title: 'Ngày', dataIndex: 'created_at', key: 'date', render: d => dayjs(d).format('DD/MM HH:mm') },
                    { title: 'Số tiền', dataIndex: 'amount', key: 'amount', align: 'right' as const, render: v => <Text strong>{(v || 0).toLocaleString()} đ</Text> },
                    { title: 'Hình thức', dataIndex: 'method', key: 'method' }
                  ]}
                  dataSource={payments}
                  pagination={{ pageSize: 3 }}
                  size="small"
                  rowKey="id"
                  loading={loadingPayments}
                  className="designer-table"
                />
                <Divider dashed />
                <div className="flex justify-between items-center px-4">
                  <Statistic title="Đã thu" value={order?.financials?.received || 0} suffix="đ" valueStyle={{ color: '#52c41a', fontSize: 20 }} />
                  {userRole !== 'Kế toán' && userRole !== 'Quản lý' && <Text type="secondary" className="text-[10px]">Tiền hàng đã chốt</Text>}
                  <Statistic 
                    title="Còn nợ" 
                    value={(order?.financials?.total_with_vat || (order?.financials?.total * (1 + (order?.financials?.vat || 0)/100))) - (order?.financials?.received || 0)} 
                    suffix="đ" 
                    valueStyle={{ color: '#f5222d', fontSize: 20, fontWeight: 'bold' }}
                  />
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )
    },
    {
      key: '4',
      label: <span><HistoryOutlined /> Lịch sử sự cố</span>,
      children: (
        <div className="p-4">
          <List
            itemLayout="horizontal"
            dataSource={tasks.filter(t => t.issue_log)}
            locale={{ emptyText: <Empty description="Không có sự cố nào được ghi nhận" /> }}
            renderItem={task => (
              <List.Item className="bg-red-50 mb-2 p-3 rounded-lg border-l-4 border-red-500">
                <List.Item.Meta
                  avatar={<Avatar icon={<WarningOutlined />} className="bg-red-100 text-red-600" />}
                  title={<Text strong>Sự cố tại bộ phận: {task.departments?.name}</Text>}
                  description={
                    <div>
                      <Text type="danger" className="block mb-1 font-bold">{task.issue_log}</Text>
                      <Text type="secondary" style={{ fontSize: '11px' }}>Ghi nhận lúc: {dayjs(task.updated_at).format('DD/MM/YYYY HH:mm')}</Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      )
    }
  ];

  return (
    <>
      <Modal
        title={
          <Space>
            <PrinterOutlined className="text-blue-600" />
            <span>Chi tiết Lệnh Sản Xuất: {order?.code}</span>
            <Tag color={order?.status === 'completed' ? 'green' : 'blue'}>{order?.status?.toUpperCase()}</Tag>
          </Space>
        }
        open={visible}
        onCancel={onClose}
        footer={[
          <Button key="close" onClick={onClose}>Đóng</Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={generateLSX_PDF}>Phát lệnh in (LSX)</Button>
        ]}
        width={1000}
        centered
        wrapClassName="designer-modal"
      >
        <Tabs defaultActiveKey="1" items={tabItems} className="min-h-[500px]" destroyOnHidden />
      </Modal>

      <Modal
        title="Ghi nhận thanh toán đơn hàng"
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        footer={null}
        width={560}
        wrapClassName="designer-modal"
      >
        <Form form={form} layout="vertical" onFinish={handleAddPayment} initialValues={{ type: 'payment', method: 'bank_transfer' }}>
          <Form.Item name="amount" label="Số tiền thanh toán" rules={[{ required: true }]}>
            <InputNumber className="w-full" size="large" formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => v!.replace(/\$\s?|(,*)/g, '')} />
          </Form.Item>
          <Form.Item name="method" label="Phương thức" rules={[{ required: true }]}>
            <Select>
              <Option value="cash">Tiền mặt</Option>
              <Option value="bank_transfer">Chuyển khoản ngân hàng</Option>
              <Option value="momo">Momo</Option>
            </Select>
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} placeholder="Nội dung thanh toán..." />
          </Form.Item>
          <Form.Item name="type" hidden initialValue="payment"><Input /></Form.Item>
          <div className="flex justify-end">
            <Space>
              <Button onClick={() => setPaymentModalVisible(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={saving}>Ghi nhận</Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </>
  );
}
