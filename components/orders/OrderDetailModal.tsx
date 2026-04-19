'use client';

import React, { useState, useEffect } from 'react';
import { 
  Modal, Tabs, Typography, Row, Col, Space, Tag, 
  Steps, Divider, Table, Statistic, Button, message, 
  Timeline, Badge, Empty, Card, Avatar, Progress, InputNumber, Select, Form, Input
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
  PlusOutlined,
  EditOutlined,
  SaveOutlined,
  CloseCircleOutlined,
  OrderedListOutlined,
  CloseOutlined,
  DoubleRightOutlined,
  PlusCircleOutlined
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
  const [editMode, setEditMode] = useState(false);
  const [editForm] = Form.useForm();
  const [customers, setCustomers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedSteps, setSelectedSteps] = useState<any[]>([]);
  const [activeTabKey, setActiveTabKey] = useState('1');
  const [, forceUpdate] = useState({});

  // Auto-refresh thời gian phản hồi real-time mỗi 30 giây
  useEffect(() => {
    if (!visible || activeTabKey !== '2') return;
    
    const interval = setInterval(() => {
      // Force re-render để cập nhật thời gian phản hồi real-time
      forceUpdate({});
    }, 30000); // 30 giây

    return () => clearInterval(interval);
  }, [visible, activeTabKey]);

  useEffect(() => {
    if (visible && order) {
      fetchTaskDetails();
      fetchPayments();
      fetchCustomers();
      fetchDepartments();
      setActiveTabKey('1'); // Reset to first tab when modal opens
      setEditMode(false);
    }
  }, [visible, order]);

  useEffect(() => {
    if (editMode && order) {
      // Initialize workflow steps from existing tasks
      const steps = tasks.map(t => ({
        deptId: t.department_id,
        deadline: t.ready_at ? dayjs(t.ready_at).add(t.estimated_duration_seconds || 3600, 'second').format('YYYY-MM-DDTHH:mm') : null
      }));
      setSelectedSteps(steps);
      
      // Set form values
      editForm.setFieldsValue({
        title: order.title,
        customer_id: order.customer_id,
        specs: order.specs,
        deadline: order.deadline ? dayjs(order.deadline).format('YYYY-MM-DDTHH:mm') : null,
        financials: order.financials,
        quantity: order.specs?.quantity,
        unit_price: order.financials?.unit_price,
        vat: order.financials?.vat,
        paper_type: order.specs?.paper_type,
        size: order.specs?.size,
        sides: order.specs?.sides,
        unit: order.specs?.unit
      });
    }
  }, [editMode, order, tasks]);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, code, phone, address')
        .order('name');
      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('id', { ascending: true });
      if (error) throw error;
      setDepartments(data || []);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const getDeptName = (deptId: number) => {
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || `ID: ${deptId}`;
  };

  const handleAddStep = (deptId: number) => {
    const newSteps = [...selectedSteps, { deptId, deadline: null }];
    setSelectedSteps(newSteps);
  };

  const handleRemoveStep = (index: number) => {
    const newSteps = selectedSteps.filter((_, i) => i !== index);
    setSelectedSteps(newSteps);
  };

  const handleUpdateDeadline = (index: number, deadline: string | null) => {
    const newSteps = [...selectedSteps];
    newSteps[index] = { ...newSteps[index], deadline };
    setSelectedSteps(newSteps);
  };

  const fetchTaskDetails = async () => {
    if (!order?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          status,
          department_id,
          sequence_order,
          start_time,
          end_time,
          ready_at,
          updated_at,
          created_at,
          issue_log,
          material_shortage,
          estimated_duration_seconds,
          departments:department_id (name, code),
          users:assigned_to (full_name)
        `)
        .eq('order_id', order.id)
        .order('sequence_order', { ascending: true });
      
      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('Error fetching task details:', err);
      if (order.tasks) setTasks(order.tasks);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    if (!order?.id) return;
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

  const handleSaveOrder = async () => {
    try {
      const values = editForm.getFieldsValue();
      setSaving(true);
      
      // Calculate total with VAT
      const quantity = values.quantity || order?.specs?.quantity || 0;
      const unit_price = values.unit_price || order?.financials?.unit_price || 0;
      const vat = values.vat || order?.financials?.vat || 0;
      const total = quantity * unit_price;
      const total_with_vat = total * (1 + vat / 100);

      const updateData: any = {
        title: values.title,
        customer_id: values.customer_id,
        specs: {
          quantity: values.quantity,
          unit: values.unit,
          size: values.size,
          sides: values.sides,
          paper_type: values.paper_type,
        },
        financials: {
          unit_price: values.unit_price,
          vat: values.vat,
          total: total,
          total_with_vat: total_with_vat,
          received: order?.financials?.received || 0,
        }
      };
      
      if (values.deadline) {
        // Handle both date and datetime-local formats
        const deadlineDate = new Date(values.deadline);
        if (!isNaN(deadlineDate.getTime())) {
          updateData.deadline = deadlineDate.toISOString();
        }
      }

      const { error } = await supabase
        .from('production_orders')
        .update(updateData)
        .eq('id', order.id);

      if (error) throw error;

      // Update workflow steps (tasks) if changed
      if (selectedSteps.length > 0) {
        // Delete existing tasks
        await supabase.from('tasks').delete().eq('order_id', order.id);
        
        // Create new tasks with deadline-based KPI
        const tasksToCreate = selectedSteps.map((step, index) => {
          let estimatedDuration = 3600; // Default 1 hour in seconds
          let readyAt = index === 0 ? new Date().toISOString() : null;
          
          // Calculate duration from deadline if provided
          if (step.deadline) {
            const deadlineDate = new Date(step.deadline);
            const startDate = index === 0 ? new Date() : (selectedSteps[index - 1].deadline ? new Date(selectedSteps[index - 1].deadline) : new Date());
            estimatedDuration = Math.max(60, Math.floor((deadlineDate.getTime() - startDate.getTime()) / 1000));
          }
          
          return {
            order_id: order.id,
            department_id: step.deptId,
            sequence_order: index + 1,
            status: index === 0 ? 'ready' : 'pending',
            ready_at: readyAt,
            estimated_duration_seconds: estimatedDuration,
          };
        });

        await supabase.from('tasks').insert(tasksToCreate);
      }

      message.success('Đã cập nhật đơn hàng');
      setEditMode(false);
      setActiveTabKey('1');
      onRefresh?.();
    } catch (err) {
      console.error('Error updating order:', err);
      message.error('Lỗi khi cập nhật đơn hàng');
    } finally {
      setSaving(false);
    }
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
              const responderName = task.users?.full_name || 'Hệ thống';
              // Thời gian phản hồi: 
              // - Nếu đã nhận việc (có start_time): lấy khoảng thời gian đã lưu (KHÔNG đếm nữa)
              // - Nếu chưa nhận việc (chưa có start_time) NHƯNG đã được giao (có ready_at) VÀ đang chờ (status = ready/pending): đếm real-time
              // - Nếu đang làm (in_progress) hoặc đã xong (done): KHÔNG đếm, chỉ hiển thị giá trị đã lưu
              // - Nếu chưa được giao (chưa có ready_at): không tính (bước trước chưa xong)
              const responseTime = task.start_time && task.ready_at 
                ? dayjs(task.start_time).diff(dayjs(task.ready_at), 'minute')
                : (task.ready_at && !task.start_time && (task.status === 'ready' || task.status === 'pending'))
                  ? dayjs().diff(dayjs(task.ready_at), 'minute')
                  : null;
              
              const isOverdue = task.status === 'in_progress' && task.start_time && task.estimated_duration_seconds && 
                                dayjs().isAfter(dayjs(task.start_time).add(task.estimated_duration_seconds, 'second'));

              return {
                title: (
                  <div className="flex flex-col w-full">
                    <div className="flex items-center justify-between pr-4">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-mono text-[10px] font-bold">BƯỚC {idx + 1}</span>
                        <Text strong className="text-lg text-slate-800 tracking-tight">{task.departments?.name}</Text>
                        {task.estimated_duration_seconds > 0 && (
                          <Tag className="m-0 border-none bg-indigo-50 text-indigo-600 text-[9px] font-bold px-2 rounded-lg">
                            KPI: {Math.round(task.estimated_duration_seconds / 60)} PHÚT
                          </Tag>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Tag color={
                          task.status === 'done' ? 'green' : 
                          task.status === 'in_progress' ? 'blue' : 
                          task.status === 'issue' || task.status === 'on_hold' ? 'red' : 
                          task.status === 'ready' ? 'cyan' : 'default'
                        } className="m-0 rounded-full border-none font-black uppercase text-[9px] px-3 py-0.5">
                          {task.status === 'done' ? 'HOÀN TẤT' : 
                           task.status === 'in_progress' ? 'ĐANG LÀM' :
                           task.status === 'ready' ? 'SẴN SÀNG' :
                           task.status === 'on_hold' ? 'TẠM HOÃN' :
                           task.status.toUpperCase()}
                        </Tag>
                      </div>
                    </div>
                  </div>
                ),
                description: (
                  <div className={`mt-4 mb-6 rounded-[28px] border transition-all duration-300 overflow-hidden ${
                    task.status === 'in_progress' ? 'bg-white shadow-xl shadow-indigo-100 border-indigo-100 ring-2 ring-indigo-50' : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                  }`}>
                    <div className="p-5">
                      <Row gutter={[24, 16]}>
                        <Col span={10}>
                          <div className="space-y-4">
                             <div>
                                <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Người xác nhận</Text>
                                <div className="flex items-center gap-2.5">
                                   <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs border-2 border-white shadow-sm overflow-hidden uppercase">
                                      {responderName.charAt(0)}
                                   </div>
                                   <div>
                                      <Text className="text-xs font-bold text-slate-700 block leading-tight">{responderName}</Text>
                                      <Text className="text-[10px] text-slate-400">BP. {task.departments?.code || 'XNK'}</Text>
                                   </div>
                                </div>
                             </div>
                             {task.machine_info?.machine_id && (
                               <div>
                                  <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Thiết bị sử dụng</Text>
                                  <Text className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 inline-block">
                                     {task.machine_info.machine_id}
                                  </Text>
                               </div>
                             )}
                          </div>
                        </Col>
                        
                        <Col span={14} className="border-l border-slate-100 pl-6">
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-3">
                                 <div>
                                    <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Thời gian phản hồi</Text>
                                    <div className="flex items-center gap-2">
                                       <ClockCircleOutlined className={`text-xs ${!task.start_time && responseTime !== null ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`} />
                                       <Text className={`text-xs font-black ${
                                         task.start_time && responseTime !== null && responseTime > 30 ? 'text-rose-500' : 
                                         !task.start_time && responseTime !== null ? 'text-amber-600' :
                                         'text-slate-600'
                                       }`}>
                                          {responseTime !== null ? `${responseTime} phút` : (task.ready_at ? '---' : 'Chờ bước trước')}
                                       </Text>
                                       {!task.start_time && responseTime !== null && (
                                         <Tag className="m-0 text-[8px] bg-amber-50 text-amber-600 border-none font-bold animate-pulse">ĐANG ĐẾM</Tag>
                                       )}
                                       {task.start_time && responseTime !== null && responseTime > 30 && (
                                         <Tag className="m-0 text-[8px] bg-rose-50 text-rose-500 border-none font-bold">ĐÃ LƯU - CHẬM</Tag>
                                       )}
                                       {task.start_time && responseTime !== null && responseTime <= 30 && (
                                         <Tag className="m-0 text-[8px] bg-emerald-50 text-emerald-600 border-none font-bold">ĐÃ LƯU</Tag>
                                       )}
                                    </div>
                                 </div>
                                 {task.ready_at && (
                                   <div>
                                      <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Giao việc lúc</Text>
                                      <Text className="text-[11px] font-bold text-slate-500">{dayjs(task.ready_at).format('HH:mm - DD/MM')}</Text>
                                   </div>
                                 )}
                                 {!task.ready_at && (
                                   <div>
                                      <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Trạng thái</Text>
                                      <Tag className="m-0 text-[8px] bg-slate-100 text-slate-500 border-none font-bold">CHỜ BƯỚC TRƯỚC</Tag>
                                   </div>
                                 )}
                              </div>
                              <div className="space-y-3">
                                 {task.start_time && (
                                   <div>
                                      <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Xác nhận lúc</Text>
                                      <Text className="text-[11px] font-black text-indigo-600">{dayjs(task.start_time).format('HH:mm - DD/MM')}</Text>
                                   </div>
                                 )}
                                 {task.status === 'in_progress' && task.start_time && (
                                   <div>
                                      <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Hạn hoàn thành</Text>
                                      <div className="flex flex-col">
                                         <Text className={`text-[11px] font-black ${isOverdue ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}>
                                            {dayjs(task.start_time).add(task.estimated_duration_seconds, 'second').format('HH:mm - DD/MM')}
                                         </Text>
                                      </div>
                                   </div>
                                 )}
                                 {task.status === 'done' && task.end_time && (
                                   <div>
                                      <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Hoàn tất lúc</Text>
                                      <Text className="text-[11px] font-black text-emerald-600">{dayjs(task.end_time).format('HH:mm - DD/MM')}</Text>
                                   </div>
                                 )}
                              </div>
                           </div>
                        </Col>
                      </Row>

                      {(task.status === 'issue' || task.status === 'on_hold') && task.issue_log && (
                        <div className="mt-4 p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-start gap-3">
                           <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-rose-500 shadow-sm border border-rose-100">
                              <WarningOutlined />
                           </div>
                           <div>
                              <Text className="text-[10px] font-black text-rose-400 uppercase tracking-widest block mb-1">Thông tin sự cố / Ghi chú</Text>
                              <Text className="text-xs font-bold text-rose-700">{task.issue_log}</Text>
                           </div>
                        </div>
                      )}
                    </div>
                  </div>
                ),
                icon: task.status === 'done' ? <CheckCircleOutlined className="text-green-500 text-xl" /> : 
                      task.status === 'in_progress' ? <SyncOutlined spin className="text-blue-500 text-xl" /> : 
                      task.status === 'issue' || task.status === 'on_hold' ? <WarningOutlined className="text-red-500 text-xl" /> : null
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
              <Card title="Phải thu" styles={{ header: { background: '#f8fafc' } }} className="shadow-sm ui-soft-surface">
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
                  styles={{ header: { background: '#f8fafc' } }}
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
          {tasks.filter(t => t.issue_log).length === 0 ? (
            <Empty description="Không có sự cố nào được ghi nhận" />
          ) : (
            <div className="space-y-2">
              {tasks.filter(t => t.issue_log).map(task => (
                <div key={task.id} className="bg-red-50 mb-2 p-3 rounded-lg border-l-4 border-red-500 flex items-start gap-3">
                  <Avatar icon={<WarningOutlined />} className="bg-red-100 text-red-600 flex-shrink-0" />
                  <div className="flex-1">
                    <Text strong className="block">Sự cố tại bộ phận: {task.departments?.name}</Text>
                    <div>
                      <Text type="danger" className="block mb-1 font-bold">{task.issue_log}</Text>
                      <Text type="secondary" style={{ fontSize: '11px' }}>Ghi nhận lúc: {dayjs(task.updated_at).format('DD/MM/YYYY HH:mm')}</Text>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    },
    {
      key: '5',
      label: <span><EditOutlined /> Chỉnh sửa</span>,
      children: (
        <div className="p-4">
          <Tabs 
            defaultActiveKey="edit1" 
            className="manual-step-tabs"
            items={[
              {
                key: 'edit1',
                label: <span><InfoCircleOutlined /> 1. Thông số chung</span>,
                children: (
                  <div className="py-2">
                    <Row gutter={24}>
                      <Col span={16}>
                        <Form.Item name="customer_id" label="Khách hàng" rules={[{ required: true, message: 'Vui lòng chọn khách hàng' }]}>
                          <Select showSearch placeholder="Chọn khách hàng" optionFilterProp="children" className="w-full">
                            {customers.map((c: any) => (
                              <Option key={c.id} value={c.id}>{c.name} ({c.code})</Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="deadline" label="Ngày giao dự kiến">
                          <Input type="datetime-local" className="w-full" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="title" label="Nội dung in" rules={[{ required: true, message: 'Nhập nội dung in' }]}>
                      <Input.TextArea rows={2} placeholder="Ví dụ: In Card Visit" />
                    </Form.Item>

                    <Row gutter={24}>
                      <Col span={6}>
                        <Form.Item name="quantity" label="Số lượng">
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item name="unit" label="Đơn vị">
                          <Input placeholder="Cuốn, Bộ..." />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item name="size" label="Khổ giấy">
                          <Select placeholder="Chọn khổ">
                            <Option value="A3">A3</Option>
                            <Option value="A4">A4</Option>
                            <Option value="A5">A5</Option>
                            <Option value="A6">A6</Option>
                            <Option value="Custom">Khác</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item name="sides" label="Mặt in">
                          <Select>
                            <Option value={1}>In 1 mặt</Option>
                            <Option value={2}>In 2 mặt</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={24}>
                      <Col span={12}>
                        <Form.Item name="paper_type" label="Loại giấy">
                          <Select placeholder="Chọn loại giấy">
                            <Option value="C150">C150 (Couche 150g)</Option>
                            <Option value="C200">C200 (Couche 200g)</Option>
                            <Option value="C250">C250 (Couche 250g)</Option>
                            <Option value="C300">C300 (Couche 300g)</Option>
                            <Option value="Ford70">Ford 70g</Option>
                            <Option value="Ford80">Ford 80g</Option>
                            <Option value="Bristol">Bristol</Option>
                            <Option value="Kraft">Kraft</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                )
              },
              {
                key: 'edit2',
                label: <span><NodeIndexOutlined /> 2. Quy trình sản xuất</span>,
                children: (
                  <div className="py-2">
                    <div className="mb-6 p-5 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <div className="flex justify-between items-center mb-4">
                        <Text strong className="text-slate-500 uppercase text-[11px] tracking-wider flex items-center gap-2">
                          <OrderedListOutlined /> Lộ trình sản xuất hiện tại
                        </Text>
                        {selectedSteps.length > 0 && (
                          <Button 
                            type="text" 
                            danger 
                            size="small" 
                            icon={<CloseOutlined />} 
                            onClick={() => setSelectedSteps([])}
                          >
                            Xóa tất cả
                          </Button>
                        )}
                      </div>

                      {selectedSteps.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-y-3">
                          {selectedSteps.map((step, index) => (
                            <div key={`${step.deptId}-${index}`} className="flex items-center">
                              <div className="flex flex-col gap-1 items-center">
                                <Tag 
                                  closable 
                                  onClose={(e: React.MouseEvent) => { e.preventDefault(); handleRemoveStep(index); }}
                                  className="px-3 py-2 rounded-xl border-blue-100 bg-white shadow-sm flex items-center gap-2 m-0"
                                  color="blue"
                                >
                                  <span className="bg-blue-600 text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold">
                                    {index + 1}
                                  </span>
                                  <span className="font-bold text-slate-700">{getDeptName(step.deptId)}</span>
                                </Tag>
                                <div className="px-2 py-0.5 bg-slate-100 rounded-lg flex items-center gap-1">
                                  <ClockCircleOutlined className="text-[10px] text-slate-400" />
                                  <Input 
                                    type="datetime-local"
                                    size="small" 
                                    value={step.deadline || ''} 
                                    onChange={(e) => handleUpdateDeadline(index, e.target.value)}
                                    className="w-40 text-[10px] font-bold"
                                    placeholder="Chọn deadline"
                                  />
                                </div>
                              </div>
                              {index < selectedSteps.length - 1 && (
                                <DoubleRightOutlined className="mx-2 text-slate-300 text-[10px] mb-6" />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-slate-400 italic text-sm">
                          Bấm vào các bộ phận bên dưới để thêm vào quy trình...
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      <Text strong className="block mb-3 text-slate-600 text-sm">Thêm bộ phận vào quy trình:</Text>
                      <Space wrap>
                        {departments.map(dept => (
                          <Button 
                            key={dept.id} 
                            icon={<PlusCircleOutlined />}
                            onClick={() => handleAddStep(dept.id)}
                            className="rounded-xl hover:border-blue-500 h-9"
                          >
                            {dept.name}
                          </Button>
                        ))}
                      </Space>
                    </div>
                  </div>
                )
              },
              {
                key: 'edit3',
                label: <span><DollarOutlined /> 3. Tài chính</span>,
                children: (
                  <div className="py-6 bg-slate-50/50 rounded-2xl px-6 border border-slate-100">
                    <Row gutter={32} align="middle">
                      <Col span={14}>
                        <div className="space-y-6">
                          <Form.Item name="unit_price" label="Đơn giá (VNĐ)">
                            <InputNumber 
                              min={0} 
                              style={{ width: '100%' }} 
                              size="large"
                              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
                            />
                          </Form.Item>
                          <Form.Item name="vat" label="VAT (%)">
                            <InputNumber min={0} max={100} style={{ width: '100%' }} size="large" />
                          </Form.Item>
                        </div>
                      </Col>
                      <Col span={10}>
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
                          <Text type="secondary" className="uppercase text-[10px] font-bold tracking-widest mb-2">Tổng tiền thanh toán</Text>
                          <Form.Item shouldUpdate noStyle>
                            {() => {
                              const quantity = editForm.getFieldValue('quantity') || order?.specs?.quantity || 0;
                              const unit_price = editForm.getFieldValue('unit_price') || order?.financials?.unit_price || 0;
                              const vat = editForm.getFieldValue('vat') || order?.financials?.vat || 0;
                              const total = quantity * unit_price * (1 + (vat / 100));
                              return (
                                <div className="text-center">
                                  <div className="text-3xl font-black text-indigo-600 mb-1">
                                    {total.toLocaleString()} 
                                    <span className="text-sm ml-1 uppercase font-normal text-indigo-400">đ</span>
                                  </div>
                                  <Text type="secondary" className="text-[11px]">Đã bao gồm VAT</Text>
                                </div>
                              );
                            }}
                          </Form.Item>
                        </div>
                      </Col>
                    </Row>
                  </div>
                )
              }
            ]} 
          />
          <div className="flex justify-end mt-4 border-t pt-4">
            <Space>
              <Button onClick={() => {
                setEditMode(false);
                setActiveTabKey('1');
              }}>Hủy</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveOrder} loading={saving}>Lưu thay đổi</Button>
            </Space>
          </div>
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
          <Button key="edit" icon={<EditOutlined />} onClick={() => {
            setActiveTabKey('5');
            editForm.setFieldsValue({
              title: order?.title,
              customer_id: order?.customer_id,
              specs: order?.specs,
              deadline: order?.deadline ? dayjs(order.deadline).format('YYYY-MM-DDTHH:mm') : null,
              financials: order?.financials,
              quantity: order?.specs?.quantity,
              unit_price: order?.financials?.unit_price,
              vat: order?.financials?.vat,
              paper_type: order?.specs?.paper_type,
              size: order?.specs?.size,
              sides: order?.specs?.sides,
              unit: order?.specs?.unit
            });
            setEditMode(true);
          }}>Sửa đơn hàng</Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={generateLSX_PDF}>Phát lệnh in (LSX)</Button>
        ]}
        width={1000}
        centered
        wrapClassName="designer-modal"
      >
        <Tabs 
          activeKey={activeTabKey} 
          onChange={(key) => {
            setActiveTabKey(key);
            if (key === '5') {
              // Initialize edit form when switching to edit tab
              editForm.setFieldsValue({
                title: order?.title,
                customer_id: order?.customer_id,
                specs: order?.specs,
                deadline: order?.deadline ? dayjs(order.deadline).format('YYYY-MM-DDTHH:mm') : null,
                financials: order?.financials,
                quantity: order?.specs?.quantity,
                unit_price: order?.financials?.unit_price,
                vat: order?.financials?.vat,
                paper_type: order?.specs?.paper_type,
                size: order?.specs?.size,
                sides: order?.specs?.sides,
                unit: order?.specs?.unit
              });
              setEditMode(true);
            } else {
              setEditMode(false);
            }
          }} 
          items={tabItems} 
          className="min-h-[500px]" 
          destroyInactiveTabPane={false}
        />
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
