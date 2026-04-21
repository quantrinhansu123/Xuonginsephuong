'use client';

import React, { useState, useEffect } from 'react';
import { 
  Table, Input, Button, Space, Tag, Card, Typography, 
  Row, Col, Select, message, Tooltip, Progress, DatePicker, Popconfirm, Modal, InputNumber
} from 'antd';
import { 
  SearchOutlined, 
  PlusOutlined, 
  ReloadOutlined,
  EyeOutlined,
  FilterOutlined,
  DeleteOutlined,
  NodeIndexOutlined,
  PlusCircleOutlined,
  DoubleRightOutlined,
  EditOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import CreateOrderModal from '@/components/orders/CreateOrderModal';
import OrderDetailModal from '@/components/orders/OrderDetailModal';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function OrdersPage() {
  type StepMaterialDraft = {
    materialId: number | null;
    name: string;
    unit: string;
    quantity: number | null;
  };
  type StepDraft = {
    deptId: number;
    note: string;
    materialStatus: 'waiting_material' | 'material_ready';
    materials: StepMaterialDraft[];
  };

  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [kanbanTasks, setKanbanTasks] = useState<any[]>([]);
  const [kanbanLoading, setKanbanLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailStartInEditMode, setDetailStartInEditMode] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<any[]>([]);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignOrder, setAssignOrder] = useState<any>(null);
  const [selectedSteps, setSelectedSteps] = useState<StepDraft[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('production_orders')
        .select(`
          *,
          customers (name, phone),
          tasks (
            id,
            status,
            sequence_order,
            department_id,
            ready_at,
            start_time,
            end_time,
            processing_info,
            departments:department_id (name)
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data: orders, error } = await query;
      if (error) throw error;
      
      let filtered = orders || [];
      
      // Search filter
      if (search) {
        filtered = filtered.filter(o => 
          o.code.toLowerCase().includes(search.toLowerCase()) ||
          o.title.toLowerCase().includes(search.toLowerCase()) ||
          o.customers?.name?.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Date range filter
      if (dateRange) {
        filtered = filtered.filter(o => {
          const created = dayjs(o.created_at);
          return created.isAfter(dateRange[0].startOf('day')) && created.isBefore(dateRange[1].endOf('day'));
        });
      }

      const getDaysRemaining = (deadline?: string) => {
        if (!deadline) return null;
        return dayjs(deadline).endOf('day').diff(dayjs(), 'day');
      };

      const isUrgentOrder = (order: any) => {
        const normalized = (order?.status || '').toString().trim().toLowerCase();
        const statusUrgent = normalized === 'gấp' || normalized === 'gap' || normalized === 'urgent';
        const daysRemaining = getDaysRemaining(order?.deadline);
        const nearDeadline = daysRemaining !== null && daysRemaining <= 2;
        return statusUrgent || nearDeadline;
      };

      filtered = [...filtered].sort((a, b) => {
        const aUrgent = isUrgentOrder(a) ? 1 : 0;
        const bUrgent = isUrgentOrder(b) ? 1 : 0;
        if (aUrgent !== bUrgent) return bUrgent - aUrgent;
        return dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf();
      });

      setData(orders || []);
      setFilteredData(filtered);
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi tải danh sách đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  const fetchKanbanTasks = async () => {
    setKanbanLoading(true);
    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          id,
          status,
          sequence_order,
          department_id,
          ready_at,
          start_time,
          end_time,
          updated_at,
          departments:department_id (name, code),
          production_orders:order_id (
            id,
            code,
            title,
            status,
            deadline,
            customers (name, phone)
          )
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setKanbanTasks(tasks || []);
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi tải dữ liệu kanban');
    } finally {
      setKanbanLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, dateRange]);

  useEffect(() => {
    if (viewMode === 'kanban') {
      fetchKanbanTasks();
    }
  }, [viewMode]);

  useEffect(() => {
    fetchDepartments();
    fetchMaterials();
    fetchWorkflowTemplates();
  }, []);

  const fetchDepartments = async () => {
    try {
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .order('id', { ascending: true });
      if (deptError) throw deptError;
      setDepartments(deptData || []);
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi tải danh sách bộ phận');
    }
  };

  const fetchWorkflowTemplates = async () => {
    try {
      const { data: templates, error } = await supabase
        .from('workflow_templates')
        .select('id, name, department_sequence, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      setWorkflowTemplates(templates || []);
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi tải quy trình mẫu');
    }
  };

  const fetchMaterials = async () => {
    try {
      const { data: materialData, error } = await supabase
        .from('materials')
        .select('id, name, unit, stock_quantity')
        .order('name', { ascending: true });
      if (error) throw error;
      setMaterials(materialData || []);
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi tải danh sách vật tư');
    }
  };

  const getDeptName = (deptId: number) => {
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || `BP #${deptId}`;
  };

  const getEmptyMaterial = (): StepMaterialDraft => ({
    materialId: null,
    name: '',
    unit: '',
    quantity: null,
  });

  const handleOpenAssignModal = (order: any) => {
    setAssignOrder(order);
    const existingTasks = Array.isArray(order?.tasks)
      ? [...order.tasks].sort((a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0))
      : [];
    const existingSteps = existingTasks.length > 0
      ? existingTasks.map((task: any) => ({
          deptId: task.department_id,
          note: task?.processing_info?.assignment_note || '',
          materialStatus: task?.processing_info?.material_status === 'material_ready' ? 'material_ready' : 'waiting_material',
          materials: Array.isArray(task?.processing_info?.material_allocations) && task.processing_info.material_allocations.length > 0
            ? task.processing_info.material_allocations.map((item: any) => ({
                materialId: item?.material_id ?? null,
                name: item?.name || '',
                unit: item?.unit || '',
                quantity: item?.quantity ?? null,
              }))
            : [getEmptyMaterial()],
        }))
      : Array.isArray(order?.workflow_steps)
        ? order.workflow_steps.map((deptId: number) => ({ deptId, note: '', materialStatus: 'waiting_material', materials: [getEmptyMaterial()] } as StepDraft))
        : [];
    setSelectedSteps(existingSteps);
    setAssignModalVisible(true);
  };

  const handleAddStep = (deptId: number) => {
    if (selectedSteps.some(s => s.deptId === deptId)) {
      message.warning('Bộ phận này đã có trong quy trình');
      return;
    }
    setSelectedSteps(prev => [...prev, { deptId, note: '', materialStatus: 'waiting_material', materials: [getEmptyMaterial()] }]);
  };

  const handleApplyTemplate = (departmentSequence: number[]) => {
    if (!Array.isArray(departmentSequence) || departmentSequence.length === 0) {
      message.warning('Quy trình mẫu chưa có bước hợp lệ');
      return;
    }
    setSelectedSteps(departmentSequence.map((deptId: number) => ({ deptId, note: '', materialStatus: 'waiting_material', materials: [getEmptyMaterial()] })));
  };

  const handleRemoveStep = (index: number) => {
    setSelectedSteps(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateNote = (index: number, note: string) => {
    setSelectedSteps(prev => prev.map((step, i) => (
      i === index ? { ...step, note } : step
    )));
  };

  const handleUpdateMaterialStatus = (index: number, materialStatus: 'waiting_material' | 'material_ready') => {
    setSelectedSteps(prev => prev.map((step, i) => (
      i === index ? { ...step, materialStatus } : step
    )));
  };

  const handleAddStepMaterial = (index: number) => {
    setSelectedSteps(prev => prev.map((step, i) => (
      i === index ? { ...step, materials: [...(step.materials || []), getEmptyMaterial()] } : step
    )));
  };

  const handleRemoveStepMaterial = (stepIndex: number, materialIndex: number) => {
    setSelectedSteps(prev => prev.map((step, i) => {
      if (i !== stepIndex) return step;
      const nextMaterials = (step.materials || []).filter((_, idx) => idx !== materialIndex);
      return { ...step, materials: nextMaterials.length > 0 ? nextMaterials : [getEmptyMaterial()] };
    }));
  };

  const handleUpdateStepMaterial = (stepIndex: number, materialIndex: number, patch: Partial<StepMaterialDraft>) => {
    setSelectedSteps(prev => prev.map((step, i) => (
      i === stepIndex
        ? {
            ...step,
            materials: (step.materials || []).map((material, idx) => (
              idx === materialIndex ? { ...material, ...patch } : material
            )),
          }
        : step
    )));
  };

  const handleAssignWorkflow = async () => {
    if (!assignOrder?.id) return;
    if (selectedSteps.length === 0) {
      message.warning('Vui lòng chọn ít nhất một bước làm việc');
      return;
    }

    setAssigning(true);
    try {
      const tasksToCreate = selectedSteps.map((step, index) => ({
        order_id: assignOrder.id,
        department_id: step.deptId,
        sequence_order: index + 1,
        status: index === 0 ? 'ready' : 'pending',
        ready_at: index === 0 ? new Date().toISOString() : null,
        estimated_duration_seconds: 3600,
        processing_info: {
          assignment_note: step.note?.trim() || null,
          material_status: step.materialStatus,
          material_allocations: (step.materials || [])
            .filter((item) => item.name?.trim() && item.quantity)
            .map((item) => ({
              material_id: item.materialId,
              name: item.name.trim(),
              unit: item.unit || '',
              quantity: Number(item.quantity),
            })),
        },
      }));

      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('order_id', assignOrder.id);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase.from('tasks').insert(tasksToCreate);
      if (insertError) throw insertError;

      const { error: updateOrderError } = await supabase
        .from('production_orders')
        .update({
          workflow_steps: selectedSteps.map(s => s.deptId),
          status: 'in_progress'
        })
        .eq('id', assignOrder.id);
      if (updateOrderError) throw updateOrderError;

      message.success(`Đã phân công công việc cho ${assignOrder.code}`);
      setAssignModalVisible(false);
      setAssignOrder(null);
      setSelectedSteps([]);
      fetchOrders();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi phân công công việc');
    } finally {
      setAssigning(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('production_orders')
        .delete()
        .eq('id', id);
      if (error) throw error;
      message.success('Đã xóa đơn hàng');
      fetchOrders();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi xóa đơn hàng');
    }
  };

  const getProgressMeta = (status: string) => {
    const map: Record<string, { label: string; colorClass: string }> = {
      ready: { label: 'Đã giao', colorClass: 'bg-orange-500 text-white' },
      in_progress: { label: 'Đã nhận', colorClass: 'bg-blue-500 text-white' },
      done: { label: 'Đã xong', colorClass: 'bg-emerald-500 text-white' },
      completed: { label: 'Đã xong', colorClass: 'bg-emerald-500 text-white' },
      issue: { label: 'Sự cố', colorClass: 'bg-rose-500 text-white' },
      on_hold: { label: 'Tạm hoãn', colorClass: 'bg-slate-400 text-white' },
      pending: { label: 'Chờ', colorClass: 'bg-slate-300 text-slate-700' },
    };
    return map[status] || { label: 'Chờ', colorClass: 'bg-slate-300 text-slate-700' };
  };

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const kanbanColumns = [
    { key: 'pending', label: 'Chưa xác nhận', color: 'default' },
    { key: 'ready', label: 'Sẵn sàng', color: 'cyan' },
    { key: 'in_progress', label: 'Đang làm', color: 'blue' },
    { key: 'issue', label: 'Sự cố', color: 'red' },
    { key: 'on_hold', label: 'Tạm hoãn', color: 'orange' },
    { key: 'done', label: 'Hoàn thành', color: 'green' },
  ];

  const filteredKanbanTasks = kanbanTasks.filter((task: any) => {
    const order = task.production_orders;
    if (!order) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      order.code?.toLowerCase().includes(s) ||
      order.title?.toLowerCase().includes(s) ||
      order.customers?.name?.toLowerCase().includes(s)
    );
  });

  const normalizeKanbanStatus = (status: string) => {
    if (status === 'completed') return 'done';
    return status;
  };

  const representativeKanbanTasks = Object.values(
    filteredKanbanTasks.reduce((acc: Record<string, any[]>, task: any) => {
      const orderId = task?.production_orders?.id;
      if (!orderId) return acc;
      if (!acc[orderId]) acc[orderId] = [];
      acc[orderId].push(task);
      return acc;
    }, {})
  ).map((group: any) => {
    const tasks = [...group].sort((a, b) => {
      const aUpdated = dayjs(a.updated_at || a.created_at || 0).valueOf();
      const bUpdated = dayjs(b.updated_at || b.created_at || 0).valueOf();
      if (aUpdated !== bUpdated) return bUpdated - aUpdated;
      return (b.sequence_order || 0) - (a.sequence_order || 0);
    });

    const byPriority =
      tasks.find((t) => t.status === 'issue' || t.status === 'on_hold') ||
      tasks.find((t) => t.status === 'in_progress') ||
      tasks.find((t) => t.status === 'ready') ||
      tasks.find((t) => t.status === 'pending') ||
      tasks.find((t) => t.status === 'done' || t.status === 'completed') ||
      tasks[0];

    return byPriority;
  });

  const filteredWorkflowTemplates = workflowTemplates.filter((wf: any) => {
    if (!templateSearch.trim()) return true;
    return (wf?.name || '').toLowerCase().includes(templateSearch.trim().toLowerCase());
  });

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredData.length, currentPage]);

  const paginatedOrders = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportCsv = () => {
    const rows = filteredData.map((o) => ({
      ma_don: o.code,
      khach_hang: o.customers?.name || '',
      noi_dung: o.title || '',
      so_luong: o.specs?.quantity || '',
      don_vi: o.specs?.unit || '',
      deadline: o.deadline ? dayjs(o.deadline).format('DD/MM/YYYY') : '',
      trang_thai: o.status || '',
    }));
    const header = Object.keys(rows[0] || { ma_don: '', khach_hang: '', noi_dung: '', so_luong: '', don_vi: '', deadline: '', trang_thai: '' });
    const csvLines = [
      header.join(','),
      ...rows.map((row) => header.map((h) => `"${String((row as any)[h] ?? '').replace(/"/g, '""')}"`).join(',')),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders_${dayjs().format('YYYYMMDD_HHmm')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    message.success('Đã xuất CSV');
  };

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto animate-in px-4 sm:px-0 pb-10">
      <div className="flex items-end justify-between">
        <div>
          <Title level={2} className="m-0 font-black tracking-tight text-slate-900">Master Orders</Title>
          <Text className="text-slate-500">Real-time status of all active production runs</Text>
        </div>
        <div className="bg-slate-200 p-1 rounded-lg flex gap-1">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${viewMode === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-white/60'}`}
          >
            DANH SÁCH
          </button>
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${viewMode === 'kanban' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-white/60'}`}
          >
            KANBAN
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200/60">
          <div className="text-sm font-semibold text-slate-500">Total Orders</div>
          <div className="text-3xl font-extrabold text-slate-900">{filteredData.length}</div>
          <div className="mt-2 text-xs font-bold text-emerald-600">+12% vs last month</div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200/60">
          <div className="text-sm font-semibold text-slate-500">In Progress</div>
          <div className="text-3xl font-extrabold text-slate-900">{filteredData.filter((o) => o.status === 'in_progress').length}</div>
          <div className="mt-2 text-xs font-bold text-slate-500">Active pipeline load</div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200/60">
          <div className="text-sm font-semibold text-slate-500">Completed Today</div>
          <div className="text-3xl font-extrabold text-slate-900">
            {filteredData.filter((o) => ['done', 'completed'].includes(o.status) && dayjs(o.updated_at || o.created_at).isSame(dayjs(), 'day')).length}
          </div>
          <div className="mt-2 text-xs font-bold text-indigo-600">Peak throughput reached</div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200/60">
          <div className="text-sm font-semibold text-slate-500">Overdue</div>
          <div className="text-3xl font-extrabold text-rose-600">
            {filteredData.filter((o) => o.deadline && dayjs(o.deadline).endOf('day').isBefore(dayjs()) && !['done', 'completed'].includes(o.status)).length}
          </div>
          <div className="mt-2 text-xs font-bold text-rose-600">Requires immediate action</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-slate-100 p-4 rounded-xl border border-slate-200/60">
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-[260px]">
          <SearchOutlined className="text-slate-400" />
          <input
            className="bg-transparent border-none outline-none text-sm w-full"
            placeholder="Filter by ID, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fetchOrders();
            }}
          />
        </div>
        <Select value={statusFilter} onChange={setStatusFilter} className="min-w-[180px]" options={[
          { value: 'all', label: 'Status: All' },
          { value: 'pending', label: 'In Prep' },
          { value: 'in_progress', label: 'Processing' },
          { value: 'completed', label: 'Finished' },
        ]} />
        <RangePicker className="min-w-[260px]" placeholder={['Date from', 'Date to']} onChange={(dates) => setDateRange(dates as any)} />
        <div className="ml-auto flex items-center gap-2">
          <Button icon={<ReloadOutlined />} onClick={fetchOrders} />
          <Button onClick={exportCsv}>Export CSV</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)} className="bg-indigo-600 border-none">
            New Production Order
          </Button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Order ID</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Content</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Qty</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Deadline</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Progress</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {paginatedOrders.map((order: any) => {
                  const tasks = [...(order.tasks || [])].sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0));
                  const firstThree = tasks.slice(0, 3);
                  const isOverdue = order.deadline && dayjs(order.deadline).endOf('day').isBefore(dayjs()) && !['done', 'completed'].includes(order.status);

                  return (
                    <tr key={order.id} className={`hover:bg-slate-50 transition-colors ${isOverdue ? 'bg-rose-50/50' : ''}`}>
                      <td className="px-6 py-4">
                        <span className={`font-bold ${isOverdue ? 'text-rose-600' : 'text-indigo-600'}`}>#{order.code}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                            {(order.customers?.name || 'K').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-semibold text-sm">{order.customers?.name || 'Khách lẻ'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 max-w-[320px] truncate">{order.title}</td>
                      <td className="px-6 py-4 text-sm font-medium">
                        {(order.specs?.quantity || 0).toLocaleString()} {order.specs?.unit || ''}
                      </td>
                      <td className={`px-6 py-4 text-sm ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                        {order.deadline ? dayjs(order.deadline).format('DD/MM/YYYY') : 'Chưa cập nhật'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {firstThree.map((task: any, idx: number) => {
                            const meta = getProgressMeta(task.status);
                            const stepName = task.departments?.name || getDeptName(task.department_id);
                            return (
                              <React.Fragment key={`${order.id}-${task.id || idx}`}>
                                <Tooltip
                                  title={`Bước ${task.sequence_order || idx + 1}: ${stepName}`}
                                  placement="top"
                                >
                                  <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold cursor-help ${meta.colorClass}`}>
                                    {task.status === 'done' || task.status === 'completed' ? '✓' : idx + 1}
                                  </div>
                                </Tooltip>
                                {idx < firstThree.length - 1 && <div className="w-8 h-1 rounded-full bg-slate-300" />}
                              </React.Fragment>
                            );
                          })}
                          {tasks.length === 0 && <span className="text-xs italic text-slate-400">Chưa có bước</span>}
                          <span className={`ml-2 text-xs font-bold uppercase ${isOverdue ? 'text-rose-600' : 'text-indigo-600'}`}>
                            {isOverdue ? 'Delayed' : getProgressMeta(tasks[tasks.length - 1]?.status || 'pending').label}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end items-center gap-1">
                          <Button type="text" icon={<NodeIndexOutlined />} onClick={() => handleOpenAssignModal(order)} />
                          <Button type="text" icon={<EyeOutlined />} onClick={() => { setSelectedOrder(order); setDetailStartInEditMode(false); setDetailModalVisible(true); }} />
                          <Button type="text" icon={<EditOutlined />} onClick={() => { setSelectedOrder(order); setDetailStartInEditMode(true); setDetailModalVisible(true); }} />
                          <Popconfirm title="Xóa đơn hàng này?" onConfirm={() => handleDelete(order.id)} okText="Xóa" cancelText="Hủy">
                            <Button type="text" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginatedOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400 italic">
                      Không có đơn hàng phù hợp bộ lọc
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 px-6 py-4 flex items-center justify-between">
            <span className="text-sm text-slate-500">Showing {paginatedOrders.length} of {filteredData.length} active orders</span>
            <div className="flex gap-2">
              <Button size="small" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <Button size="small" disabled={currentPage >= Math.max(1, Math.ceil(filteredData.length / pageSize))} onClick={() => setCurrentPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4 min-w-[1200px]">
            {kanbanColumns.map((col) => {
              const columnTasks = representativeKanbanTasks.filter((t: any) => normalizeKanbanStatus(t.status) === col.key);
              return (
                <div key={col.key} className="bg-white rounded-2xl border border-slate-200 p-3 min-h-[320px]">
                  <div className="flex items-center justify-between mb-3">
                    <Tag color={col.color as any} className="m-0 font-bold">{col.label}</Tag>
                    <Text className="text-slate-400 text-xs">{columnTasks.length}</Text>
                  </div>
                  <div className="space-y-2">
                    {columnTasks.map((task: any) => (
                      <div
                        key={task.id}
                        className="p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-indigo-200 cursor-pointer transition-all"
                        onClick={() => {
                          setSelectedOrder(task.production_orders);
                          setDetailStartInEditMode(false);
                          setDetailModalVisible(true);
                        }}
                      >
                        <Text className="block font-bold text-indigo-600 text-xs">{task.production_orders?.code}</Text>
                        <Text className="block text-[11px] font-semibold text-slate-700 line-clamp-2">{task.production_orders?.title}</Text>
                        <Text className="block text-[10px] text-slate-500 mt-1">
                          Bước {task.sequence_order} - {task.departments?.name || getDeptName(task.department_id)}
                        </Text>
                        <Text className="block text-[10px] text-slate-400">
                          {task.production_orders?.deadline ? `Deadline ${dayjs(task.production_orders.deadline).format('DD/MM')}` : 'Chưa có deadline'}
                        </Text>
                      </div>
                    ))}
                    {columnTasks.length === 0 && <Text className="text-xs text-slate-300 italic">Trống</Text>}
                  </div>
                </div>
              );
            })}
          </div>
          {kanbanLoading && <Text className="text-slate-500 text-xs mt-2 block">Đang tải kanban...</Text>}
        </div>
      )}

      <CreateOrderModal visible={createModalVisible} onClose={() => { setCreateModalVisible(false); fetchOrders(); }} />
      <OrderDetailModal
        visible={detailModalVisible}
        order={selectedOrder}
        startInEditMode={detailStartInEditMode}
        onClose={() => {
          setDetailModalVisible(false);
          setDetailStartInEditMode(false);
        }}
      />
      <Modal
        title={<span><NodeIndexOutlined /> Phân công công việc: {assignOrder?.code || '---'}</span>}
        open={assignModalVisible}
        onCancel={() => {
          setAssignModalVisible(false);
          setAssignOrder(null);
          setSelectedSteps([]);
        }}
        onOk={handleAssignWorkflow}
        okText="Xác nhận quy trình"
        cancelText="Đóng"
        confirmLoading={assigning}
        width={980}
        wrapClassName="designer-modal"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <NodeIndexOutlined />
                </span>
                <Text strong className="text-slate-800 tracking-wide">CÁC BƯỚC ĐÃ CHỌN</Text>
              </div>
              <Tag className="m-0 px-3 py-1 rounded-full border-none bg-indigo-100 text-indigo-700 font-bold">
                {selectedSteps.length} STEPS ACTIVE
              </Tag>
            </div>

            <div className="space-y-3 max-h-[430px] overflow-y-auto pr-1">
              {selectedSteps.length > 0 ? selectedSteps.map((step, index) => (
                <div
                  key={`${step.deptId}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_6px_24px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <span className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-indigo-600 animate-pulse' : 'bg-slate-300'}`} />
                      {index < selectedSteps.length - 1 && <span className="w-0.5 h-12 bg-slate-200 rounded-full mt-2" />}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <Text className="block text-base font-bold text-slate-800">
                            {getDeptName(step.deptId)}
                          </Text>
                          <Text className="text-xs text-slate-500">Bước {index + 1} trong quy trình</Text>
                        </div>
                        <Button
                          type="text"
                          size="small"
                          danger
                          onClick={() => handleRemoveStep(index)}
                          className="!px-2"
                        >
                          Xóa
                        </Button>
                      </div>
                      <Input.TextArea
                        autoSize={{ minRows: 2, maxRows: 4 }}
                        value={step.note}
                        onChange={(e) => handleUpdateNote(index, e.target.value)}
                        placeholder="Nhập hướng dẫn cụ thể cho bộ phận này..."
                        className="rounded-xl"
                      />
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-6">
                          <Select
                            value={step.materialStatus}
                            onChange={(value) => handleUpdateMaterialStatus(index, value)}
                            className="w-full"
                            options={[
                              { value: 'waiting_material', label: 'Chờ vật tư' },
                              { value: 'material_ready', label: 'Cấp đủ vật tư' },
                            ]}
                          />
                        </div>
                        <div className="col-span-6 text-right">
                          <Button size="small" icon={<PlusCircleOutlined />} onClick={() => handleAddStepMaterial(index)}>
                            Thêm vật tư
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {(step.materials || []).map((item, materialIdx) => (
                          <div key={`${index}-material-${materialIdx}`} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-7">
                              <Select
                                showSearch
                                value={item.materialId}
                                placeholder="Chọn vật tư từ kho"
                                optionFilterProp="label"
                                options={materials.map((m) => ({
                                  value: m.id,
                                  label: `${m.name} (Tồn: ${Number(m.stock_quantity || 0).toLocaleString()} ${m.unit || ''})`,
                                }))}
                                onChange={(value) => {
                                  const selectedMaterial = materials.find((m) => m.id === value);
                                  handleUpdateStepMaterial(index, materialIdx, {
                                    materialId: value,
                                    name: selectedMaterial?.name || '',
                                    unit: selectedMaterial?.unit || '',
                                  });
                                }}
                                className="w-full"
                              />
                            </div>
                            <div className="col-span-3">
                              <InputNumber
                                min={0}
                                value={item.quantity}
                                onChange={(value) => handleUpdateStepMaterial(index, materialIdx, { quantity: value as number | null })}
                                placeholder="Số lượng"
                                className="w-full"
                              />
                            </div>
                            <div className="col-span-2 text-right">
                              <Button
                                size="small"
                                danger
                                type="text"
                                onClick={() => handleRemoveStepMaterial(index, materialIdx)}
                              >
                                Xóa
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="h-[260px] rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-center px-6">
                  <Text className="text-sm text-slate-400 italic">
                    Chưa có bước nào. Chọn bộ phận bên phải hoặc áp dụng quy trình mẫu để bắt đầu.
                  </Text>
                </div>
              )}
            </div>
          </section>

          <aside className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4">
              <Text strong className="text-slate-700 block mb-3">Quy trình mẫu</Text>
              <Input
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="Tìm kiếm quy trình..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="h-10 rounded-xl mb-3 bg-white"
              />
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {filteredWorkflowTemplates.length > 0 ? filteredWorkflowTemplates.map((wf) => (
                  <button
                    key={wf.id}
                    type="button"
                    onClick={() => handleApplyTemplate(wf.department_sequence || [])}
                    className="w-full flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3 py-2 text-left hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                  >
                    <span className="text-sm font-semibold text-slate-700">{wf.name}</span>
                    <PlusCircleOutlined className="text-indigo-500" />
                  </button>
                )) : (
                  <Text className="text-slate-400 text-sm italic">Không tìm thấy quy trình mẫu</Text>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <Text strong className="text-slate-700 block mb-3">Thêm bước làm việc</Text>
              <div className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto pr-1">
                {departments.map((dept) => (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => handleAddStep(dept.id)}
                    className="px-4 py-2 bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 text-xs font-bold rounded-full transition-colors"
                  >
                    {dept.name}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </Modal>
    </div>
  );
}
