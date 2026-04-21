'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Card, Typography, message, Tag, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import { clearCache } from '@/lib/auth';
import DepartmentDetailModal from '@/components/organization/DepartmentDetailModal';

const { Title, Text } = Typography;

const STEP_TAG_COLORS = ['geekblue', 'purple', 'cyan', 'green', 'gold', 'magenta'];

export default function DepartmentsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentDept, setCurrentDept] = useState<any>(null);
  const [ownersByDeptId, setOwnersByDeptId] = useState<Record<number, any>>({});

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const [{ data: depts, error }, { data: users, error: usersError }] = await Promise.all([
        supabase
          .from('departments')
          .select('*')
          .order('id', { ascending: true }),
        supabase
          .from('users')
          .select('id, full_name, username, department_id, roles:role_id (name)')
          .not('department_id', 'is', null)
      ]);

      if (error) throw error;
      if (usersError) throw usersError;

      const usersByDept = (users || []).reduce((acc: Record<number, any[]>, user: any) => {
        if (!acc[user.department_id]) {
          acc[user.department_id] = [];
        }
        acc[user.department_id].push(user);
        return acc;
      }, {});

      const resolvedOwners = Object.entries(usersByDept).reduce((acc: Record<number, any>, [deptId, deptUsers]) => {
        const sortedUsers = [...(deptUsers as any[])].sort((a, b) => {
          const roleA = (a.roles?.name || '').toLowerCase();
          const roleB = (b.roles?.name || '').toLowerCase();
          const priority = (role: string) =>
            (role.includes('quản lý') || role.includes('giam doc') || role.includes('giám đốc') || role.includes('điều phối') || role.includes('truong') || role.includes('trưởng')) ? 0 : 1;
          const byRolePriority = priority(roleA) - priority(roleB);
          if (byRolePriority !== 0) return byRolePriority;
          return (a.full_name || a.username || '').localeCompare(b.full_name || b.username || '');
        });
        acc[Number(deptId)] = sortedUsers[0];
        return acc;
      }, {});

      setOwnersByDeptId(resolvedOwners);
      setData(depts || []);
    } catch (err) {
      console.error(err);
      messageApi.error('Không thể tải danh sách bộ phận');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleAddEdit = (dept: any = null) => {
    setCurrentDept(dept);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);
      if (error) throw error;
      clearCache();
      messageApi.success('Đã xóa bộ phận');
      fetchDepartments();
    } catch (err: any) {
      if (err?.code === '23503') {
        messageApi.warning('Không thể xóa vì bộ phận vẫn đang được tham chiếu (máy móc / dữ liệu liên quan).');
        return;
      }
      messageApi.error('Lỗi khi xóa bộ phận');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
      onCell: () => ({ 'data-label': 'ID' } as any),
    },
    {
      title: 'Mã bộ phận',
      dataIndex: 'code',
      key: 'code',
      onCell: () => ({ 'data-label': 'Mã' } as any),
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Tên bộ phận',
      dataIndex: 'name',
      key: 'name',
      onCell: () => ({ 'data-label': 'Tên bộ phận' } as any),
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Người phụ trách',
      key: 'owner',
      onCell: () => ({ 'data-label': 'Người phụ trách' } as any),
      render: (_: any, record: any) => {
        const owner = ownersByDeptId[record.id];
        if (!owner) return <Text type="secondary">Chưa phân công</Text>;
        return (
          <div className="flex flex-col leading-tight">
            <Text strong>{owner.full_name || owner.username}</Text>
            <Text className="text-[11px] text-slate-400 uppercase">{owner.roles?.name || 'Nhân sự'}</Text>
          </div>
        );
      },
    },
    {
      title: 'Bước',
      dataIndex: 'step_name',
      key: 'step_name',
      onCell: () => ({ 'data-label': 'Bước' } as any),
      render: (stepName: string, record: any) => {
        if (!stepName) return <Text type="secondary">---</Text>;
        const colorIndex = ((record.id || 1) - 1) % STEP_TAG_COLORS.length;
        return (
          <Tag color={STEP_TAG_COLORS[colorIndex]} className="rounded-lg border-none font-bold px-3 py-0.5">
            {stepName}
          </Tag>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 100,
      align: 'right' as const,
      onCell: () => ({ 'data-label': 'Thao tác' } as any),
      render: (_: any, record: any) => (
        <Space>
          <Button type="text" icon={<EditOutlined className="text-slate-400" />} onClick={() => handleAddEdit(record)} />
          <Popconfirm title="Xóa bộ phận này?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy">
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <div className="space-y-8 max-w-[1600px] mx-auto animate-in">
        <div className="flex justify-between items-end">
          <div>
            <Title level={2} className="m-0 font-black tracking-tight text-slate-900">
              MASTER <span className="text-indigo-600">DEPARTMENTS</span>
            </Title>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-1 w-8 bg-indigo-600 rounded-full" />
              <Text className="premium-label text-slate-400">Cấu hình hệ thống bộ phận • Phân quyền & Luồng vận hành</Text>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button icon={<ReloadOutlined />} onClick={fetchDepartments} className="h-12 w-12 rounded-2xl border-slate-200 flex items-center justify-center text-xl" />
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => handleAddEdit()}
              className="h-12 px-8 rounded-2xl font-bold bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 shadow-lg border-none"
            >
              THÊM BỘ PHẬN
            </Button>
          </div>
        </div>

        <div className="premium-shadow rounded-[32px] overflow-hidden bg-white border border-slate-100">
          <Table 
            
            columns={columns} 
            dataSource={data} 
            rowKey="id" 
            loading={loading} 
            className="designer-table"
            pagination={false}
          />
        </div>

        <DepartmentDetailModal
          visible={modalVisible}
          department={currentDept}
          onClose={() => setModalVisible(false)}
          onRefresh={() => { clearCache(); fetchDepartments(); }}
        />
      </div>
    </>
  );
}
