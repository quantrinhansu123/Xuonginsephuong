'use client';

import React, { useState, useEffect } from 'react';
import {
  Table, Card, Typography, Row, Col, Space, Tag, Tooltip,
  Badge, Button, Statistic, Progress, Divider, Select, DatePicker, Segmented
} from 'antd';
import {
  DashboardOutlined,
  SyncOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
  ReloadOutlined,
  FilterOutlined,
  TableOutlined,
  BarChartOutlined as GanttOutlined,
  EyeOutlined,
  ContainerOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import dayjs from 'dayjs';
import OrderQuickViewModal from '@/components/dashboard/OrderQuickViewModal';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function DashboardPage() {
  const [data, setData] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<string | number>('Kanban');

  // Filters
  const [customerFilter, setCustomerFilter] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const [stats, setStats] = useState({
    total: 0,
    running: 0,
    issues: 0,
    completed: 0,
    avgDelay: 0,
    completionRate: 0
  });

  const [quickViewModalVisible, setQuickViewModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Basic Metadata
      const { data: deptData } = await supabase.from('departments').select('*').order('id', { ascending: true });
      setDepartments(deptData || []);

      const { data: custData } = await supabase.from('customers').select('id, name').order('name', { ascending: true });
      setCustomers(custData || []);

      // 2. Fetch Orders with Tasks
      let query = supabase
        .from('production_orders')
        .select(`
          id, code, title, status, created_at, customer_id,
          tasks (id, status, department_id, start_time, end_time, ready_at, updated_at, issue_log, material_shortage)
        `)
        .order('created_at', { ascending: false });

      if (customerFilter) {
        query = query.eq('customer_id', customerFilter);
      }

      if (dateRange) {
        query = query.gte('created_at', dateRange[0].startOf('day').toISOString());
        query = query.lte('created_at', dateRange[1].endOf('day').toISOString());
      }

      const { data: orders, error } = await query;
      if (error) throw error;

      let filteredOrders = orders || [];
      if (deptFilter) {
        filteredOrders = filteredOrders.filter(o => o.tasks.some((t: any) => t.department_id === deptFilter));
      }

      setData(filteredOrders);

      // Calculate Stats
      const total = filteredOrders.length || 0;
      const running = filteredOrders.filter(o => o.status === 'in_progress').length || 0;
      const completed = filteredOrders.filter(o => o.status === 'completed').length || 0;
      const issues = filteredOrders.filter(o => o.tasks?.some((t: any) => t.status === 'issue' || t.status === 'on_hold')).length || 0;

      let totalDelayHours = 0;
      let delayedTaskCount = 0;
      filteredOrders.forEach(o => {
        o.tasks?.forEach((t: any) => {
          if (t.status === 'ready' && t.ready_at) {
            const delay = dayjs().diff(dayjs(t.ready_at), 'hour');
            if (delay >= 1) {
              totalDelayHours += delay;
              delayedTaskCount++;
            }
          }
        });
      });

      setStats({
        total,
        running,
        issues,
        completed,
        avgDelay: delayedTaskCount > 0 ? Math.round(totalDelayHours / delayedTaskCount) : 0,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [customerFilter, deptFilter, dateRange]);

  const getTaskCell = (tasks: any[], deptId: number) => {
    const task = tasks?.find(t => t.department_id === deptId);
    if (!task) return null;

    let icon = <ClockCircleOutlined />;
    let isDelayed = false;
    let delayHours = 0;

    if (task.status === 'ready' && task.ready_at) {
      delayHours = dayjs().diff(dayjs(task.ready_at), 'hour');
      if (delayHours >= 1) isDelayed = true;
    }

    if (task.status === 'done') icon = <CheckCircleOutlined />;
    else if (task.status === 'in_progress') icon = <SyncOutlined spin />;
    else if (task.status === 'issue') icon = <WarningOutlined />;
    else if (task.status === 'on_hold') icon = <PlayCircleOutlined />;
    else if (task.status === 'ready') icon = <PlayCircleOutlined />;

    return (
      <Tooltip title={
        <div className="p-2">
          <div className="font-black text-[10px] tracking-wider opacity-70 mb-1">{task.status.toUpperCase()}</div>
          {task.ready_at && <div className="text-xs">Sẵn sàng: {dayjs(task.ready_at).format('HH:mm DD/MM')}</div>}
          {isDelayed && <div className="text-rose-400 font-bold text-xs mt-1">TRỄ: {delayHours}H</div>}
          {task.material_shortage && <div className="text-amber-300 text-xs">THIẾU VẬT TƯ</div>}
        </div>
      } color={isDelayed ? '#ef4444' : '#1e293b'} overlayInnerStyle={{ borderRadius: '12px' }}>
        <div
          className={`
            relative group overflow-hidden cursor-pointer
            flex items-center justify-center h-10 w-full rounded-xl border-2 transition-all duration-300
            ${task.status === 'done' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
              task.status === 'in_progress' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' :
                task.status === 'issue' || isDelayed ? 'bg-rose-50 border-rose-100 text-rose-600' :
                  task.status === 'on_hold' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                    'bg-slate-50 border-slate-100 text-slate-400'}
            ${isDelayed ? 'animate-pulse hover:scale-105 shadow-lg shadow-rose-200' : 'hover:border-current'}
          `}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-current" />
          <div className="flex flex-col items-center">
            <span className="text-[14px] font-black tracking-tight">{icon}</span>
          </div>
          {isDelayed && (
            <div className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
          )}
        </div>
      </Tooltip>
    );
  };


  const ganttColumns = [
    {
      title: 'Lệnh Sản Xuất',
      dataIndex: 'code',
      key: 'code',
      width: 200,
      render: (text: string, record: any) => (
        <div>
          <Text strong className="text-blue-600 block">{text}</Text>
          <Text type="secondary" style={{ fontSize: '10px' }}>{record.title}</Text>
        </div>
      )
    },
    {
      title: 'Dòng thời gian quy trình (Bộ phận)',
      key: 'gantt',
      render: (_: any, record: any) => (
        <div className="flex w-full bg-gray-100 rounded-lg h-10 items-center px-1 overflow-hidden">
          {departments.map((dept, idx) => {
            const task = record.tasks.find((t: any) => t.department_id === dept.id);
            if (!task) return <div key={dept.id} className="flex-1" />;

            let color = '#e2e8f0'; // pending
            if (task.status === 'done') color = '#10b981';
            else if (task.status === 'in_progress') color = '#3b82f6';
            else if (task.status === 'ready') color = '#06b6d4';
            else if (task.status === 'on_hold' || task.status === 'issue') color = '#f43f5e';

            return (
              <div
                key={dept.id}
                className="h-8 flex-1 border-r border-white first:rounded-l-md last:rounded-r-md flex items-center justify-center text-[8px] font-bold text-white transition-all hover:scale-105"
                style={{ backgroundColor: color }}
              >
                <Tooltip title={`${dept.name}: ${task.status.toUpperCase()}`}>
                  {dept.code}
                </Tooltip>
              </div>
            );
          })}
        </div>
      )
    }
  ];

  const columns = [
    {
      title: 'Lệnh Sản Xuất',
      dataIndex: 'code',
      key: 'code',
      fixed: 'left' as const,
      width: 180,
      render: (text: string, record: any) => (
        <div
          className="flex flex-col cursor-pointer group py-1"
          onClick={() => { setSelectedOrder(record); setQuickViewModalVisible(true); }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
            <Text strong className="text-slate-900 font-mono text-sm tracking-tight group-hover:text-indigo-600 transition-colors">
              {text}
            </Text>
          </div>
          <Text type="secondary" style={{ fontSize: '11px' }} className="mt-1 pl-4" ellipsis={{ tooltip: record.title }}>
            {record.title}
          </Text>
        </div>
      ),
    },
    ...departments.map(dept => ({
      title: dept.name,
      key: `dept_${dept.id}`,
      align: 'center' as const,
      width: 110,
      render: (_: any, record: any) => getTaskCell(record.tasks, dept.id),
    })),
    {
      title: '',
      key: 'action',
      fixed: 'right' as const,
      width: 50,
      render: (_: any, record: any) => (
        <Button
          type="text"
          icon={<EyeOutlined className="text-slate-400 group-hover:text-indigo-600" />}
          onClick={() => { setSelectedOrder(record); setQuickViewModalVisible(true); }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <Title level={2} className="m-0 font-black tracking-tight text-slate-900">
            MASTER <span className="text-indigo-600">DASHBOARD</span>
          </Title>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 w-8 bg-indigo-600 rounded-full" />
            <Text className="premium-label text-slate-400">Tư duy hệ thống • Điều phối đa phân hệ</Text>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { label: 'BẢNG TỔNG', value: 'Kanban', icon: <TableOutlined /> },
              { label: 'TIẾN ĐỘ', value: 'Gantt', icon: <GanttOutlined /> },
            ]}
            className="premium-segmented p-1 bg-slate-100 rounded-2xl"
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchData}
            loading={loading}
            className="h-12 px-6 rounded-2xl font-bold border-none shadow-sm hover:shadow-md transition-all"
          >
            REFRESH
          </Button>
        </div>
      </div>

      <div className="glass-card p-4 rounded-[28px] grid grid-cols-12 gap-4 items-center">
        <div className="col-span-3">
          <Select
            className="w-full premium-select"
            placeholder="Khách hàng"
            allowClear
            showSearch
            onChange={setCustomerFilter}
            size="large"
          >
            {customers.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
          </Select>
        </div>
        <div className="col-span-3">
          <Select
            className="w-full premium-select"
            placeholder="Bộ phận"
            allowClear
            onChange={setDeptFilter}
            size="large"
          >
            {departments.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}
          </Select>
        </div>
        <div className="col-span-4">
          <RangePicker
            className="w-full premium-datepicker h-[40px] rounded-xl border-slate-200"
            onChange={(dates) => setDateRange(dates as any)}
            size="large"
          />
        </div>
        <div className="col-span-2 text-right">
          <Tag color="indigo" className="m-0 border-none px-4 py-1.5 rounded-full font-bold shadow-sm">
            {data.length} LỆNH ĐANG HIỂN THỊ
          </Tag>
        </div>
      </div>

      <Row gutter={[24, 24]}>
        {[
          { title: "TỔNG LỆNH", value: stats.total, icon: <ContainerOutlined />, color: "indigo" },
          { title: "HOÀN TẤT", value: stats.completionRate, suffix: "%", icon: <CheckCircleOutlined />, color: "emerald" },
          { title: "ĐỘ TRỄ TB", value: stats.avgDelay, suffix: "h", icon: <ClockCircleOutlined />, color: stats.avgDelay > 1 ? "rose" : "amber" },
          { title: "SỰ CỐ", value: stats.issues, icon: <WarningOutlined />, color: "rose" }
        ].map((stat, idx) => (
          <Col span={6} key={idx}>
            <div className="ui-surface p-6 flex items-center justify-between border-none">
              <div className="flex flex-col">
                <Text className="premium-label mb-1 whitespace-nowrap">{stat.title}</Text>
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-3xl font-black text-slate-900 leading-none">{stat.value}</span>
                  {stat.suffix && <span className="text-sm font-bold text-slate-400">{stat.suffix}</span>}
                </div>
              </div>
              <div className={`p-4 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600 text-2xl shadow-sm border border-${stat.color}-100`}>
                {stat.icon}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <div className="premium-shadow rounded-[32px] overflow-hidden bg-white">
        <Table
          columns={viewMode === 'Kanban' ? columns : ganttColumns}
          dataSource={data}
          rowKey="id"
          pagination={{ pageSize: 10, placement: 'bottomCenter' } as any}
          scroll={{ x: 'max-content', y: 600 }}
          className="designer-table"
          loading={loading}
          size="large"
        />
      </div>

      <div className="glass-card p-6 rounded-[24px] flex flex-wrap gap-8 justify-center border-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border-2 border-indigo-100 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600"><PlayCircleOutlined /></div>
          <Text className="text-[10px] font-black text-slate-500 tracking-wider">READY</Text>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border-2 border-rose-100 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 animate-pulse"><WarningOutlined /></div>
          <Text className="text-[10px] font-black text-rose-600 tracking-wider">DELAYED {">"} 1H</Text>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border-2 border-amber-100 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><ClockCircleOutlined /></div>
          <Text className="text-[10px] font-black text-slate-500 tracking-wider">HOLD / ISSUE</Text>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border-2 border-emerald-100 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><CheckCircleOutlined /></div>
          <Text className="text-[10px] font-black text-slate-500 tracking-wider">COMPLETED</Text>
        </div>
      </div>

      <OrderQuickViewModal
        visible={quickViewModalVisible}
        order={selectedOrder}
        departments={departments}
        onClose={() => setQuickViewModalVisible(false)}
        onNavigate={(direction) => {
          const currentIndex = data.findIndex(o => o.id === selectedOrder?.id);
          if (direction === 'next' && currentIndex < data.length - 1) {
            setSelectedOrder(data[currentIndex + 1]);
          } else if (direction === 'prev' && currentIndex > 0) {
            setSelectedOrder(data[currentIndex - 1]);
          }
        }}
        isFirst={data.findIndex(o => o.id === selectedOrder?.id) === 0}
        isLast={data.findIndex(o => o.id === selectedOrder?.id) === data.length - 1}
      />

      <style jsx global>{`
        .master-table .ant-table-thead > tr > th { background-color: #f8fafc !important; font-weight: 900 !important; }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1.05); } 50% { opacity: .7; transform: scale(1); } }
        .animate-pulse { animation: pulse 1.5s infinite; }
      `}</style>
    </div>
  );
}
