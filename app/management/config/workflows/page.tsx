'use client';

import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Space, Card, Typography, message, Tag, Switch, Popconfirm
} from 'antd';
import { 
  NodeIndexOutlined, 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  ReloadOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import { clearCache } from '@/lib/auth';
import WorkflowDetailModal from '@/components/config/WorkflowDetailModal';

const { Title, Text } = Typography;

export default function WorkflowsPage() {
  const [data, setData] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: wfData, error: wfError } = await supabase
        .from('workflow_templates')
        .select('*')
        .order('name');
      if (wfError) throw wfError;
      setData(wfData || []);

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

  const handleAddEdit = (workflow: any = null) => {
    setCurrentWorkflow(workflow);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('workflow_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      clearCache();
      message.success('Đã xóa quy trình');
      fetchData();
    } catch (err) {
      message.error('Lỗi khi xóa quy trình');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('workflow_templates')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
      clearCache();
      message.success(`Đã ${isActive ? 'kích hoạt' : 'vô hiệu hóa'} quy trình`);
      fetchData();
    } catch (err) {
      message.error('Lỗi khi cập nhật');
    }
  };

  const getDeptName = (deptId: number) => {
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || `ID: ${deptId}`;
  };

  const columns = [
    {
      title: 'Tên quy trình',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Chuỗi bộ phận',
      dataIndex: 'department_sequence',
      key: 'sequence',
      render: (sequence: number[]) => (
        <div className="flex flex-wrap gap-1">
          {sequence?.map((deptId, idx) => (
            <span key={deptId}>
              <Tag color="blue">{getDeptName(deptId)}</Tag>
              {idx < sequence.length - 1 && <span className="text-gray-400">→</span>}
            </span>
          ))}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean, record: any) => (
        <Switch 
          checked={active} 
          onChange={(checked) => handleToggleActive(record.id, checked)}
          checkedChildren="Hoạt động"
          unCheckedChildren="Tắt"
        />
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 80,
      render: (_: any, record: any) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleAddEdit(record)} />
          <Popconfirm title="Xóa quy trình này?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy">
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
            WORKFLOW <span className="text-indigo-600">TEMPLATES</span>
          </Title>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 w-8 bg-indigo-600 rounded-full" />
            <Text className="premium-label text-slate-400">Cấu hình các quy trình sản xuất mẫu • Luồng công việc</Text>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button icon={<ReloadOutlined />} onClick={fetchData} className="h-12 w-12 rounded-2xl border-slate-200 flex items-center justify-center text-xl" />
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => handleAddEdit()}
            className="h-12 px-8 rounded-2xl font-bold bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 shadow-lg border-none"
          >
            THÊM QUY TRÌNH
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

      <WorkflowDetailModal
        visible={modalVisible}
        workflow={currentWorkflow}
        departments={departments}
        onClose={() => setModalVisible(false)}
        onRefresh={() => { clearCache(); fetchData(); }}
      />
    </div>
  );
}