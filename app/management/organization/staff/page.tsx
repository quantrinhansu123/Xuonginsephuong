'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Card, Typography, message, Tag, Avatar, Popconfirm, Badge } from 'antd';
import { PlusOutlined, EditOutlined, UserOutlined, TeamOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import StaffDetailModal from '@/components/organization/StaffDetailModal';

const { Title, Text } = Typography;

export default function StaffPage() {
  const [data, setData] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          departments (name, code),
          roles (name, portal)
        `)
        .order('created_at', { ascending: false });
      
      if (userError) throw userError;
      setData(users || []);

      const { data: depts } = await supabase.from('departments').select('*').order('id', { ascending: true });
      setDepartments(depts || []);

      const { data: roleList } = await supabase.from('roles').select('*').order('id', { ascending: true });
      setRoles(roleList || []);

    } catch (err) {
      console.error(err);
      message.error('Không thể tải dữ liệu nhân sự');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddEdit = (user: any = null) => {
    setCurrentUser(user);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);
      if (error) throw error;
      message.success('Đã xóa nhân viên');
      fetchData();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi xóa nhân viên');
    }
  };

  const columns = [
    {
      title: 'Nhân viên',
      key: 'user',
      render: (_: any, record: any) => (
        <Space>
          <Avatar icon={<UserOutlined />} className="bg-blue-600" />
          <div>
            <div className="font-bold text-sm">{record.full_name}</div>
            <Text type="secondary" style={{ fontSize: '11px' }}>@{record.username}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Chức vụ',
      dataIndex: ['roles', 'name'],
      key: 'role',
      render: (role: string) => <Tag color="purple">{role}</Tag>,
    },
    {
      title: 'Bộ phận',
      dataIndex: ['departments', 'name'],
      key: 'department',
      render: (dept: string) => <Tag color="blue">{dept || 'Chưa gán'}</Tag>,
    },
    {
      title: 'Ngày tham gia',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 100,
      align: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          <Button title="Xem/Sửa" type="text" icon={<EditOutlined />} onClick={() => handleAddEdit(record)} />
          <Popconfirm title="Xóa nhân viên này?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy">
            <Button title="Xóa" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in">
      <div className="flex justify-between items-end">
        <div>
          <Title level={2} className="m-0 font-black tracking-tight text-slate-900">
            STAFF <span className="text-blue-600">MANAGEMENT</span>
          </Title>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 w-8 bg-blue-600 rounded-full" />
            <Text className="premium-label text-slate-400">Quản trị nhân sự • Tài khoản, Chức vụ & Phân quyền nội bộ</Text>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button icon={<ReloadOutlined />} onClick={fetchData} className="h-12 w-12 rounded-2xl border-slate-200 flex items-center justify-center text-xl" />
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => handleAddEdit()}
            className="h-12 px-8 rounded-2xl font-bold bg-blue-600 hover:bg-blue-700 shadow-blue-200 shadow-lg border-none"
          >
            THÊM NHÂN SỰ
          </Button>
        </div>
      </div>

      <div className="premium-shadow rounded-[32px] overflow-hidden bg-white border border-slate-100">
        <Table 
          columns={[
            {
              title: 'Nhân viên',
              key: 'user',
              render: (_: any, record: any) => (
                <Space size="middle">
                  <Avatar 
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${record.username}`} 
                    className="shadow-sm border border-slate-100" 
                  />
                  <div className="flex flex-col">
                    <Text strong className="text-slate-900 leading-tight">{record.full_name}</Text>
                    <Text className="text-[10px] text-slate-400 font-bold uppercase">@{record.username}</Text>
                  </div>
                </Space>
              ),
            },
            {
              title: 'Chức vụ',
              dataIndex: ['roles', 'name'],
              key: 'role',
              render: (role: string) => <Tag color="purple" className="rounded-lg border-none font-bold px-3 py-0.5">{role}</Tag>,
            },
            {
              title: 'Phân hệ',
              dataIndex: ['roles', 'portal'],
              key: 'portal',
              render: (portal: string) => (
                <Tag color={portal === 'management' ? 'blue' : 'green'} className="rounded-lg border-none font-bold px-3 py-0.5 uppercase text-[10px]">
                  {portal === 'management' ? 'Quản lý' : 'Sản xuất'}
                </Tag>
              ),
            },
            {
              title: 'Bộ phận',
              dataIndex: ['departments', 'name'],
              key: 'department',
              render: (dept: string) => <Text className="font-medium text-slate-600">{dept || '---'}</Text>,
            },
            {
              title: 'Trạng thái',
              key: 'status',
              render: () => <Badge status="success" text={<Text className="text-[11px] font-bold text-slate-500">HOẠT ĐỘNG</Text>} />,
            },
            {
              title: 'Tham gia',
              dataIndex: 'created_at',
              key: 'created_at',
              render: (date: string) => <Text className="text-slate-500 font-medium">{new Date(date).toLocaleDateString('vi-VN')}</Text>,
            },
            {
              title: 'Thao tác',
              key: 'action',
              width: 100,
              align: 'right' as const,
              render: (_: any, record: any) => (
                <Space>
                  <Button type="text" icon={<EditOutlined className="text-slate-400" />} onClick={() => handleAddEdit(record)} />
                  <Popconfirm title="Xóa nhân viên này?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy">
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]} 
          dataSource={data} 
          rowKey="id" 
          loading={loading} 
          className="designer-table"
          pagination={{ pageSize: 12, placement: 'bottomCenter' }}
        />
      </div>

      <StaffDetailModal
        visible={modalVisible}
        staff={currentUser}
        departments={departments}
        roles={roles}
        onClose={() => setModalVisible(false)}
        onRefresh={fetchData}
      />
    </div>
  );
}
