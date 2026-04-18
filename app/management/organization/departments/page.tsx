'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Card, Typography, message, Tag, Switch, Popconfirm, Badge } from 'antd';
import { PlusOutlined, EditOutlined, AppstoreOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import { clearCache } from '@/lib/auth';
import DepartmentDetailModal from '@/components/organization/DepartmentDetailModal';

const { Title, Text } = Typography;

const AVAILABLE_PERMISSIONS = [
  { value: 'tasks', label: 'Nhiệm vụ' },
  { value: 'warehouse', label: 'Kho' },
  { value: 'profile', label: 'Hồ sơ' },
];

export default function DepartmentsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentDept, setCurrentDept] = useState<any>(null);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const { data: depts, error } = await supabase
        .from('departments')
        .select('*')
        .order('id', { ascending: true });
      
      if (error) throw error;
      setData(depts || []);
    } catch (err) {
      console.error(err);
      message.error('Không thể tải danh sách bộ phận');
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
      message.success('Đã xóa bộ phận');
      fetchDepartments();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi xóa bộ phận');
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
      title: 'Đầu vào',
      dataIndex: 'is_entry_point',
      key: 'is_entry_point',
      onCell: () => ({ 'data-label': 'Loại' } as any),
      render: (v: boolean) => v ? <Tag color="green" className="rounded-lg border-none font-bold px-3 py-0.5 uppercase text-[10px]">TIẾP NHẬN LSX</Tag> : <Tag className="rounded-lg border-none font-bold px-3 py-0.5 uppercase text-[10px]">NỘI BỘ</Tag>,
    },
    {
      title: 'Quyền hạn',
      dataIndex: 'permissions',
      key: 'permissions',
      onCell: () => ({ 'data-label': 'Quyền hạn' } as any),
      render: (perms: string[]) => (
        <Space size={2} wrap>
          {perms?.length > 0 ? perms.map(p => {
            const perm = AVAILABLE_PERMISSIONS.find(ap => ap.value === p);
            return <Tag key={p} className="rounded-md border-slate-100 text-[11px] px-2">{perm?.label || p}</Tag>;
          }) : <Text className="text-slate-300 italic text-[11px]">Không có quyền</Text>}
        </Space>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      onCell: () => ({ 'data-label': 'Trạng thái' } as any),
      render: () => <Badge status="processing" text={<Text className="text-[10px] font-bold text-blue-500 uppercase">ĐANG VẬN HÀNH</Text>} />,
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
  );
}
