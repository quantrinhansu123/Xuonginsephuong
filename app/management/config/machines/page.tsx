'use client';

import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Space, Card, Typography, message, Tag, Select, Popconfirm
} from 'antd';
import { 
  ToolOutlined, 
  PlusOutlined, 
  EditOutlined, 
  ReloadOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import MachineDetailModal from '@/components/config/MachineDetailModal';

const { Title, Text } = Typography;
const { Option } = Select;

export default function MachinesPage() {
  const [data, setData] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentMachine, setCurrentMachine] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: machineData, error: machineError } = await supabase
        .from('machines')
        .select(`
          *,
          departments (name, code)
        `)
        .order('code');
      if (machineError) throw machineError;
      setData(machineData || []);

      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .order('id');
      if (deptError) throw deptError;
      setDepartments(deptData || []);
    } catch (err) {
      message.error('Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddEdit = (machine: any = null) => {
    setCurrentMachine(machine);
    setModalVisible(true);
  };

  const handleToggleStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('machines')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
      message.success(`Đã cập nhật trạng thái máy`);
      fetchData();
    } catch (err) {
      message.error('Lỗi khi cập nhật');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('machines')
        .delete()
        .eq('id', id);
      if (error) throw error;
      message.success('Đã xóa máy');
      fetchData();
    } catch (err) {
      message.error('Lỗi khi xóa máy');
    }
  };

  const columns = [
    {
      title: 'Mã máy',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Tên máy',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const color = type === 'Digital' ? 'cyan' : type === 'Offset' ? 'purple' : 'green';
        return <Tag color={color}>{type}</Tag>;
      },
    },
    {
      title: 'Bộ phận',
      dataIndex: ['departments', 'name'],
      key: 'department',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: any) => (
        <Select 
          value={status} 
          size="small"
          style={{ width: 120 }}
          onChange={(value) => handleToggleStatus(record.id, value)}
        >
          <Option value="active"><Tag color="green">Hoạt động</Tag></Option>
          <Option value="maintenance"><Tag color="orange">Bảo trì</Tag></Option>
          <Option value="inactive"><Tag color="red">Ngưng</Tag></Option>
        </Select>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 80,
      render: (_: any, record: any) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleAddEdit(record)} />
          <Popconfirm title="Xóa máy này?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy">
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
            EQUIPMENT <span className="text-emerald-600">MANAGEMENT</span>
          </Title>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 w-8 bg-emerald-600 rounded-full" />
            <Text className="premium-label text-slate-400">Quản lý danh sách máy móc • Trạng thái vận hành</Text>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button icon={<ReloadOutlined />} onClick={fetchData} className="h-12 w-12 rounded-2xl border-slate-200 flex items-center justify-center text-xl" />
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => handleAddEdit()}
            className="h-12 px-8 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 shadow-lg border-none"
          >
            THÊM MÁY MÓC
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
          pagination={{ pageSize: 12, position: ['bottomCenter'] }}
        />
      </div>

      <MachineDetailModal
        visible={modalVisible}
        machine={currentMachine}
        departments={departments}
        onClose={() => setModalVisible(false)}
        onRefresh={fetchData}
      />
    </div>
  );
}
