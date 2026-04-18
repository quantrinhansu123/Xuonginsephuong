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
      onCell: () => ({ 'data-label': 'Lệnh in' } as any),
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0} className="text-left">
          <Text strong className="text-blue-600 font-mono tracking-tighter">{record.production_orders?.code}</Text>
          <Text className="text-[11px] text-slate-400 font-bold uppercase truncate max-w-[200px]">{record.production_orders?.title}</Text>
        </Space>
      ),
    },
    {
      title: 'Bộ phận',
      dataIndex: ['departments', 'name'],
      key: 'dept',
      onCell: () => ({ 'data-label': 'Bộ phận' } as any),
      render: (name: string, record: any) => (
        <div className="flex flex-col gap-1 items-end sm:items-start text-right sm:text-left">
          <Tag color={record.department_id === user.department_id ? 'blue' : 'orange'} className="rounded-lg border-none font-bold px-3 py-0.5 m-0 uppercase text-[10px]">
            {name}
          </Tag>
          {record.material_shortage && <Tag color="red" className="rounded-lg border-none font-bold px-2 py-0.5 m-0 text-[9px] animate-pulse">THIẾU VẬT TƯ</Tag>}
        </div>
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      onCell: () => ({ 'data-label': 'Tình trạng' } as any),
      render: (status: string) => {
        const configs: any = {
          ready: { color: 'cyan', icon: <ThunderboltOutlined />, label: 'SẴN SÀNG' },
          in_progress: { color: 'blue', icon: <ReloadOutlined spin />, label: 'ĐANG LÀM' },
          done: { color: 'emerald', icon: <CheckCircleOutlined />, label: 'HOÀN TẤT' },
          issue: { color: 'rose', icon: <WarningOutlined />, label: 'SỰ CỐ' },
          on_hold: { color: 'amber', icon: <ClockCircleOutlined />, label: 'TẠM HOÃN' }
        };
        const cfg = configs[status] || { color: 'slate', icon: <ClockCircleOutlined />, label: status.toUpperCase() };
        return (
          <Tag color={cfg.color} icon={cfg.icon} className="rounded-lg border-none font-bold px-3 py-1 flex items-center w-fit gap-1 text-[10px]">
            {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: 'Cập nhật',
      dataIndex: 'updated_at',
      key: 'updated_at',
      onCell: () => ({ 'data-label': 'Cập nhật' } as any),
      render: (date: string) => <Text className="text-slate-400 font-bold text-[11px] font-mono">{new Date(date).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</Text>,
    },
    {
      title: 'Thao tác',
      key: 'action',
      fixed: 'right' as const,
      width: 140,
      onCell: () => ({ 'data-label': 'Thao tác' } as any),
      render: (_: any, record: any) => (
        <Button 
          type="primary" 
          icon={<EyeOutlined />} 
          onClick={() => { setSelectedTask(record); setActionModalVisible(true); }}
          className={`font-black rounded-xl border-none shadow-lg h-10 w-full sm:w-auto px-6 ${record.department_id === user.department_id ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'}`}
        >
          {record.department_id === user.department_id ? 'XỬ LÝ' : 'VẬT TƯ'}
        </Button>
      ),
    },
  ];

  const stats = {
    ready: data.filter(t => t.status === 'ready').length,
    active: data.filter(t => t.status === 'in_progress').length,
    issues: data.filter(t => t.status === 'issue' || t.material_shortage).length
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-[1600px] mx-auto animate-in px-4 sm:px-0 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <Title level={2} className="m-0 font-black tracking-tighter text-slate-900 leading-tight">
            PRODUCTION <span className="text-indigo-600">TASKS</span>
          </Title>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 w-8 bg-indigo-600 rounded-full" />
            <Text className="premium-label text-slate-400">
               {user?.departments?.name} • {user?.department_id === 7 ? 'GIÁM SÁT VẬT TƯ' : 'NHIỆM VỤ SẢN XUẤT'}
            </Text>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button icon={<FileExcelOutlined />} onClick={exportToExcel} className="h-12 flex-1 sm:flex-none px-6 rounded-2xl font-bold border-slate-200">EXCEL</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchTasks} loading={loading} className="h-12 w-12 flex items-center justify-center rounded-2xl border-slate-200" />
        </div>
      </div>

      <Row gutter={[16, 16]}>
        {[
          { title: "SẴN SÀNG", value: stats.ready, icon: <ThunderboltOutlined />, color: "cyan" },
          { title: "ĐANG LÀM", value: stats.active, icon: <ReloadOutlined />, color: "blue", spin: true },
          { title: "SỰ CỐ", value: stats.issues, icon: <WarningOutlined />, color: "rose", highlight: stats.issues > 0 }
        ].map((stat, idx) => (
          <Col xs={24} sm={8} key={idx}>
            <div className={`ui-surface p-5 sm:p-6 flex items-center justify-between border-none ${stat.highlight ? 'animate-pulse-subtle border-l-4 border-rose-500 shadow-rose-100 shadow-lg' : ''}`}>
              <div className="flex flex-col">
                <Text className="premium-label mb-1 uppercase whitespace-nowrap">{stat.title}</Text>
                <span className={`text-3xl sm:text-4xl font-black tracking-tighter ${stat.highlight ? 'text-rose-600' : 'text-slate-900'} leading-none`}>
                  {stat.value}
                </span>
              </div>
              <div className={`p-4 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600 text-2xl shadow-sm border border-${stat.color}-100 flex items-center justify-center`}>
                {React.cloneElement(stat.icon as React.ReactElement<any>, { spin: stat.spin })}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <div className="glass-card p-4 rounded-[28px] flex flex-col lg:flex-row gap-4 items-center">
        <div className="w-full lg:flex-1">
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
        <div className="w-full lg:w-64">
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

      <div className="premium-shadow rounded-[32px] overflow-hidden bg-white border border-slate-100">
        <Table 
          
          columns={columns} 
          dataSource={data} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 12, position: ['bottomCenter'] } as any}
          className="designer-table"
          locale={{ emptyText: <Empty description="Hiện không có nhiệm vụ nào" /> }}
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
