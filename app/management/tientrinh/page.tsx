'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Dropdown, Empty, Input, Modal, Tag, Typography, message } from 'antd';
import type { MenuProps } from 'antd';
import { EllipsisOutlined } from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import OrderDetailModal from '@/components/orders/OrderDetailModal';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function TienTrinhPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [departments, setDepartments] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingTaskId, setActingTaskId] = useState<string | number | null>(null);
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [holdTask, setHoldTask] = useState<any>(null);
  const [holdNote, setHoldNote] = useState('');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: deptData, error: deptError }, { data: taskData, error: taskError }] = await Promise.all([
        supabase
          .from('departments')
          .select('id, name, code, step_name')
          .order('id', { ascending: true }),
        supabase
          .from('tasks')
          .select(`
            id,
            order_id,
            status,
            sequence_order,
            department_id,
            ready_at,
            start_time,
            response_time_minutes,
            issue_log,
            updated_at,
            production_orders:order_id (
              id,
              code,
              title,
              specs,
              status,
              customers (name)
            )
          `)
          .in('status', ['pending', 'ready', 'in_progress', 'issue', 'on_hold', 'done', 'completed'])
          .order('updated_at', { ascending: false })
      ]);

      if (deptError) throw deptError;
      if (taskError) throw taskError;

      setDepartments(deptData || []);
      setTasks(taskData || []);
    } catch (err) {
      console.error(err);
      messageApi.error('Lỗi khi tải dữ liệu tiến trình');
    } finally {
      setLoading(false);
    }
  };

  const tasksByDepartment = useMemo(() => {
    const activeStatuses = new Set(['pending', 'ready', 'in_progress', 'issue', 'on_hold']);
    const doneStatuses = new Set(['done', 'completed']);
    const map: Record<number, any[]> = {};
    const tasksByOrder: Record<string, any[]> = {};

    for (const task of tasks) {
      if (!task.order_id) continue;
      if (!tasksByOrder[task.order_id]) tasksByOrder[task.order_id] = [];
      tasksByOrder[task.order_id].push(task);
    }

    for (const orderTasks of Object.values(tasksByOrder)) {
      const sortedTasks = [...orderTasks].sort((a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0));

      for (let idx = 0; idx < sortedTasks.length; idx += 1) {
        const task = sortedTasks[idx];
        if (!activeStatuses.has(task.status)) continue;

        // Chỉ hiển thị bước hiện tại khi bước liền trước đã hoàn thành.
        if (idx > 0) {
          const prevTask = sortedTasks[idx - 1];
          if (!doneStatuses.has(prevTask?.status)) {
            continue;
          }
        }

        if (!map[task.department_id]) map[task.department_id] = [];
        map[task.department_id].push(task);
      }
    }
    return map;
  }, [tasks]);

  const displayDepartments = useMemo(() => {
    const existingIds = new Set((departments || []).map((dept: any) => dept.id));
    const missingFromTasks = Array.from(new Set((tasks || []).map((task: any) => task.department_id)))
      .filter((deptId: any) => deptId && !existingIds.has(deptId))
      .map((deptId: any) => ({
        id: deptId,
        name: `Bộ phận #${deptId}`,
        step_name: `Bước ${deptId}`,
      }));

    return [...(departments || []), ...missingFromTasks].sort((a: any, b: any) => (a.id || 0) - (b.id || 0));
  }, [departments, tasks]);

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Chưa xác nhận',
      ready: 'Sẵn sàng',
      in_progress: 'Đang làm',
      issue: 'Sự cố',
      on_hold: 'Tạm hoãn',
      done: 'Hoàn thành',
      completed: 'Hoàn thành',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'default',
      ready: 'cyan',
      in_progress: 'blue',
      issue: 'red',
      on_hold: 'orange',
      done: 'green',
      completed: 'green',
    };
    return colors[status] || 'default';
  };

  const updateTaskStatus = async (task: any, nextStatus: string, extra: Record<string, any> = {}) => {
    setActingTaskId(task.id);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('tasks')
        .update({
          status: nextStatus,
          updated_at: now,
          ...extra,
        })
        .eq('id', task.id);

      if (error) throw error;
      messageApi.success('Đã cập nhật trạng thái công việc');
      await fetchData();
    } catch (err) {
      console.error(err);
      messageApi.error('Lỗi khi cập nhật trạng thái');
    } finally {
      setActingTaskId(null);
    }
  };

  const handleConfirmTask = async (task: any) => {
    setActingTaskId(task.id);
    try {
      const now = new Date().toISOString();
      const responseMinutes = task.ready_at
        ? Math.max(0, dayjs(now).diff(dayjs(task.ready_at), 'minute'))
        : null;
      const { error: currentError } = await supabase
        .from('tasks')
        .update({
          status: 'in_progress',
          start_time: task.start_time || now,
          response_time_minutes: task.start_time ? task.response_time_minutes : responseMinutes,
          updated_at: now,
        })
        .eq('id', task.id);

      if (currentError) throw currentError;

      const sameOrderTasks = tasks
        .filter((item: any) => item.order_id === task.order_id)
        .sort((a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0));
      const nextTask = sameOrderTasks.find((item: any) => (item.sequence_order || 0) > (task.sequence_order || 0));

      if (nextTask && ['pending', 'on_hold', 'issue'].includes(nextTask.status)) {
        const { error: nextError } = await supabase
          .from('tasks')
          .update({
            status: 'ready',
            ready_at: now,
            updated_at: now,
          })
          .eq('id', nextTask.id);
        if (nextError) throw nextError;
      }

      messageApi.success('Đã xác nhận, ghi nhận thời gian xác nhận và giao bước tiếp theo');
      await fetchData();
    } catch (err) {
      console.error(err);
      messageApi.error('Lỗi khi xác nhận công việc');
    } finally {
      setActingTaskId(null);
    }
  };

  const handleCompleteTask = async (task: any) => {
    setActingTaskId(task.id);
    try {
      const now = new Date().toISOString();

      const { error: currentError } = await supabase
        .from('tasks')
        .update({
          status: 'done',
          end_time: now,
          updated_at: now,
        })
        .eq('id', task.id);
      if (currentError) throw currentError;

      const sameOrderTasks = tasks
        .filter((item: any) => item.order_id === task.order_id)
        .sort((a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0));
      const nextTask = sameOrderTasks.find((item: any) => (item.sequence_order || 0) > (task.sequence_order || 0));

      if (nextTask && ['pending', 'on_hold', 'issue'].includes(nextTask.status)) {
        const { error: nextError } = await supabase
          .from('tasks')
          .update({
            status: 'ready',
            ready_at: now,
            updated_at: now,
          })
          .eq('id', nextTask.id);
        if (nextError) throw nextError;
      }

      if (!nextTask) {
        const { error: orderError } = await supabase
          .from('production_orders')
          .update({ status: 'completed' })
          .eq('id', task.order_id);
        if (orderError) throw orderError;
      }

      messageApi.success('Đã hoàn thành bước và giao bước tiếp theo');
      await fetchData();
    } catch (err) {
      console.error(err);
      messageApi.error('Lỗi khi hoàn thành công việc');
    } finally {
      setActingTaskId(null);
    }
  };

  const openHoldModal = (task: any) => {
    setHoldTask(task);
    setHoldNote('');
    setHoldModalOpen(true);
  };

  const handleTaskMenuAction = (task: any, action: string) => {
    if (action === 'view') {
      setSelectedOrder(task.production_orders);
      setDetailModalVisible(true);
      return;
    }
    if (action === 'confirm') {
      handleConfirmTask(task);
      return;
    }
    if (action === 'hold') {
      openHoldModal(task);
      return;
    }
    if (action === 'done') {
      handleCompleteTask(task);
    }
  };

  const submitHoldTask = async () => {
    if (!holdTask) return;
    if (!holdNote.trim()) {
      messageApi.warning('Vui lòng nhập ghi chú khi hoãn');
      return;
    }

    await updateTaskStatus(holdTask, 'on_hold', { issue_log: holdNote.trim() });
    setHoldModalOpen(false);
    setHoldTask(null);
    setHoldNote('');
  };

  const headerColors = [
    'from-indigo-500 to-indigo-600',
    'from-cyan-500 to-blue-500',
    'from-violet-500 to-purple-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-pink-500',
  ];

  return (
    <div className="space-y-8 max-w-[1800px] mx-auto animate-in px-4 sm:px-0 pb-10">
      {contextHolder}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <Title level={2} className="m-0 font-black tracking-tight text-slate-900 leading-tight">
            QUẢN LÝ <span className="text-indigo-600 uppercase">TIẾN TRÌNH</span>
          </Title>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 w-8 bg-indigo-600 rounded-full" />
            <Text className="premium-label text-slate-400">Kanban theo bước công việc từ cấu hình Bộ phận</Text>
          </div>
        </div>
      </div>

      {displayDepartments.length === 0 ? (
        <Card className="rounded-3xl border-slate-100">
          <Empty description="Chưa có bộ phận để hiển thị kanban" />
        </Card>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4 min-w-[1200px] pb-2">
            {displayDepartments.map((dept, deptIndex) => {
              const deptTasks = tasksByDepartment[dept.id] || [];
              const headerColor = headerColors[deptIndex % headerColors.length];
              return (
                <div key={dept.id} className="w-[330px] shrink-0 bg-white rounded-2xl border border-slate-200 p-3">
                  <div className={`mb-3 p-3 rounded-xl bg-gradient-to-r ${headerColor}`}>
                    <div className="flex items-center justify-between">
                      <Text className="font-black text-white uppercase text-xs">{dept.name || dept.step_name || `Quy trình ${dept.id}`}</Text>
                      <Tag className="m-0 border-none bg-white/20 text-white font-bold">{deptTasks.length}</Tag>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                    {deptTasks.length > 0 ? deptTasks.map((task: any) => {
                      const order = task.production_orders;
                      const isDone = task.status === 'done' || task.status === 'completed';
                      const isActing = actingTaskId === task.id;
                      const menuItems: MenuProps['items'] = [
                        { key: 'view', label: 'Xem' },
                        { key: 'confirm', label: 'Xác nhận', disabled: isDone },
                        { key: 'hold', label: 'Hoãn', disabled: isDone },
                        { key: 'done', label: 'Hoàn thành', disabled: isDone },
                      ];
                      return (
                        <div key={task.id} className={`rounded-xl border p-3 ${isDone ? 'border-emerald-200 bg-emerald-50/60 opacity-85' : 'border-slate-100 bg-slate-50'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <Text className="block text-[10px] text-indigo-500 font-semibold">
                                {order?.code || '---'}
                              </Text>
                              <Text className="block text-[12px] text-slate-700 font-semibold leading-tight line-clamp-2">
                                {order?.title || 'Không có tên đơn'}
                              </Text>
                              <Text className="block text-[11px] text-slate-500 mt-1">
                                Số lượng: {order?.specs?.quantity ?? '---'}
                              </Text>
                              <Tag color={getStatusColor(task.status)} className="m-0 mt-2 text-[10px] font-bold border-none">
                                {getStatusLabel(task.status)}
                              </Tag>
                            </div>
                            <Dropdown
                              trigger={['click']}
                              placement="bottomRight"
                              menu={{
                                items: menuItems,
                                onClick: ({ key }) => handleTaskMenuAction(task, String(key)),
                              }}
                            >
                              <Button
                                size="small"
                                type="text"
                                loading={isActing}
                                icon={<EllipsisOutlined />}
                                className="!px-2 !text-slate-500"
                              />
                            </Dropdown>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="text-center py-8 text-slate-300 text-xs italic">Không có công việc</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {loading && <Text className="text-slate-400 text-xs">Đang tải dữ liệu...</Text>}

      <OrderDetailModal
        visible={detailModalVisible}
        order={selectedOrder}
        startInEditMode={false}
        onClose={() => {
          setDetailModalVisible(false);
          setSelectedOrder(null);
        }}
      />

      <Modal
        title="Hoãn công việc"
        open={holdModalOpen}
        onOk={submitHoldTask}
        onCancel={() => {
          setHoldModalOpen(false);
          setHoldTask(null);
          setHoldNote('');
        }}
        okText="Xác nhận hoãn"
        cancelText="Đóng"
      >
        <Text className="text-slate-600 text-sm">Nhập ghi chú lý do hoãn (bắt buộc):</Text>
        <Input.TextArea
          className="mt-2"
          rows={4}
          value={holdNote}
          onChange={(e) => setHoldNote(e.target.value)}
          placeholder="Nhập ghi chú khi hoãn công việc..."
        />
      </Modal>
    </div>
  );
}
