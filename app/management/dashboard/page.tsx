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
  ContainerOutlined,
  InfoCircleOutlined,
  AreaChartOutlined as LineChartOutlined
} from '@ant-design/icons';
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Cell 
} from 'recharts';
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
    completionRate: 0,
    deptLoad: [] as any[],
    trendData: [] as any[]
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
          customers (name),
          tasks (id, status, department_id, start_time, end_time, ready_at, updated_at, issue_log, material_shortage, hold_start_time, total_hold_seconds)
        `)
        .order('created_at', { ascending: false });

      if (customerFilter) {
        query = query.eq('customer_id', customerFilter);
      }

      if (dateRange && dateRange[0] && dateRange[1]) {
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
      const completed = filteredOrders.filter(o => o.status === 'done' || o.status === 'completed').length || 0;
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
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        deptLoad: deptData?.map(d => ({
          name: d.name,
          running: filteredOrders.filter(o => o.tasks?.some((t: any) => t.department_id === d.id && t.status === 'in_progress')).length,
          ready: filteredOrders.filter(o => o.tasks?.some((t: any) => t.department_id === d.id && t.status === 'ready')).length,
          issue: filteredOrders.filter(o => o.tasks?.some((t: any) => t.department_id === d.id && (t.status === 'issue' || t.status === 'on_hold'))).length
        })) || [],
        trendData: Array.from({ length: 7 }).map((_, i) => {
          const d = dayjs().subtract(i, 'day').format('DD/MM');
          return {
            date: d,
            orders: filteredOrders.filter(o => dayjs(o.created_at).format('DD/MM') === d).length
          };
        }).reverse()
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

  const getStatusLabel = (status: string) => {
    const labels: any = {
      done: 'HOÀN TẤT',
      in_progress: 'ĐANG LÀM',
      ready: 'CHỜ NHẬN',
      issue: 'SỰ CỐ',
      on_hold: 'TẠM HOÃN',
      pending: 'CHỜ BƯỚC TRƯỚC'
    };
    return labels[status] || status.toUpperCase();
  };

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
    else if (task.status === 'on_hold') icon = <ClockCircleOutlined />;
    else if (task.status === 'ready') icon = <PlayCircleOutlined />;

    let totalHold = task.total_hold_seconds || 0;
    if ((task.status === 'on_hold' || task.status === 'issue') && task.hold_start_time) {
      totalHold += dayjs().diff(dayjs(task.hold_start_time), 'second');
    }
    const isHold = task.status === 'on_hold' || task.status === 'issue';

    let colorClass = 'bg-slate-100 text-slate-300';
    let shadow = 'none';
    let border = 'border-slate-100';

    if (task.status === 'done') {
      colorClass = 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white';
      icon = <CheckCircleOutlined />;
      border = 'border-emerald-400/20';
    } else if (task.status === 'in_progress') {
      colorClass = 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-100';
      icon = <SyncOutlined spin />;
      border = 'border-indigo-400/20';
    } else if (task.status === 'issue' || isDelayed) {
      colorClass = 'bg-gradient-to-br from-rose-500 to-rose-600 text-white';
      icon = <WarningOutlined className={isDelayed ? 'animate-bounce' : ''} />;
      border = 'border-rose-400/20';
    } else if (task.status === 'on_hold') {
      colorClass = 'bg-gradient-to-br from-amber-400 to-amber-500 text-white';
      icon = <ClockCircleOutlined />;
      border = 'border-amber-300/20';
    } else if (task.status === 'ready') {
      colorClass = 'bg-gradient-to-br from-cyan-400 to-cyan-500 text-white';
      icon = <PlayCircleOutlined />;
      border = 'border-cyan-300/20';
    }

    return (
      <Tooltip title={
        <div className="p-2 min-w-[150px]">
          <div className="font-black text-[10px] tracking-wider opacity-70 mb-1 flex justify-between items-center">
             <span>{getStatusLabel(task.status)}</span>
             {isHold && <span className="bg-rose-500 h-1.5 w-1.5 rounded-full animate-ping"></span>}
          </div>
          <div className="h-px bg-white/20 my-2"></div>
          {task.ready_at && <div className="text-xs mb-1">Sẵn sàng: <span className="font-black">{dayjs(task.ready_at).format('HH:mm DD/MM')}</span></div>}
          {isDelayed && <div className="text-rose-400 font-bold text-xs mt-1">TRỄ NHẬN: {delayHours}H</div>}
          {totalHold > 0 && (
            <div className="text-amber-300 font-bold text-xs mt-1 bg-amber-950/40 p-1.5 rounded-lg border border-amber-500/20">
               GIÁN ĐOẠN: {Math.round(totalHold / 60)} PHÚT
            </div>
          )}
          {task.material_shortage && <div className="text-amber-300 text-[10px] mt-2 italic flex items-center gap-1"><InfoCircleOutlined /> THIẾU VẬT TƯ (CHỜ KHO)</div>}
        </div>
      } color={isDelayed ? '#ef4444' : '#0f172a'} styles={{ container: { borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)' } }}>
        <div 
          className={`
            relative w-full h-11 flex items-center justify-center rounded-2xl cursor-pointer transition-all duration-300 border
            ${colorClass} ${border}
            ${task.status === 'in_progress' ? 'scale-105 z-10' : 'hover:scale-[1.03]'}
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
      title: <span className="premium-label !text-slate-400">LỆNH SẢN XUẤT</span>,
      dataIndex: 'code',
      key: 'code',
      width: 220,
      render: (text: string, record: any) => (
        <div className="flex flex-col gap-1">
          <Text className="text-sm font-black text-slate-900 tracking-tight">{text}</Text>
          <Text className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[180px]">{record.title}</Text>
        </div>
      )
    },
    {
      title: <span className="premium-label !text-slate-400">TIẾN ĐỘ QUY TRÌNH KỸ THUẬT</span>,
      key: 'gantt_premium',
      render: (_: any, record: any) => (
        <div className="flex items-center gap-1.5 p-2 bg-slate-50/50 rounded-2xl border border-slate-100 min-w-[500px]">
          {departments.map((dept) => {
            const task = record.tasks?.find((t: any) => t.department_id === dept.id);
            const isDone = task?.status === 'done';
            const isActive = task?.status === 'in_progress';
            const isIssue = task?.status === 'issue' || task?.status === 'on_hold';
            const isReady = task?.status === 'ready';
            
            let colorClass = 'bg-slate-200';
            let icon = null;
            let shadow = 'none';

            if (isDone) {
              colorClass = 'bg-gradient-to-r from-emerald-400 to-emerald-500';
              icon = <CheckCircleOutlined className="text-[10px]" />;
            } else if (isActive) {
              colorClass = 'bg-gradient-to-r from-indigo-500 to-indigo-600';
              icon = <SyncOutlined spin className="text-[10px]" />;
              shadow = '0 0 15px rgba(99,102,241,0.4)';
            } else if (isIssue) {
              colorClass = 'bg-gradient-to-r from-rose-500 to-rose-600';
              icon = <WarningOutlined className="text-[10px] animate-pulse" />;
            } else if (isReady) {
              colorClass = 'bg-gradient-to-r from-cyan-400 to-cyan-500';
              icon = <PlayCircleOutlined className="text-[10px]" />;
            }

            return (
              <Tooltip 
                key={dept.id} 
                title={
                  <div className="p-2 min-w-[120px]">
                    <div className="font-black text-[10px] text-white uppercase tracking-widest mb-1">{dept.name}</div>
                    <div className="h-px bg-white/10 my-1"></div>
                    <div className="text-[10px] opacity-80">{task ? getStatusLabel(task.status) : 'Chưa đến lượt'}</div>
                    {isActive && <div className="text-indigo-300 font-bold mt-1 animate-pulse">ĐANG THỰC HIỆN...</div>}
                  </div>
                }
                color={isActive ? '#4f46e5' : isIssue ? '#e11d48' : '#0f172a'}
              >
                <div 
                  className={`
                    h-12 flex-1 rounded-xl flex flex-col items-center justify-center transition-all duration-500 relative overflow-hidden group
                    ${isActive ? 'flex-[2.5] scale-y-110' : 'hover:scale-[1.02]'}
                  `}
                  style={{ 
                    boxShadow: shadow,
                  }}
                >
                  <div className={`absolute inset-0 ${colorClass} opacity-90`}></div>
                  
                  {/* Glass highlight */}
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10 -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>

                  <div className="relative z-10 flex flex-col items-center gap-0.5">
                    <span className="text-[9px] font-black text-white tracking-tighter opacity-70 leading-none">{dept.code}</span>
                    <span className="text-white drop-shadow-sm">{icon}</span>
                  </div>

                  {isActive && (
                    <div className="absolute bottom-0 left-0 h-1 bg-white/30 animate-shimmer" style={{ width: '100%' }}></div>
                  )}
                </div>
              </Tooltip>
            );
          })}
        </div>
      )
    }
  ];

  const columns = [
    {
      title: <span className="premium-label !text-indigo-600 !text-[11px]">LỆNH SẢN XUẤT</span>,
      dataIndex: 'code',
      key: 'code',
      fixed: 'left' as const,
      width: 200,
      render: (text: string, record: any) => (
        <div
          className="flex flex-col cursor-pointer group py-2"
          onClick={() => { setSelectedOrder(record); setQuickViewModalVisible(true); }}
        >
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shadow-[0_0_12px_rgba(99,102,241,0.8)] animate-pulse" />
            <Text className="text-[15px] font-black text-slate-900 font-mono tracking-tighter group-hover:text-indigo-600 transition-colors">
              {text}
            </Text>
          </div>
          <div className="mt-1 pl-5">
            <Text className="text-[11px] font-bold text-slate-400 uppercase block">{record.title}</Text>
            <div className="flex items-center gap-1.5 mt-1">
               <Text className="text-[9px] font-black text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-md">
                 {record.customers?.name?.toUpperCase() || 'VÃNG LAI'}
               </Text>
            </div>
          </div>
        </div>
      ),
    },
    ...departments.map(dept => ({
      title: <div className="flex flex-col items-center">
               <span className="premium-label !text-slate-400 leading-none mb-1">{dept.code}</span>
               <span className="text-[9px] font-black text-slate-900 border-t border-slate-100 pt-1 w-full text-center">{dept.name.toUpperCase()}</span>
             </div>,
      key: `dept_${dept.id}`,
      align: 'center' as const,
      width: 130,
      render: (_: any, record: any) => (
        <div className="px-1 py-2">
          {getTaskCell(record.tasks, dept.id)}
        </div>
      ),
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
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      <div className="max-w-[1700px] mx-auto p-6 md:p-8 space-y-8 animate-in">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100 relative group overflow-hidden">
                <DashboardOutlined className="text-2xl relative z-10" />
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-0">Hệ Thống <span className="text-indigo-600">Điều Phối</span></h1>
                <div className="flex items-center gap-2">
                  <div className="h-1 w-6 bg-indigo-600 rounded-full" />
                  <Text className="premium-label text-slate-400">Giám sát sản xuất & Tối ưu KPI Phân hệ</Text>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-[24px] shadow-sm border border-slate-100">
             <Segmented
               value={viewMode}
               onChange={setViewMode}
               options={[
                 { label: 'BẢNG TỔNG', value: 'Kanban', icon: <TableOutlined /> },
                 { label: 'QUY TRÌNH', value: 'Gantt', icon: <GanttOutlined /> },
               ]}
               className="premium-segmented"
             />
             <div className="h-8 w-px bg-slate-100 mx-2"></div>
             <div className="px-4 border-r border-slate-100">
                <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">CẬP NHẬT</div>
                <div className="text-xs font-black text-indigo-600">{dayjs().format('HH:mm:ss')}</div>
             </div>
             <Button 
                type="primary" 
                icon={<SyncOutlined spin={loading} />} 
                onClick={fetchData}
                loading={loading}
                className="h-12 px-8 rounded-xl bg-indigo-600 border-none shadow-lg shadow-indigo-100 font-bold"
             >
                LÀM MỚI
             </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12} lg={6}>
            <div className="glass-card p-6 relative overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
               <div className="absolute -right-4 -top-4 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <ContainerOutlined className="text-8xl text-indigo-600 -rotate-12" />
               </div>
               <Text className="premium-label mb-2">TỔNG LỆNH ĐANG CHẠY</Text>
               <div className="flex items-end gap-3">
                  <div className="text-5xl font-black text-slate-900 leading-none tracking-tighter">{stats.total}</div>
                  <Tag color="blue" className="mb-1 border-none font-black rounded-lg px-2 text-[10px] uppercase shadow-sm">Active</Tag>
               </div>
               <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-medium">Khởi tạo trong ngày: <span className="text-slate-900 font-bold">5 đơn</span></span>
                  <ThunderboltOutlined className="text-indigo-400" />
               </div>
            </div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="glass-card p-6 relative overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
               <div className="absolute -right-4 -top-4 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <CheckCircleOutlined className="text-8xl text-emerald-600 -rotate-12" />
               </div>
               <Text className="premium-label mb-2">TỶ LỆ HOÀN THÀNH</Text>
               <div className="flex items-end gap-3">
                  <div className="text-5xl font-black text-emerald-600 leading-none tracking-tighter">{stats.completionRate}%</div>
                  <Tag color="emerald" className="mb-1 border-none font-black rounded-lg px-2 text-[10px] uppercase shadow-sm">Target: 95%</Tag>
               </div>
               <div className="mt-5">
                  <div className="h-2 w-full bg-emerald-50 rounded-full overflow-hidden">
                     <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${stats.completionRate}%` }}></div>
                  </div>
               </div>
            </div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="glass-card p-6 relative overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
               <div className="absolute -right-4 -top-4 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <ClockCircleOutlined className="text-8xl text-rose-600 -rotate-12" />
               </div>
               <Text className="premium-label mb-2">ĐỘ TRỄ NHẬN VIỆC</Text>
               <div className="flex items-end gap-3">
                  <div className="text-5xl font-black text-rose-600 leading-none tracking-tighter">{stats.avgDelay}H</div>
                  <Tag color="rose" className="mb-1 border-none font-black rounded-lg px-2 text-[10px] uppercase shadow-sm animate-pulse">Critical</Tag>
               </div>
               <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-400 font-medium italic">
                  Cao điểm kẹt tại Bộ phận: <span className="text-rose-600 font-bold uppercase">In Offset</span>
               </div>
            </div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="ui-surface p-6 bg-slate-900 border-none relative overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
               <div className="absolute -right-4 -top-4 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <WarningOutlined className="text-8xl text-rose-500 -rotate-12" />
               </div>
               <Text className="premium-label text-slate-500 mb-2">SỰ CỐ KHẨN CẤP</Text>
               <div className="flex items-end gap-4">
                  <div className="text-5xl font-black text-white leading-none tracking-tighter">{stats.issues}</div>
                  <div className="mb-1 p-2 bg-rose-500/20 text-rose-500 rounded-xl animate-bounce">
                    <WarningOutlined className="text-xl" />
                  </div>
               </div>
               <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Cần điều phối ngay</span>
                  <div className="flex -space-x-2">
                     <div className="w-5 h-5 rounded-full border-2 border-slate-900 bg-rose-400"></div>
                     <div className="w-5 h-5 rounded-full border-2 border-slate-900 bg-rose-500 animate-pulse"></div>
                  </div>
               </div>
            </div>
          </Col>
        </Row>

        {/* Filters Section */}
        <div className="glass-card p-6 rounded-[32px] flex flex-wrap items-center justify-between gap-8 border-none ring-1 ring-slate-200/50">
          <div className="flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-3">
               <div className="bg-indigo-50 p-2.5 rounded-xl"><FilterOutlined className="text-indigo-600" /></div>
               <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Bộ lọc</span>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <Select 
                allowClear 
                showSearch
                placeholder="Khách hàng" 
                className="premium-select min-w-[280px]"
                onChange={setCustomerFilter}
              >
                {customers.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
              </Select>
              
              <Select 
                allowClear 
                placeholder="Điểm kẹt" 
                className="premium-select min-w-[200px]"
                onChange={setDeptFilter}
              >
                {departments.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}
              </Select>

              <RangePicker className="premium-datepicker min-w-[280px]" onChange={(dates) => setDateRange(dates as any)} />
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="text-right mr-2">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-1">DỮ LIỆU ĐANG VÀO</div>
                <div className="text-sm font-black text-slate-700 leading-none">{data.length} LỆNH</div>
             </div>
             <Button type="text" className="h-12 w-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                <BarChartOutlined />
             </Button>
          </div>
        </div>

        {/* Master Table Container */}
        <div className="premium-shadow rounded-[36px] overflow-hidden bg-white border border-slate-100 ring-1 ring-slate-200/50">
          <Table
            columns={viewMode === 'Kanban' ? columns.map(col => ({
              ...col,
              render: (...args: any[]) => (
                <div className="animate-slide">
                  {col.render ? (col.render as any)(...args) : args[0]}
                </div>
              )
            })) : ganttColumns}
            dataSource={data}
            rowKey="id"
            pagination={{ 
              pageSize: 10, 
              placement: 'bottomCenter',
              className: "premium-pagination p-6",
              showTotal: (total: number) => <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Hệ thống đang điều hành {total} lệnh sản xuất</span>
            } as any}
            scroll={{ x: 'max-content', y: 700 }}
            className="designer-table master-table"
            loading={loading}
            onRow={(record) => ({
              onClick: () => { setSelectedOrder(record); setQuickViewModalVisible(true); },
              className: 'group transition-all duration-300'
            })}
          />
        </div>

        {/* Analysis Section (KPI Visuals) */}
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={14}>
            <div className="glass-card p-6 min-h-[420px] flex flex-col hover:border-indigo-100 transition-all">
              <div className="flex justify-between items-center mb-8">
                 <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                    <div>
                      <Text className="premium-label !text-slate-800 leading-none">TẢI TRỌNG CÁC BỘ PHẬN</Text>
                      <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Phân bổ trạng thái khâu</Text>
                    </div>
                 </div>
                 <div className="flex gap-4 p-2 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 px-2"><div className="w-2 h-2 rounded-full bg-indigo-500"></div><span className="text-[9px] font-black text-slate-500">ĐANG LÀM</span></div>
                    <div className="flex items-center gap-2 px-2"><div className="w-2 h-2 rounded-full bg-rose-500"></div><span className="text-[9px] font-black text-slate-500">SỰ CỐ</span></div>
                 </div>
              </div>
              <div className="flex-1 w-full">
                 <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.deptLoad} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                         dataKey="name" 
                         axisLine={false} 
                         tickLine={false} 
                         tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} 
                         interval={0}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <RechartsTooltip 
                         contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', padding: '12px' }}
                         cursor={{ fill: '#f8fafc' }}
                      />
                      <Bar dataKey="ready" stackId="a" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={36} />
                      <Bar dataKey="running" stackId="a" fill="#6366f1" barSize={36} />
                      <Bar dataKey="issue" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={36} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
            </div>
          </Col>
          <Col xs={24} lg={10}>
            <div className="glass-card p-6 min-h-[420px] flex flex-col bg-slate-900 border-none shadow-indigo-200/20">
              <div className="flex justify-between items-center mb-8">
                 <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)]"></div>
                    <div>
                      <Text className="premium-label !text-white leading-none">XU HƯỚNG SẢN XUẤT</Text>
                      <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Đơn hàng mới trong 7 ngày</Text>
                    </div>
                 </div>
                 <div className="p-2 bg-white/5 rounded-xl"><LineChartOutlined className="text-emerald-500 text-lg" /></div>
              </div>
              <div className="flex-1 w-full">
                 <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={stats.trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorOrdersActive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                      <XAxis 
                         dataKey="date" 
                         axisLine={false} 
                         tickLine={false} 
                         tick={{ fill: '#475569', fontSize: 10, fontWeight: 800 }} 
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10 }} />
                      <RechartsTooltip 
                         contentStyle={{ background: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                      />
                      <Area 
                         type="monotone" 
                         dataKey="orders" 
                         stroke="#10b981" 
                         strokeWidth={4}
                         fillOpacity={1} 
                         fill="url(#colorOrdersActive)" 
                         animationDuration={2000}
                      />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
              <div className="mt-4 flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Tổng quan hiệu suất vận hành</div>
                 <div className="text-emerald-400 font-black flex items-center gap-2 text-sm leading-none">
                    TĂNG TRƯỞNG 12% <ThunderboltOutlined className="text-emerald-500 animate-pulse" />
                 </div>
              </div>
            </div>
          </Col>
        </Row>

        {/* Legend / Status Glossary */}
        <div className="glass-card p-6 rounded-[32px] flex flex-wrap gap-12 justify-center border-none shadow-sm">
           {[
             { label: 'SẴN SÀNG', color: '#06b6d4', icon: <PlayCircleOutlined /> },
             { label: 'ĐANG LÀM', color: '#6366f1', icon: <SyncOutlined spin /> },
             { label: 'TRỄ NHẬN', color: '#f43f5e', icon: <WarningOutlined className="animate-pulse" /> },
             { label: 'TẠM HOÃN', color: '#f59e0b', icon: <ClockCircleOutlined /> },
             { label: 'HOÀN TẤT', color: '#10b981', icon: <CheckCircleOutlined /> }
           ].map((item, i) => (
             <div key={i} className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110"
                  style={{ backgroundColor: item.color, boxShadow: `0 8px 16px ${item.color}30` }}
                >
                  {item.icon}
                </div>
                <div className="flex flex-col">
                   <Text className="text-[10px] font-black text-slate-400 tracking-widest uppercase">{item.label}</Text>
                   <Text className="text-[8px] font-bold text-slate-300 -mt-1 uppercase">Hệ thống</Text>
                </div>
             </div>
           ))}
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
        .master-table .ant-table-thead > tr > th { 
          background: #f8fafc !important; 
          border-bottom: 1px solid #f1f5f9 !important;
          padding: 24px 20px !important;
        }
        .master-table .ant-table-tbody > tr > td { 
          border-bottom: 1px solid #f8fafc !important;
          padding: 20px !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .master-table .ant-table-row:hover > td {
          background: #f8fafc !important;
        }
        .animate-slide { animation: fadeInSlide 0.4s ease-out forwards; }
        @keyframes fadeInSlide {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .premium-pagination .ant-pagination-item { border-radius: 12px; border: none; font-weight: 700; background: #f1f5f9; }
        .premium-pagination .ant-pagination-item-active { background: #6366f1 !important; }
        .premium-pagination .ant-pagination-item-active a { color: white !important; }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .animate-shimmer { animation: shimmer 2s infinite linear; }
      `}</style>
    </div>
  );
}
