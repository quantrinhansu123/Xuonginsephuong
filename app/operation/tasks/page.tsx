'use client';

import React, { useState, useEffect } from 'react';
import { 
  Table, Input, Button, Space, Card, Typography, 
  Row, Col, Select, message, Tag, Tooltip, Empty 
} from 'antd';
import { 
  SearchOutlined, 
  ReloadOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  EnvironmentOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FilterOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import TaskActionModal from '@/components/operation/TaskActionModal';

const { Title, Text } = Typography;
const { Option } = Select;

export default function TasksPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [user, setUser] = useState<any>(null);
  
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('ppms_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const fetchTasks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          production_orders (code, title, specs),
          departments (name, code)
        `)
        .order('updated_at', { ascending: false });

      if (user.department_id === 7) {
        // Kho 2 see their tasks OR tasks on hold due to materials anywhere
        query = query.or(`department_id.eq.${user.department_id},material_shortage.eq.true`);
      } else {
        query = query.eq('department_id', user.department_id).neq('status', 'pending');
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data: tasks, error } = await query;
      if (error) throw error;
      
      let filtered = tasks || [];
      if (search) {
        filtered = filtered.filter(t => 
          t.production_orders?.code?.toLowerCase().includes(search.toLowerCase()) ||
          t.production_orders?.title?.toLowerCase().includes(search.toLowerCase())
        );
      }

      setData(filtered);
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi tải danh sách nhiệm vụ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user, statusFilter]);

  const exportToExcel = () => {
    const exportData = data.map(t => ({
      "Lệnh sản xuất": t.production_orders?.code,
      "Nội dung": t.production_orders?.title,
      "Bộ phận": t.departments?.name,
      "Trạng thái": t.status.toUpperCase(),
      "Bắt đầu": t.start_time ? new Date(t.start_time).toLocaleString() : '',
      "Kết thúc": t.end_time ? new Date(t.end_time).toLocaleString() : ''
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tasks");
    XLSX.writeFile(wb, `Tasks_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF() as any;
    const tableColumn = ["Lenh", "Noi dung", "Bo phan", "Trang thai"];
    const tableRows = data.map(t => [
      t.production_orders?.code,
      t.production_orders?.title,
      t.departments?.name,
      t.status
    ]);
    doc.autoTable(tableColumn, tableRows, { startY: 20 });
    doc.text("DANH SACH NHIEM VU SAN XUAT", 14, 15);
    doc.save(`Tasks_Export_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const columns = [
    {
      title: 'Lệnh Sản Xuất',
      key: 'order',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.production_orders?.code}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.production_orders?.title}</Text>
        </Space>
      ),
    },
    {
      title: 'Bộ phận',
      dataIndex: ['departments', 'name'],
      key: 'dept',
      render: (name: string, record: any) => (
        <Space>
          <Tag color={record.department_id === user.department_id ? 'blue' : 'orange'}>
            {name}
          </Tag>
          {record.material_shortage && <Tag color="red">Thiếu vật tư</Tag>}
        </Space>
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        let icon = <ClockCircleOutlined />;
        if (status === 'ready') { color = 'processing'; icon = <ThunderboltOutlined />; }
        if (status === 'in_progress') { color = 'blue'; icon = <ReloadOutlined spin />; }
        if (status === 'done') { color = 'success'; icon = <CheckCircleOutlined />; }
        if (status === 'issue') { color = 'error'; icon = <WarningOutlined />; }
        if (status === 'on_hold') { color = 'warning'; icon = <ClockCircleOutlined />; }
        return <Tag color={color} icon={icon}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Cập nhật cuối',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (date: string) => new Date(date).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
    },
    {
      title: 'Thao tác',
      key: 'action',
      fixed: 'right' as const,
      width: 120,
      render: (_: any, record: any) => (
        <Button 
          type="primary" 
          icon={<EyeOutlined />} 
          size="small"
          onClick={() => { setSelectedTask(record); setActionModalVisible(true); }}
        >
          {record.department_id === user.department_id ? 'Xử lý' : 'Giải quyết vật tư'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in">
      <div className="flex justify-between items-end">
        <div>
          <Title level={2} className="m-0 font-black tracking-tight text-slate-900">
            PRODUCTION <span className="text-indigo-600">TASKS</span>
          </Title>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 w-8 bg-indigo-600 rounded-full" />
            <Text className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
               {user?.departments?.name} • {user?.department_id === 7 ? 'GIÁM SÁT VẬT TƯ' : 'NHIỆM VỤ SẢN XUẤT'}
            </Text>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button icon={<FileExcelOutlined />} onClick={exportToExcel} className="h-12 px-6 rounded-2xl font-bold border-slate-200">EXCEL</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchTasks} loading={loading} className="h-12 w-12 flex items-center justify-center rounded-2xl border-slate-200" />
        </div>
      </div>

      <div className="glass-card p-4 rounded-[28px] grid grid-cols-12 gap-4 items-center">
        <div className="col-span-8">
          <Input 
            prefix={<SearchOutlined className="text-slate-400" />} 
            placeholder="Tìm theo mã lệnh, nội dung in..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            onPressEnter={fetchTasks}
            className="premium-select h-11"
            allowClear
          />
        </div>
        <div className="col-span-4">
          <Select 
            className="w-full premium-select" 
            value={statusFilter} 
            onChange={setStatusFilter}
          >
            <Option value="all">TẤT CẢ TRẠNG THÁI</Option>
            <Option value="ready">CHỜ NHẬN VIỆC</Option>
            <Option value="in_progress">ĐANG LÀM</Option>
            <Option value="done">HOÀN THÀNH</Option>
            <Option value="issue">CÓ SỰ CỐ</Option>
            <Option value="on_hold">TẠM HOÃN</Option>
          </Select>
        </div>
      </div>

      <div className="premium-shadow rounded-[32px] overflow-hidden bg-white">
        <Table 
          columns={columns} 
          dataSource={data} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 12, position: ['bottomCenter'] }}
          className="designer-table"
          locale={{ emptyText: <Empty description="Không có nhiệm vụ nào cần xử lý" /> }}
          scroll={{ x: 'max-content' }}
        />
      </div>

      <TaskActionModal 
        visible={actionModalVisible} 
        task={selectedTask} 
        onClose={() => setActionModalVisible(false)} 
        onRefresh={fetchTasks} 
      />
    </div>
  );
}
