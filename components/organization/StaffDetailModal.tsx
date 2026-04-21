'use client';

import React, { useState, useEffect } from 'react';
import { 
  Modal, Tabs, Form, Input, Select, Button, Table, 
  Typography, Space, Row, Col, Statistic, Tag, message, 
  Avatar, Divider, Card, Empty, Popconfirm, InputNumber, Descriptions, Progress
} from 'antd';
import { 
  SaveOutlined, 
  HistoryOutlined, 
  UserOutlined,
  DeleteOutlined,
  KeyOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { Option } = Select;
const { Password } = Input;

interface StaffDetailModalProps {
  visible: boolean;
  staff: any;
  departments: any[];
  roles: any[];
  onClose: () => void;
  onRefresh?: () => void;
}

export default function StaffDetailModal({ visible, staff, departments, roles, onClose, onRefresh }: StaffDetailModalProps) {
  const [form] = Form.useForm();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);

  // Lọc roles theo portal
  const managementRoles = roles.filter(r => r.portal === 'management');
  const operationRoles = roles.filter(r => r.portal === 'operation');

  // Kiểm tra xem role đã chọn có cần bộ phận không
  const requiresDepartment = selectedRole?.portal === 'operation';

  useEffect(() => {
    if (visible && staff) {
      const role = roles.find(r => r.id === staff.role_id);
      setSelectedRole(role);
      form.setFieldsValue({
        username: staff.username,
        full_name: staff.full_name,
        role_id: staff.role_id,
        department_id: staff.department_id,
      });
      fetchTasks();
    } else if (visible) {
      form.resetFields();
      setTasks([]);
      setSelectedRole(null);
    }
  }, [visible, staff, form, roles]);

  const handleRoleChange = (roleId: number) => {
    const role = roles.find(r => r.id === roleId);
    setSelectedRole(role);
    // Nếu chuyển sang role quản lý, clear department
    if (role?.portal === 'management') {
      form.setFieldValue('department_id', null);
    }
  };

  const fetchTasks = async () => {
    if (!staff) return;
    setLoadingTasks(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          production_orders (code, title),
          departments:department_id (name, code)
        `)
        .eq('assigned_to', staff.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      setTasks(data || []);
    } catch (err: any) {
      console.error('Error fetching staff tasks:', err?.message || err);
    } finally {
      setLoadingTasks(false);
    }
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      const updates: any = {
        full_name: values.full_name,
        role_id: values.role_id,
      };
      
      // Chỉ set department_id nếu là role operation
      if (requiresDepartment) {
        updates.department_id = values.department_id;
      } else {
        updates.department_id = null; // Clear department for management roles
      }
      
      if (values.password) {
        updates.password = bcrypt.hashSync(values.password, 10);
      }

      if (staff) {
        const { error } = await supabase
          .from('users')
          .update(updates)
          .eq('id', staff.id);
        if (error) throw error;
        message.success('Đã cập nhật thông tin nhân viên');
      } else {
        if (!values.password) {
          message.error('Mật khẩu là bắt buộc khi tạo mới');
          setSaving(false);
          return;
        }
        updates.username = values.username;
        updates.password = bcrypt.hashSync(values.password, 10);
        const { error } = await supabase
          .from('users')
          .insert([updates]);
        if (error) throw error;
        message.success('Đã thêm nhân viên mới');
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
        .from('users')
        .delete()
        .eq('id', staff.id);
      if (error) throw error;
      message.success('Đã xóa nhân viên');
      onRefresh?.();
      onClose();
    } catch (err) {
      message.error('Lỗi khi xóa nhân viên');
    } finally {
      setDeleting(false);
    }
  };

  // Calculate stats
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const taskColumns = [
    { 
      title: 'Mã LSX', 
      dataIndex: ['production_orders', 'code'], 
      key: 'code',
      render: (t: string) => <Text strong className="text-blue-600">{t}</Text>
    },
    { 
      title: 'Nội dung', 
      dataIndex: ['production_orders', 'title'], 
      key: 'title',
      ellipsis: true
    },
    { 
      title: 'Bộ phận', 
      dataIndex: ['departments', 'name'], 
      key: 'dept',
      render: (t: string) => <Tag color="blue">{t}</Tag>
    },
    { 
      title: 'Trạng thái', 
      dataIndex: 'status', 
      key: 'status',
      render: (s: string) => {
        const colors: any = { done: 'green', in_progress: 'blue', ready: 'cyan', issue: 'red', on_hold: 'orange' };
        return <Tag color={colors[s] || 'default'}>{s.toUpperCase()}</Tag>;
      }
    },
    { 
      title: 'Hoàn thành', 
      dataIndex: 'end_time', 
      key: 'end_time',
      render: (d: string) => d ? dayjs(d).format('DD/MM HH:mm') : '---'
    },
  ];

  const tabItems = [
    {
      key: '1',
      label: <span><IdcardOutlined /> Thông tin cá nhân</span>,
      children: (
        <div className="p-4">
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
          >
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true }]}>
                  <Input prefix={<UserOutlined />} placeholder="Username" disabled={!!staff} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true }]}>
                  <Input placeholder="Nguyễn Văn A" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item 
                  name="password" 
                  label={staff ? "Mật khẩu mới (để trống nếu không đổi)" : "Mật khẩu"}
                  rules={[{ required: !staff }]}
                >
                  <Password prefix={<KeyOutlined />} placeholder="••••••••" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="role_id" label="Vai trò" rules={[{ required: true }]}>
                  <Select 
                    placeholder="Chọn vai trò" 
                    onChange={handleRoleChange}
                    disabled={!!staff} // Không đổi role khi edit
                  >
                    <Option value={-1} disabled><Text type="secondary">--- Phân hệ Quản lý ---</Text></Option>
                    {managementRoles.map(r => <Option key={r.id} value={r.id}>{r.name}</Option>)}
                    <Option value={-2} disabled><Text type="secondary">--- Phân hệ Sản xuất ---</Text></Option>
                    {operationRoles.map(r => <Option key={r.id} value={r.id}>{r.name}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item 
                  name="department_id" 
                  label="Bộ phận" 
                  rules={[{ required: requiresDepartment, message: 'Nhân viên sản xuất phải thuộc bộ phận' }]}
                  help={!requiresDepartment ? 'Chỉ nhân viên sản xuất mới cần chọn bộ phận' : undefined}
                >
                  <Select 
                    placeholder={requiresDepartment ? "Chọn bộ phận" : "Không cần chọn"}
                    disabled={!requiresDepartment}
                    allowClear
                  >
                    {departments.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Divider />
            <div className="flex justify-between mt-4">
              {staff ? (
                <Popconfirm
                  title="Xóa nhân viên này?"
                  description="Hành động này không thể hoàn tác."
                  onConfirm={handleDelete}
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true, loading: deleting }}
                >
                  <Button danger icon={<DeleteOutlined />}>Xóa Nhân viên</Button>
                </Popconfirm>
              ) : <div />}
              <Space>
                <Button onClick={onClose}>Hủy</Button>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                  {staff ? 'Lưu thay đổi' : 'Tạo mới'}
                </Button>
              </Space>
            </div>
          </Form>
        </div>
      ),
    },
    {
      key: '2',
      label: <span><SafetyCertificateOutlined /> Quyền hạn</span>,
      disabled: !staff,
      children: (
        <div className="p-4">
          <Descriptions title="Chi tiết quyền hạn" bordered column={1}>
            <Descriptions.Item label="Vai trò">{staff?.roles?.name}</Descriptions.Item>
            <Descriptions.Item label="Phân hệ">
              <Tag color={staff?.roles?.portal === 'management' ? 'blue' : 'green'}>
                {staff?.roles?.portal?.toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Bộ phận">{staff?.departments?.name}</Descriptions.Item>
            <Descriptions.Item label="Ngày tham gia">
              {staff?.created_at ? dayjs(staff.created_at).format('DD/MM/YYYY') : '---'}
            </Descriptions.Item>
          </Descriptions>
        </div>
      ),
    },
    {
      key: '3',
      label: <span><ThunderboltOutlined /> Hiệu suất công việc</span>,
      disabled: !staff,
      children: (
        <div className="p-4 space-y-6">
          <Row gutter={16}>
            <Col span={8}>
              <Card className="bg-blue-50 border-blue-100 text-center">
                <Statistic 
                  title="Tổng nhiệm vụ" 
                  value={totalTasks} 
                  styles={{ content: { color: '#1890ff', fontWeight: 'bold' } }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card className="bg-green-50 border-green-100 text-center">
                <Statistic 
                  title="Hoàn thành" 
                  value={completedTasks} 
                  styles={{ content: { color: '#52c41a', fontWeight: 'bold' } }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card className="bg-orange-50 border-orange-100 text-center">
                <Statistic 
                  title="Tỷ lệ hoàn thành" 
                  value={completionRate}
                  suffix="%" 
                  styles={{ content: { color: '#fa8c16', fontWeight: 'bold' } }}
                />
              </Card>
            </Col>
          </Row>

          <Divider titlePlacement="left" plain>Lịch sử nhiệm vụ gần đây</Divider>
          <Table 
            columns={taskColumns} 
            dataSource={tasks} 
            rowKey="id" 
            loading={loadingTasks}
            pagination={{ pageSize: 5 }}
            size="small"
            locale={{ emptyText: <Empty description="Chưa có nhiệm vụ nào" /> }}
          />
        </div>
      ),
    },
  ];

  return (
    <Modal
      title={staff ? `Nhân viên: ${staff.full_name}` : 'Thêm Nhân viên mới'}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
    >
      <Tabs defaultActiveKey="1" items={tabItems} destroyOnHidden />
    </Modal>
  );
}
