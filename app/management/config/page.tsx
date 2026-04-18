'use client';

import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Typography, Row, Col, Space, Button, 
  Tag, Tabs, List, Avatar, message, Modal, Form, Input, Select 
} from 'antd';
import { 
  SettingOutlined, 
  TeamOutlined, 
  DeploymentUnitOutlined, 
  SafetyCertificateOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  HistoryOutlined,
  NodeIndexOutlined,
  ToolOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;
const { Option } = Select;

export default function ConfigPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'role' | 'dept' | 'user'>('role');
  const [form] = Form.useForm();
  const router = useRouter();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: r } = await supabase.from('roles').select('*').order('id');
      const { data: d } = await supabase.from('departments').select('*').order('id');
      const { data: u } = await supabase.from('users').select('*, roles(name), departments(name)').order('created_at');
      
      setRoles(r || []);
      setDepartments(d || []);
      setUsers(u || []);
    } catch (err) {
      message.error('Lỗi khi tải cấu hình');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (values: any) => {
    try {
      let table = '';
      if (modalType === 'role') table = 'roles';
      else if (modalType === 'dept') table = 'departments';
      else if (modalType === 'user') table = 'users';

      if (modalType === 'user' && values.password) {
        const salt = bcrypt.genSaltSync(10);
        values.password = bcrypt.hashSync(values.password, salt);
      }

      const { error } = await supabase.from(table).insert([values]);
      if (error) throw error;
      
      message.success(`Đã thêm ${modalType} mới`);
      setModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      message.error('Lỗi khi lưu');
    }
  };

  const tabItems = [
    {
      key: '1',
      label: <span><TeamOutlined /> Quản lý Nhân sự</span>,
      children: (
        <Card className="shadow-sm border-none" styles={{ body: { padding: 0 } }}>
          <div className="p-4 flex justify-end">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setModalType('user'); setModalVisible(true); }}>Thêm Nhân viên</Button>
          </div>
          <Table 
            columns={[
              { title: 'Nhân viên', key: 'name', render: (_, r) => <Space><Avatar icon={<UserOutlined />} /> <Text strong>{r.full_name}</Text></Space> },
              { title: 'Tên đăng nhập', dataIndex: 'username', key: 'user' },
              { title: 'Vai trò', dataIndex: ['roles', 'name'], key: 'role', render: (t) => <Tag color="blue">{t}</Tag> },
              { title: 'Bộ phận', dataIndex: ['departments', 'name'], key: 'dept' },
              { title: 'Thao tác', key: 'action', render: () => <Space><Button size="small" icon={<EditOutlined />} /><Button size="small" danger icon={<DeleteOutlined />} /></Space> }
            ]}
            dataSource={users}
            rowKey="id"
            loading={loading}
          />
        </Card>
      )
    },
    {
      key: '2',
      label: <span><DeploymentUnitOutlined /> Vai trò & Bộ phận</span>,
      children: (
        <Row gutter={24}>
          <Col span={12}>
            <Card title="Danh sách Vai trò" extra={<Button size="small" icon={<PlusOutlined />} onClick={() => { setModalType('role'); setModalVisible(true); }} />}>
              <Table 
                dataSource={roles} 
                rowKey="id" 
                size="small"
                columns={[
                  { title: 'Tên vai trò', dataIndex: 'name', key: 'name' },
                  { title: 'Phân hệ', dataIndex: 'portal', key: 'portal', render: (p) => <Tag>{p.toUpperCase()}</Tag> }
                ]}
                pagination={false}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="Danh sách Bộ phận" extra={<Button size="small" icon={<PlusOutlined />} onClick={() => { setModalType('dept'); setModalVisible(true); }} />}>
              <Table 
                dataSource={departments} 
                rowKey="id" 
                size="small"
                columns={[
                  { title: 'Tên bộ phận', dataIndex: 'name', key: 'name' },
                  { title: 'Code', dataIndex: 'code', key: 'code' },
                  { title: 'Đầu vào', dataIndex: 'is_entry_point', key: 'entry', render: (v) => v ? <Tag color="green">Có</Tag> : <Tag>Không</Tag> }
                ]}
                pagination={false}
              />
            </Card>
          </Col>
        </Row>
      )
    },
    {
      key: '3',
      label: <span><NodeIndexOutlined /> Quy trình mẫu</span>,
      children: (
        <Card className="shadow-sm">
          <div className="mb-4">
            <Text type="secondary">Quản lý các quy trình sản xuất mẫu. Truy cập trang chi tiết để thêm/sửa.</Text>
          </div>
          <Button type="primary" onClick={() => router.push('/management/config/workflows')}>
            Quản lý Quy trình mẫu
          </Button>
        </Card>
      )
    },
    {
      key: '4',
      label: <span><ToolOutlined /> Máy móc</span>,
      children: (
        <Card className="shadow-sm">
          <div className="mb-4">
            <Text type="secondary">Quản lý danh sách máy móc theo từng bộ phận.</Text>
          </div>
          <Button type="primary" onClick={() => router.push('/management/config/machines')}>
            Quản lý Máy móc
          </Button>
        </Card>
      )
    }
  ];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in">
      <div className="flex justify-between items-end">
        <div>
          <Title level={2} className="m-0 font-black tracking-tight text-slate-900">
            MASTER <span className="text-blue-600">CONFIGURATION</span>
          </Title>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 w-8 bg-blue-600 rounded-full" />
            <Text className="premium-label text-slate-400">Quản trị nhân sự • Vai trò & Cấu hình cốt lõi</Text>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button icon={<HistoryOutlined />} className="h-12 w-12 rounded-2xl border-slate-200 flex items-center justify-center text-xl" />
        </div>
      </div>

      <Row gutter={[24, 24]}>
        {[
          { title: "NHÂN VIÊN", value: users.length, icon: <TeamOutlined />, color: "blue" },
          { title: "BỘ PHẬN", value: departments.length, icon: <DeploymentUnitOutlined />, color: "indigo" },
          { title: "VAI TRÒ", value: roles.length, icon: <SafetyCertificateOutlined />, color: "emerald" }
        ].map((stat, idx) => (
          <Col span={8} key={idx}>
            <div className="ui-surface p-6 flex items-center justify-between border-none">
              <div className="flex flex-col">
                <Text className="premium-label mb-1 whitespace-nowrap">{stat.title}</Text>
                <span className="text-3xl font-black text-slate-900 leading-none">{stat.value}</span>
              </div>
              <div className={`p-4 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600 text-2xl shadow-sm border border-${stat.color}-100`}>
                {stat.icon}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <Tabs defaultActiveKey="1" items={tabItems} centered className="premium-tabs-layout" />

      <Modal
        title={
          <div className="flex items-center gap-3">
            <div className={`p-2 bg-blue-50 text-blue-600 rounded-xl`}><SettingOutlined /></div>
            <div>
              <div className="text-lg font-black text-slate-900 leading-tight uppercase">THÊM {modalType}</div>
              <Text className="premium-label text-slate-400">System Configuration</Text>
            </div>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="back" onClick={() => setModalVisible(false)} className="rounded-xl font-bold">HỦY</Button>,
          <Button key="submit" type="primary" onClick={() => form.submit()} className="rounded-xl font-bold bg-blue-600 border-none px-6">LƯU CẤU HÌNH</Button>
        ]}
        width={500}
        centered
        className="premium-modal no-padding-body"
      >
        <div className="p-8">
          <Form form={form} layout="vertical" onFinish={handleCreate}>
            {modalType === 'role' && (
              <>
                <Form.Item name="name" label="Tên vai trò" rules={[{ required: true }]}><Input className="premium-select" /></Form.Item>
                <Form.Item name="portal" label="Phân hệ" rules={[{ required: true }]}><Select className="premium-select"><Option value="management">QUẢN LÝ</Option><Option value="operation">VẬN HÀNH</Option></Select></Form.Item>
              </>
            )}
            {modalType === 'dept' && (
              <>
                <Form.Item name="name" label="Tên bộ phận" rules={[{ required: true }]}><Input className="premium-select" /></Form.Item>
                <Form.Item name="code" label="Mã code (Viết hoa)" rules={[{ required: true }]}><Input className="premium-select" /></Form.Item>
              </>
            )}
            {modalType === 'user' && (
              <>
                <Form.Item name="full_name" label="Họ tên" rules={[{ required: true }]}><Input className="premium-select" /></Form.Item>
                <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true }]}><Input className="premium-select" /></Form.Item>
                <Form.Item name="password" label="Mật khẩu" rules={[{ required: true }]}><Input.Password className="premium-select" /></Form.Item>
                <Form.Item name="role_id" label="Vai trò" rules={[{ required: true }]}>
                  <Select className="premium-select">{roles.map(r => <Option key={r.id} value={r.id}>{r.name}</Option>)}</Select>
                </Form.Item>
                <Form.Item name="department_id" label="Bộ phận" rules={[{ required: true }]}>
                  <Select className="premium-select">{departments.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}</Select>
                </Form.Item>
              </>
            )}
          </Form>
        </div>
      </Modal>
    </div>
  );
}
