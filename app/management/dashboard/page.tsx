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
  RightOutlined,
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
  const [viewMode, setViewMode] = useState<string | number>('Pipeline');

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

  const fetchTaskDetails = async (order: any, setTasks: (tasks: any[]) => void) => {
    if (!order?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id, 
          status, 
          department_id,
          sequence_order,
          start_time, 
          end_time, 
          ready_at, 
          updated_at,
          created_at,
          issue_log, 
          material_shortage,
          estimated_duration_seconds,
          departments:department_id (name, code),
          users:assigned_to (full_name)
        `)
        .eq('order_id', order.id)
        .order('sequence_order', { ascending: true });
      
      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('Error fetching task details:', err);
      // Fallback to order.tasks if available
      if (order.tasks) {
        setTasks(order.tasks);
      }
    } finally {
      setLoading(false);
    }
  };

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
          tasks (id, status, department_id, start_time, end_time, ready_at, updated_at, created_at, issue_log, material_shortage, hold_start_time, total_hold_seconds)
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
        filteredOrders = filteredOrders.filter(o => o.tasks?.some((t: any) => t.department_id === deptFilter));
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
          const readyTime = t.ready_at || t.created_at;
          if (t.status === 'ready' && readyTime) {
            const delay = dayjs().diff(dayjs(readyTime), 'hour');
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
    const readyTime = task.ready_at || task.created_at;

    if (task.status === 'ready' && readyTime) {
      delayHours = dayjs().diff(dayjs(readyTime), 'hour');
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
          {readyTime && <div className="text-xs mb-1">Sẵn sàng: <span className="font-black">{dayjs(readyTime).format('HH:mm DD/MM')}</span></div>}
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
              shadow = '0 0 15px rgba(0,71,171,0.42)';
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
                color={isActive ? '#003a8c' : isIssue ? '#d62828' : '#0f172a'}
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
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shadow-[0_0_12px_rgba(0,71,171,0.8)] animate-pulse" />
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
    <div className="min-h-screen bg-[#faf8fe] text-[#30323a]">
      <div className="mx-auto max-w-[1500px] p-6 md:p-8 space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Editorial Print OS</h1>
            <p className="text-xs text-slate-500 mt-1">Dashboard điều hành sản xuất thời gian thực</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-[10px] uppercase tracking-widest text-slate-400">Cập nhật</div>
              <div className="text-sm font-bold text-indigo-600">{dayjs().format('HH:mm:ss')}</div>
            </div>
            <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={fetchData} className="h-11 px-5 rounded-xl bg-indigo-600 border-none">
              Làm mới
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          <div className="bg-white p-5 rounded-xl border border-slate-100">
            <p className="text-xs uppercase tracking-wider text-slate-500">Active Orders</p>
            <h3 className="text-3xl font-black mt-1">{stats.running || stats.total}</h3>
            <p className="text-[11px] text-emerald-600 font-bold mt-2">+12%</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-100">
            <p className="text-xs uppercase tracking-wider text-slate-500">Efficiency Rate</p>
            <h3 className="text-3xl font-black mt-1">{Math.max(60, stats.completionRate)}%</h3>
            <p className="text-[11px] text-amber-600 font-bold mt-2">-2%</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-100">
            <p className="text-xs uppercase tracking-wider text-slate-500">Avg Lead Time</p>
            <h3 className="text-3xl font-black mt-1">{Math.max(1, stats.avgDelay || 4.2)}h</h3>
            <p className="text-[11px] text-emerald-600 font-bold mt-2">Optimized</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-100">
            <p className="text-xs uppercase tracking-wider text-slate-500">Urgent Alerts</p>
            <h3 className="text-3xl font-black mt-1 text-rose-600">{stats.issues}</h3>
            <p className="text-[11px] text-rose-600 font-bold mt-2">Action Needed</p>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-xl font-extrabold">Live Production Flow</h2>
              <p className="text-sm text-slate-500">Real-time status of assembly nodes across Facility 04.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="flex items-center min-w-[900px]">
              {['In-Feed', 'Press S1', 'Lamination', 'Cutting', 'Logistics'].map((node, idx) => {
                const isWarn = idx === 2;
                return (
                  <React.Fragment key={node}>
                    <div className="flex flex-col items-center">
                      <div className={`w-16 h-16 rounded-full border-4 ${isWarn ? 'border-amber-500' : 'border-emerald-500'} flex items-center justify-center font-black ${isWarn ? 'text-amber-600' : 'text-emerald-600'}`}>
                        FL{idx + 1}
                      </div>
                      <p className="text-[11px] font-bold mt-3">{node}</p>
                    </div>
                    {idx < 4 && <div className={`flex-1 h-[2px] mx-3 ${isWarn ? 'bg-gradient-to-r from-amber-500 to-emerald-500' : 'bg-emerald-500'}`} />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-6">
            <h2 className="text-lg font-extrabold mb-6">Department Load</h2>
            <div className="space-y-5">
              {(stats.deptLoad || []).slice(0, 4).map((item: any) => {
                const value = Math.min(100, (item.running || 0) * 12 + (item.ready || 0) * 6 + (item.issue || 0) * 10);
                return (
                  <div key={item.name}>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span>{item.name}</span>
                      <span className="text-slate-500">{value}% Capacity</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${value >= 85 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${value}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white rounded-xl border border-slate-100 p-6">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-lg font-extrabold">Production Output</h2>
                <p className="text-xs text-slate-500">Performance against target (Last 7 Days)</p>
              </div>
            </div>
            <div className="h-64">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 200">
                <defs>
                  <linearGradient id="areaGradientDashboard" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#4c5e8b" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#4c5e8b" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,180 L140,160 L280,140 L420,150 L560,110 L700,90 L840,105" fill="none" stroke="#4c5e8b" strokeLinecap="round" strokeWidth="3" />
                <path d="M840,105 L1000,80" fill="none" stroke="#4c5e8b" strokeDasharray="6,4" strokeLinecap="round" strokeWidth="3" />
                <path d="M0,180 L140,160 L280,140 L420,150 L560,110 L700,90 L840,105 L840,200 L0,200 Z" fill="url(#areaGradientDashboard)" />
              </svg>
              <div className="flex justify-between mt-4 text-[10px] font-bold text-slate-400 uppercase">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span><span className="text-indigo-600">Next 24h</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
