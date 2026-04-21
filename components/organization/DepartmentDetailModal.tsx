'use client';

import React, { useState, useEffect } from 'react';
import { 
  Modal, Tabs, Form, Input, Select, Button, Table, AutoComplete,
  Typography, Space, Row, Col, Tag, message, 
  Divider, Card, Empty, Popconfirm, Avatar, Statistic
} from 'antd';
import { 
  SaveOutlined, 
  DeleteOutlined,
  InfoCircleOutlined,
  TeamOutlined,
  ToolOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { TextArea } = Input;
const STEP_OPTIONS = Array.from({ length: 10 }, (_, i) => ({ value: `Bước ${i + 1}` }));

interface DepartmentDetailModalProps {
  visible: boolean;
  department: any;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function DepartmentDetailModal({ visible, department, onClose, onRefresh }: DepartmentDetailModalProps) {
  const [form] = Form.useForm();
  const [staffForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [staff, setStaff] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingMachines, setLoadingMachines] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addStaffVisible, setAddStaffVisible] = useState(false);
  const [savingStaff, setSavingStaff] = useState(false);

  useEffect(() => {
    if (visible && department) {
      form.setFieldsValue({
        name: department.name,
        code: department.code,
        step_name: department.step_name,
        description: department.description,
      });
      fetchStaff();
      fetchMachines();
      fetchAssignableUsers();
    } else if (visible) {
      form.resetFields();
      staffForm.resetFields();
      setStaff([]);
      setMachines([]);
      setAssignableUsers([]);
    }
  }, [visible, department, form, staffForm]);

  const fetchStaff = async () => {
    if (!department) return;
    setLoadingStaff(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`*, roles (name)`)
        .eq('department_id', department.id)
        .order('full_name');
      
      if (error) throw error;
      setStaff(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStaff(false);
    }
  };

  const fetchMachines = async () => {
    if (!department) return;
    setLoadingMachines(true);
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .eq('department_id', department.id)
        .order('name');
      
      if (error) throw error;
      setMachines(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMachines(false);
    }
  };

  const fetchAssignableUsers = async () => {
    if (!department) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, username, department_id, roles:role_id (name)')
        .order('full_name');
      if (error) throw error;

      const options = (data || []).filter((u: any) => u.department_id !== department.id);
      setAssignableUsers(options);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddStaff = async (values: any) => {
    if (!department?.id) return;
    setSavingStaff(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ department_id: department.id })
        .eq('id', values.user_id);
      if (error) throw error;

      messageApi.success('Đã thêm nhân sự cho bộ phận');
      setAddStaffVisible(false);
      staffForm.resetFields();
      fetchStaff();
      fetchAssignableUsers();
      onRefresh?.();
    } catch (err) {
      console.error(err);
      messageApi.error('Lỗi khi thêm nhân sự');
    } finally {
      setSavingStaff(false);
    }
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      const basePayload = {
        code: values.code,
        name: values.name,
        step_name: values.step_name?.trim() || null,
      };

      const payload: Record<string, any> = { ...basePayload };
      const missingColumnRegex = /Could not find the '([^']+)' column/i;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { error } = department
          ? await supabase.from('departments').update(payload).eq('id', department.id)
          : await supabase.from('departments').insert([payload]);

        if (!error) {
          if (department) {
            messageApi.success('Đã cập nhật bộ phận');
          } else {
            messageApi.success('Đã thêm bộ phận mới');
          }
          onRefresh?.();
          onClose();
          return;
        }

        const missingColumn = error.message?.match(missingColumnRegex)?.[1];
        if (!missingColumn || !(missingColumn in payload)) {
          throw error;
        }

        // DB có thể chưa migrate đủ cột, tự bỏ cột thiếu rồi retry.
        delete payload[missingColumn];
      }
    } catch (err) {
      console.error(err);
      messageApi.error('Lỗi khi lưu thông tin');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Kiểm tra xem có nhân viên nào thuộc bộ phận không
      const { data: staffCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('department_id', department.id);
      
      // Kiểm tra xem có máy móc nào thuộc bộ phận không
      const { data: machineCount } = await supabase
        .from('machines')
        .select('id', { count: 'exact', head: true })
        .eq('department_id', department.id);
      
      // Kiểm tra xem có task nào thuộc bộ phận không
      const { data: taskCount } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('department_id', department.id);

      // Kiểm tra workflow templates có tham chiếu không
      const { data: workflows } = await supabase
        .from('workflow_templates')
        .select('department_sequence')
        .contains('department_sequence', [department.id]);

      const staffLen = staffCount?.length || 0;
      const machineLen = machineCount?.length || 0;
      const taskLen = taskCount?.length || 0;
      const workflowLen = workflows?.length || 0;

      if (staffLen > 0 || machineLen > 0 || taskLen > 0 || workflowLen > 0) {
        let msg = 'Không thể xóa bộ phận này vì đang có: ';
        const issues = [];
        if (staffLen > 0) issues.push(`${staffLen} nhân viên`);
        if (machineLen > 0) issues.push(`${machineLen} máy móc`);
        if (taskLen > 0) issues.push(`${taskLen} task`);
        if (workflowLen > 0) issues.push(`${workflowLen} quy trình mẫu`);
        messageApi.error(msg + issues.join(', '));
        setDeleting(false);
        return;
      }

      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', department.id);
      if (error) throw error;
      messageApi.success('Đã xóa bộ phận');
      onRefresh?.();
      onClose();
    } catch (err) {
      console.error(err);
      messageApi.error('Lỗi khi xóa bộ phận');
    } finally {
      setDeleting(false);
    }
  };

  const staffColumns = [
    { 
      title: 'Nhân viên', 
      key: 'name',
      render: (_: any, r: any) => (
        <Space>
          <Avatar size="small">{r.full_name?.[0]}</Avatar>
          <Text strong>{r.full_name}</Text>
        </Space>
      )
    },
    { 
      title: 'Chức vụ', 
      dataIndex: ['roles', 'name'], 
      key: 'role',
      render: (t: string) => <Tag color="purple">{t}</Tag>
    },
    { 
      title: 'Trạng thái', 
      dataIndex: 'is_active', 
      key: 'status',
      render: (v: boolean) => <Tag color={v !== false ? 'green' : 'red'}>{v !== false ? 'Hoạt động' : 'Nghỉ'}</Tag>
    },
  ];

  const machineColumns = [
    { 
      title: 'Mã máy', 
      dataIndex: 'code', 
      key: 'code',
      render: (t: string) => <Text strong className="text-blue-600">{t}</Text>
    },
    { 
      title: 'Tên máy', 
      dataIndex: 'name', 
      key: 'name'
    },
    { 
      title: 'Loại', 
      dataIndex: 'type', 
      key: 'type',
      render: (t: string) => <Tag color="cyan">{t}</Tag>
    },
    { 
      title: 'Trạng thái', 
      dataIndex: 'status', 
      key: 'status',
      render: (s: string) => <Tag color={s === 'active' ? 'green' : 'red'}>{s === 'active' ? 'Hoạt động' : 'Bảo trì'}</Tag>
    },
  ];

  const tabItems = [
    {
      key: '1',
      label: <span><InfoCircleOutlined /> Thông tin chung</span>,
      children: (
        <div className="p-4">
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item name="code" label="Mã bộ phận" rules={[{ required: true }]}>
                  <Input placeholder="VD: PRINT" disabled={!!department} />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item name="name" label="Tên bộ phận" rules={[{ required: true }]}>
                  <Input placeholder="VD: Bộ phận In" />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="step_name" label="Bước">
                  <AutoComplete
                    options={STEP_OPTIONS}
                    placeholder="Gõ mới hoặc chọn nhanh: Bước 1, Bước 2, Bước 3..."
                    filterOption={(inputValue, option) =>
                      (option?.value ?? '').toUpperCase().includes(inputValue.toUpperCase())
                    }
                  />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="description" label="Mô tả">
                  <TextArea rows={2} placeholder="Mô tả chức năng của bộ phận" />
                </Form.Item>
              </Col>
            </Row>
            <Divider />
            <div className="flex justify-between mt-4">
              {department ? (
                <Popconfirm
                  title="Xóa bộ phận này?"
                  description="Hành động này không thể hoàn tác."
                  onConfirm={handleDelete}
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true, loading: deleting }}
                >
                  <Button danger icon={<DeleteOutlined />}>Xóa Bộ phận</Button>
                </Popconfirm>
              ) : <div />}
              <Space>
                <Button onClick={onClose}>Hủy</Button>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                  {department ? 'Lưu thay đổi' : 'Tạo mới'}
                </Button>
              </Space>
            </div>
          </Form>
        </div>
      ),
    },
    {
      key: '2',
      label: <span><TeamOutlined /> Nhân sự ({staff.length})</span>,
      disabled: !department,
      children: (
        <div className="p-4">
          <div className="flex justify-end mb-3">
            <Button type="primary" onClick={() => setAddStaffVisible(true)}>
              Thêm nhân sự
            </Button>
          </div>
          <Row gutter={16} className="mb-4">
            <Col span={8}>
              <Card size="small" className="bg-blue-50 border-blue-100 text-center">
                <Statistic title="Tổng nhân viên" value={staff.length} styles={{ content: { fontWeight: 'bold' } }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" className="bg-green-50 border-green-100 text-center">
                <Statistic title="Đang hoạt động" value={staff.filter(s => s.is_active !== false).length} styles={{ content: { color: '#52c41a', fontWeight: 'bold' } }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" className="bg-orange-50 border-orange-100 text-center">
                <Statistic title="Nghỉ/Chuyển" value={staff.filter(s => s.is_active === false).length} styles={{ content: { color: '#fa8c16', fontWeight: 'bold' } }} />
              </Card>
            </Col>
          </Row>
          <Table 
            columns={staffColumns} 
            dataSource={staff} 
            rowKey="id" 
            loading={loadingStaff}
            pagination={{ pageSize: 5 }}
            size="small"
            locale={{ emptyText: <Empty description="Chưa có nhân viên nào" /> }}
          />
        </div>
      ),
    },
    {
      key: '3',
      label: <span><ToolOutlined /> Máy móc ({machines.length})</span>,
      disabled: !department,
      children: (
        <div className="p-4">
          <Row gutter={16} className="mb-4">
            <Col span={12}>
              <Card size="small" className="bg-green-50 border-green-100 text-center">
                <Statistic title="Máy hoạt động" value={machines.filter(m => m.status === 'active').length} styles={{ content: { color: '#52c41a', fontWeight: 'bold' } }} />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" className="bg-red-50 border-red-100 text-center">
                <Statistic title="Đang bảo trì" value={machines.filter(m => m.status !== 'active').length} styles={{ content: { color: '#f5222d', fontWeight: 'bold' } }} />
              </Card>
            </Col>
          </Row>
          <Table 
            columns={machineColumns} 
            dataSource={machines} 
            rowKey="id" 
            loading={loadingMachines}
            pagination={{ pageSize: 5 }}
            size="small"
            locale={{ emptyText: <Empty description="Chưa có máy móc nào" /> }}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Modal
        title={department ? `Bộ phận: ${department.name}` : 'Thêm Bộ phận mới'}
        open={visible}
        onCancel={onClose}
        footer={null}
        width={900}
      >
        <Tabs defaultActiveKey="1" items={tabItems} destroyOnHidden />
      </Modal>

      <Modal
        title={`Thêm nhân sự - ${department?.name || 'Bộ phận'}`}
        open={addStaffVisible}
        onCancel={() => {
          setAddStaffVisible(false);
          staffForm.resetFields();
        }}
        onOk={() => staffForm.submit()}
        okText="Thêm"
        cancelText="Hủy"
        confirmLoading={savingStaff}
      >
        <Form
          form={staffForm}
          layout="vertical"
          onFinish={handleAddStaff}
        >
          <Form.Item name="user_id" label="Họ và tên" rules={[{ required: true, message: 'Chọn nhân sự' }]}>
            <Select
              showSearch
              placeholder="Chọn nhân sự từ danh sách"
              optionFilterProp="label"
              options={assignableUsers.map((user: any) => ({
                value: user.id,
                label: `${user.full_name || user.username} - ${user.roles?.name || 'Chưa có chức vụ'}`
              }))}
              notFoundContent="Không còn nhân sự để gán"
            >
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
