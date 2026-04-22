'use client';

import React, { useState, useEffect } from 'react';
import { 
  Modal, Button, Space, Typography, Tag, Divider, 
  Input, Form, message, Row, Col, Tabs, Alert, Select, Checkbox, 
  InputNumber, Statistic, Descriptions, Card, Spin
} from 'antd';
import { 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  DatabaseOutlined, 
  PlayCircleOutlined, 
  ReloadOutlined,
  SaveOutlined, 
  StopOutlined, 
  ThunderboltOutlined, 
  ToolOutlined, 
  WarningOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import dayjs from 'dayjs';
import { getUser, User } from '@/lib/auth';
import OrderDetailModal from '@/components/orders/OrderDetailModal';
import { FileSearchOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const formatDuration = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

interface TaskActionModalProps {
  visible: boolean;
  task: any;
  onClose: () => void;
  onRefresh: () => void;
}

interface Machine {
  id: string;
  code: string;
  name: string;
  type: string;
  department_id: number;
  status: string;
}

export default function TaskActionModal({ visible, task, onClose, onRefresh }: TaskActionModalProps) {
  const [form] = Form.useForm();
  const [materialForm] = Form.useForm();
  const [wasteForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [issueMode, setIssueMode] = useState(false);
  const [wasteMode, setWasteMode] = useState(false);
  const [isShortage, setIsShortage] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loadingMachines, setLoadingMachines] = useState(false);
  const [orderDetailVisible, setOrderDetailVisible] = useState(false);
  const [liveHoldSeconds, setLiveHoldSeconds] = useState(0);

  useEffect(() => {
    let interval: any;
    if (visible && task && (task.status === 'on_hold' || task.status === 'issue') && task.hold_start_time) {
      const updateLiveTime = () => {
        const startTime = task.hold_start_time ? dayjs(task.hold_start_time) : dayjs(task.updated_at);
        const currentHold = dayjs().diff(startTime, 'second');
        setLiveHoldSeconds((task.total_hold_seconds || 0) + Math.max(0, currentHold));
      };
      updateLiveTime();
      interval = setInterval(updateLiveTime, 1000); // Update every 1s
    } else if (task) {
      setLiveHoldSeconds(task.total_hold_seconds || 0);
    }
    return () => clearInterval(interval);
  }, [visible, task]);

  useEffect(() => {
    if (visible) {
      setUser(getUser());
    }
  }, [visible]);

  // Fetch machines when task changes
  useEffect(() => {
    if (visible && task?.department_id) {
      fetchMachines(task.department_id);
    }
  }, [visible, task?.department_id]);

  const fetchMachines = async (departmentId: number) => {
    setLoadingMachines(true);
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .eq('department_id', departmentId)
        .eq('status', 'active')
        .order('name');
      
      if (error) throw error;
      setMachines(data || []);
    } catch (err) {
      console.error('Error fetching machines:', err);
      setMachines([]);
    } finally {
      setLoadingMachines(false);
    }
  };

  useEffect(() => {
    if (task) {
      const requested = task.material_requested_qty || 1000;
      const received = task.material_received_qty || 1000;
      setIsShortage(received < requested);
      form.setFieldsValue({
        ...task.machine_info,
        ...task.processing_info
      });
    }
  }, [task]);

  const getConfirmerName = (u: User | null) =>
    (u?.full_name?.trim() || u?.username || '—') as string;

  const handleStatusChange = async (newStatus: string, additionalData: any = {}) => {
    setSubmitting(true);
    try {
      const sessionUser = getUser();
      const now = new Date().toISOString();
      const updates: any = { 
        status: newStatus,
        updated_at: now
      };

      // KPI Logic: Tracking hold time and processing time
      if (newStatus === 'in_progress' && task.status === 'ready') {
        updates.start_time = now;
        updates.kpi_start_time = now;
        if (sessionUser) {
          updates.assigned_to = sessionUser.id;
        }
      }

      // If leaving hold/issue status, accumulate duration and clear log
      if ((task.status === 'on_hold' || task.status === 'issue') && task.hold_start_time) {
        if (newStatus !== task.status) {
          const holdSecs = dayjs(now).diff(dayjs(task.hold_start_time), 'second');
          updates.total_hold_seconds = (task.total_hold_seconds || 0) + holdSecs;
          updates.hold_start_time = null;
          
          // Clear issue log when task is resumed/moved to next state
          if (newStatus === 'in_progress' || newStatus === 'done' || newStatus === 'ready') {
            updates.issue_log = null;
          }
        }
      }

      // If entering hold/issue status, start timer
      if (newStatus === 'on_hold' || newStatus === 'issue') {
        updates.hold_start_time = now;
        if (newStatus === 'on_hold' && additionalData.material_shortage) {
          updates.kpi_transferred_to = 7;
          updates.kpi_transferred_at = now;
        }
      } else if (newStatus === 'done') {
        updates.end_time = now;
      }

      const { error } = await supabase
        .from('tasks')
        .update({ ...updates, ...additionalData })
        .eq('id', task.id);

      if (error) throw error;

      if (newStatus === 'done') {
        const { data: nextTask } = await supabase
          .from('tasks')
          .select('*')
          .eq('order_id', task.order_id)
          .eq('sequence_order', task.sequence_order + 1)
          .single();

        if (nextTask) {
          await supabase.from('tasks').update({ 
            status: 'ready', 
            ready_at: now, 
            updated_at: now 
          }).eq('id', nextTask.id);
        } else {
          await supabase.from('production_orders').update({ 
            status: 'completed', 
            updated_at: now 
          }).eq('id', task.order_id);
        }
      }

      message.success(
        `Đã cập nhật: ${newStatus.toUpperCase()} — Người xác nhận: ${getConfirmerName(sessionUser)}`
      );
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi cập nhật');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMaterialVerify = async (values: any, shouldHold: boolean = false) => {
    setSubmitting(true);
    try {
      const sessionUser = getUser();
      const shortageDetected = values.material_received_qty < values.material_requested_qty;
      const updates: any = {
        material_requested_qty: values.material_requested_qty,
        material_received_qty: values.material_received_qty,
        material_shortage: shortageDetected,
        updated_at: new Date().toISOString()
      };

      if (shouldHold) {
        updates.status = 'on_hold';
        updates.hold_start_time = new Date().toISOString();
        updates.issue_log = `Thiếu ${values.material_requested_qty - values.material_received_qty} vật tư. KPI chuyển sang Kho 2.`;
        updates.kpi_transferred_to = 7;
        updates.kpi_transferred_at = new Date().toISOString();
      }

      const { error } = await supabase.from('tasks').update(updates).eq('id', task.id);
      if (error) throw error;

      const who = getConfirmerName(sessionUser);
      message.success(
        shouldHold
          ? `Đã xác nhận HOÃN HỢP LỆ - KPI chuyển sang Kho 2 — Người xác nhận: ${who}`
          : `Đã cập nhật số lượng vật tư — Người xác nhận: ${who}`
      );
      onRefresh();
      onClose();
    } catch (err) {
      message.error('Lỗi khi cập nhật');
    } finally {
      setSubmitting(false);
    }
  };

  // Kho 2 releases hold and provides materials
  const handleReleaseHold = async (values: any) => {
    setSubmitting(true);
    try {
      const sessionUser = getUser();
      const now = new Date().toISOString();
      
      const holdDuration = task.hold_start_time 
        ? dayjs(now).diff(dayjs(task.hold_start_time), 'second')
        : 0;

      const updates: any = {
        status: 'ready',
        hold_start_time: null,
        total_hold_seconds: (task.total_hold_seconds || 0) + holdDuration,
        material_shortage: false,
        material_received_qty: values.provided_qty,
        issue_log: `${task.issue_log} | Đã cấp vật tư bởi Kho 2: ${values.provided_qty} (Xác nhận: ${getConfirmerName(sessionUser)})`,
        kpi_transferred_to: null,
        kpi_transferred_at: null,
        updated_at: now
      };

      const { error } = await supabase.from('tasks').update(updates).eq('id', task.id);
      if (error) throw error;

      message.success(
        `Đã cấp vật tư và trả KPI về bộ phận gốc — Người xác nhận: ${getConfirmerName(sessionUser)}`
      );
      onRefresh();
      onClose();
    } catch (err) {
      message.error('Lỗi khi giải quyết vật tư');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWasteReport = async (values: any) => {
    setSubmitting(true);
    try {
      const sessionUser = getUser();
      await supabase.from('inventory_logs').insert([{
        task_id: task.id,
        order_id: task.order_id,
        user_id: sessionUser?.id,
        quantity: values.quantity,
        type: 'waste',
        reason: `Bù hao tại ${task.departments?.name}: ${values.reason}`,
        is_waste_correction: true,
        created_at: new Date().toISOString()
      }]);

      message.success(`Đã ghi nhận bù hao — Người xác nhận: ${getConfirmerName(sessionUser)}`);
      setWasteMode(false);
      wasteForm.resetFields();
    } catch (err) {
      message.error('Lỗi khi ghi nhận bù hao');
    } finally {
      setSubmitting(false);
    }
  };

  // Check if user is from Kho 2 and task has material shortage
  const isKho2ResolvingMaterial = user?.department?.code === 'WH2' && task?.material_shortage && task?.status === 'on_hold';

  const tabItems = [
    {
      key: '1',
      label: <span><ThunderboltOutlined /> Thao tác KPI</span>,
      children: (
        <div className="p-4 space-y-6">
          <Row gutter={16}>
            <Col span={16}>
              <Alert 
                title={`Trạng thái: ${task?.status?.toUpperCase()}`} 
                description={
                  task?.status === 'on_hold' 
                    ? `Đang hoãn do: ${task.issue_log}` 
                    : task?.kpi_transferred_to 
                      ? `KPI đã chuyển sang Kho 2 do thiếu vật tư`
                      : "Thực hiện đúng quy trình để đảm bảo KPI."
                }
                type={task?.status === 'ready' ? 'info' : task?.status === 'in_progress' ? 'success' : 'warning'} 
                showIcon 
              />
            </Col>
            <Col span={8}>
              <Card size="small" className="text-center shadow-inner bg-gray-50 border-none">
                <Statistic 
                  title="Thời gian gián đoạn" 
                  value={formatDuration(liveHoldSeconds)} 
                  valueStyle={{ fontSize: 20, fontWeight: 'bold', color: (task?.status === 'on_hold' || task?.status === 'issue') ? '#f59e0b' : 'inherit' }} 
                  prefix={<ClockCircleOutlined className={task?.status === 'on_hold' || task?.status === 'issue' ? 'text-orange-500 animate-pulse' : ''} />}
                />
                {task?.total_hold_seconds > 0 && (task?.status === 'on_hold' || task?.status === 'issue') && (
                  <Text type="secondary" className="text-[10px]">
                    (Đã tích lũy: {formatDuration(task.total_hold_seconds)})
                  </Text>
                )}
              </Card>
            </Col>
            {task?.estimated_duration_seconds > 0 && task?.start_time && (
              <Col span={24}>
                <div className={`p-3 rounded-xl border ${
                  dayjs().isAfter(dayjs(task.start_time).add(task.estimated_duration_seconds, 'second'))
                  ? 'bg-red-50 border-red-100'
                  : 'bg-indigo-50 border-indigo-100'
                } flex justify-between items-center mt-4`}>
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-lg shadow-sm"><ClockCircleOutlined className="text-indigo-600" /></div>
                    <div>
                      <div className="text-[10px] font-black uppercase text-indigo-400">HẠN KPI (Dự kiến xong)</div>
                      <div className={`text-lg font-black ${
                         dayjs().isAfter(dayjs(task.start_time).add(task.estimated_duration_seconds, 'second')) ? 'text-red-600' : 'text-slate-800'
                      }`}>
                        {dayjs(task.start_time).add(task.estimated_duration_seconds, 'second').format('HH:mm DD/MM/YYYY')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Tag color={dayjs().isAfter(dayjs(task.start_time).add(task.estimated_duration_seconds, 'second')) ? 'red' : 'blue'} className="m-0 border-none font-bold">
                       {dayjs().isAfter(dayjs(task.start_time).add(task.estimated_duration_seconds, 'second')) ? 'QUÁ HẠN' : 'TRONG HẠN'}
                    </Tag>
                  </div>
                </div>
              </Col>
            )}
          </Row>
          
          {/* Kho 2 Material Resolution */}
          {isKho2ResolvingMaterial && (
            <Card className="bg-orange-50 border-orange-200">
              <Title level={5}>Giải quyết thiếu hụt vật tư</Title>
              <Text type="secondary">Bạn đang giải quyết vấn đề thiếu vật tư cho bộ phận {task?.departments?.name}</Text>
              <Form layout="vertical" onFinish={handleReleaseHold} className="mt-4">
                <Form.Item name="provided_qty" label="Số lượng vật tư cấp" rules={[{ required: true }]}>
                  <InputNumber min={1} className="w-full" size="large" />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={submitting} block size="large">
                  Cấp vật tư & Trả KPI về bộ phận gốc
                </Button>
              </Form>
            </Card>
          )}

          <div className="flex flex-wrap gap-4 justify-center py-6">
            {(task?.status === 'ready' || task?.status === 'on_hold' || task?.status === 'issue') && !isKho2ResolvingMaterial && (
              <Button 
                type="primary" size="large" 
                icon={task?.status === 'ready' ? <PlayCircleOutlined /> : <ReloadOutlined />} 
                onClick={() => handleStatusChange('in_progress')}
                loading={submitting}
                className="h-16 px-12 text-lg rounded-2xl shadow-lg border-none bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                {task?.status === 'ready' ? 'BẮT ĐẦU (KPI)' : 'TIẾP TỤC (KPI)'}
              </Button>
            )}
            
            {task?.status === 'in_progress' && (
              <Button 
                type="primary" size="large" icon={<CheckCircleOutlined />} 
                onClick={() => handleStatusChange('done')}
                loading={submitting}
                className="h-16 px-12 text-lg rounded-2xl bg-green-600 border-none shadow-lg"
              >
                HOÀN THÀNH
              </Button>
            )}

            {task?.status !== 'on_hold' && !isKho2ResolvingMaterial && (
              <Button 
                danger size="large" icon={<WarningOutlined />} 
                onClick={() => setIssueMode(!issueMode)}
                className="h-16 px-10 text-lg rounded-2xl shadow-md"
              >
                BÁO SỰ CỐ
              </Button>
            )}
          </div>

          {issueMode && (
            <Form layout="vertical" onFinish={(v) => handleStatusChange('issue', { issue_log: v.issue_log })} className="bg-red-50 p-4 rounded-xl border border-red-100">
              <Form.Item name="issue_log" label="Chi tiết sự cố" rules={[{ required: true }]}>
                <Input.TextArea rows={3} placeholder="Mô tả sự cố để loại trừ KPI nếu do máy móc..." />
              </Form.Item>
              <Button type="primary" danger htmlType="submit" loading={submitting}>Xác nhận & Hoãn KPI</Button>
            </Form>
          )}
        </div>
      )
    },
    {
      key: '2',
      label: <span><ToolOutlined /> Máy & Kỹ thuật</span>,
      children: (
        <div className="p-4 space-y-6">
          <Form 
            form={form} 
            layout="vertical" 
            onFinish={(v) => handleStatusChange(task.status, { machine_info: v })}
          >
            <Title level={5}>Cấu hình Máy</Title>
            <Row gutter={16}>
              <Col span={10}>
                <Form.Item name="machine_id" label="Mã máy">
                  <Select placeholder="Chọn máy" loading={loadingMachines}>
                    {machines.length > 0 ? (
                      machines.map(m => (
                        <Option key={m.id} value={m.code}>
                          {m.name} ({m.type})
                        </Option>
                      ))
                    ) : (
                      <Option value="" disabled>Không có máy khả dụng</Option>
                    )}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={7}>
                <Form.Item name="mode" label="Chế độ in">
                  <Select>
                    <Option value="High Quality">High Quality</Option>
                    <Option value="Eco">Standard/Eco</Option>
                    <Option value="Direct">Direct Print</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={7}>
                <Form.Item name="temp_setting" label="Nhiệt độ (nếu có)">
                  <InputNumber className="w-full" suffix="°C" />
                </Form.Item>
              </Col>
            </Row>
            
            <Divider dashed />
            
            <Title level={5}>Yêu cầu Gia công phối hợp</Title>
            <Form.Item name="processing" className="mb-0">
              <Checkbox.Group className="w-full">
                <Row gutter={[16, 16]}>
                  <Col span={6}><Checkbox value="lamination">Cán màng</Checkbox></Col>
                  <Col span={6}><Checkbox value="folding">Gấp</Checkbox></Col>
                  <Col span={6}><Checkbox value="creasing">Cấn</Checkbox></Col>
                  <Col span={6}><Checkbox value="uv">Phủ UV</Checkbox></Col>
                  <Col span={6}><Checkbox value="cutting">Cắt bàn</Checkbox></Col>
                  <Col span={6}><Checkbox value="staple">Đóng ghim</Checkbox></Col>
                  <Col span={6}><Checkbox value="glue">Vào keo</Checkbox></Col>
                  <Col span={6}><Checkbox value="diecut">Bế</Checkbox></Col>
                </Row>
              </Checkbox.Group>
            </Form.Item>
            
            <div className="mt-8 flex justify-end">
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={submitting}>Lưu thông số kỹ thuật</Button>
            </div>
          </Form>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <Text strong><StopOutlined /> Báo cáo Bù hao Sai hỏng</Text>
              {!wasteMode && <Button size="small" type="dashed" onClick={() => setWasteMode(true)}>+ Ghi nhận bù hao</Button>}
            </div>
            
            {wasteMode && (
              <Form form={wasteForm} layout="vertical" onFinish={handleWasteReport}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="quantity" label="Số lượng tờ hỏng" rules={[{ required: true }]}>
                      <InputNumber min={1} className="w-full" />
                    </Form.Item>
                  </Col>
                  <Col span={16}>
                    <Form.Item name="reason" label="Nguyên nhân" rules={[{ required: true }]}>
                      <Select placeholder="Chọn nguyên nhân">
                        <Option value="Kẹt giấy">Kẹt giấy</Option>
                        <Option value="Sai màu">Sai màu / Lem mực</Option>
                        <Option value="In nhầm mặt">In nhầm mặt / Sai khổ</Option>
                        <Option value="Hỏng file">Lỗi file thiết kế</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <div className="flex justify-end gap-2">
                  <Button size="small" onClick={() => setWasteMode(false)}>Hủy</Button>
                  <Button type="primary" danger size="small" htmlType="submit" loading={submitting}>Xác nhận & Trừ kho</Button>
                </div>
              </Form>
            )}
          </div>
        </div>
      )
    },
    {
      key: '3',
      label: <span><DatabaseOutlined /> Vật tư & Hoãn hợp lệ</span>,
      children: (
        <div className="p-4">
          <Card className="bg-blue-50 border-blue-100 shadow-sm rounded-2xl overflow-hidden mb-6">
            <Descriptions title="Yêu cầu Cấp phát Vật tư" bordered size="small" column={1}>
              <Descriptions.Item label="Loại vật tư">
                {task?.production_orders?.specs?.main_material_name || task?.production_orders?.specs?.paper_type || 'Giấy in chuẩn'}
              </Descriptions.Item>
              <Descriptions.Item label="Định mức hệ thống">{task?.material_requested_qty || 1000} Tờ/Cuộn</Descriptions.Item>
              <Descriptions.Item label="Đã nhận">{task?.material_received_qty || 0} Tờ/Cuộn</Descriptions.Item>
            </Descriptions>
            
            {task?.material_shortage && (
              <Alert 
                className="mt-4"
                title="ĐANG THIẾU VẬT TƯ - HOÃN HỢP LỆ"
                description={`Thiếu: ${(task?.material_requested_qty || 0) - (task?.material_received_qty || 0)} đơn vị. KPI đã chuyển sang Kho 2.`}
                type="warning"
                showIcon
              />
            )}
            
            <Form 
              form={materialForm} 
              layout="vertical" 
              className="mt-6"
              onFinish={(v) => handleMaterialVerify(v, false)}
              initialValues={{ 
                material_requested_qty: task?.material_requested_qty || 1000,
                material_received_qty: task?.material_received_qty || 1000
              }}
              onValuesChange={(_, all) => setIsShortage(all.material_received_qty < all.material_requested_qty)}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="material_received_qty" label="Số lượng thợ nhận thực tế" rules={[{ required: true }]}>
                    <InputNumber min={0} className="w-full" size="large" />
                  </Form.Item>
                </Col>
              </Row>

              {isShortage && task?.status !== 'on_hold' && (
                <Alert 
                  className="mb-4"
                  title="CẢNH BÁO THIẾU HỤT"
                  description="Nếu không thể tiếp tục sản xuất với số lượng hiện có, hãy chọn HOÃN HỢP LỆ để chuyển KPI sang Kho 2."
                  type="warning"
                  showIcon
                  action={
                    <Button size="small" danger onClick={() => handleMaterialVerify(materialForm.getFieldsValue(), true)}>HOÃN & CHỜ KHO</Button>
                  }
                />
              )}

              <Button type="primary" block size="large" htmlType="submit" loading={submitting}>CẬP NHẬT TRẠNG THÁI VẬT TƯ</Button>
            </Form>
          </Card>
        </div>
      )
    }
  ];

  return (
    <Modal
      title={
        <Space size="large">
          <div className="bg-blue-600 p-2 rounded-xl"><ThunderboltOutlined className="text-white" /></div>
          <div>
            <div className="font-bold text-lg leading-tight flex items-center gap-2">
              {task?.departments?.name}
              <Button 
                size="small" 
                type="dashed" 
                icon={<FileSearchOutlined />}
                onClick={() => setOrderDetailVisible(true)}
                className="text-[10px] h-6 rounded-md border-blue-200 text-blue-600 bg-blue-50"
              >
                Chi tiết đơn
              </Button>
            </div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              #{task?.production_orders?.code} - {task?.production_orders?.title}
            </Text>
          </div>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      centered
      className="task-modal-v2"
    >
      {user && (
        <div className="px-1 pt-1">
          <Text type="secondary" className="text-xs block">
            Người xác nhận:{' '}
            <Text strong className="text-slate-800">
              {user.full_name || user.username}
              {user.username && (user.full_name || '') && user.username !== user.full_name ? ` (@${user.username})` : ''}
            </Text>
          </Text>
        </div>
      )}
      <Tabs defaultActiveKey="1" items={tabItems} className="mt-2" destroyOnHidden />

      <OrderDetailModal 
        visible={orderDetailVisible} 
        order={task?.production_orders ? { ...task.production_orders, id: task.order_id } : null}
        onClose={() => setOrderDetailVisible(false)}
        userRole="operation"
      />
    </Modal>
  );
}
