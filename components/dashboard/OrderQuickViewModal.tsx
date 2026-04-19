'use client';

import React, { useState, useEffect } from 'react';
import { 
  Modal, Tabs, Typography, Row, Col, Space, Tag, 
  Steps, Table, Button, 
  Card, Progress, Timeline, 
} from 'antd';
import { 
  PrinterOutlined, 
  NodeIndexOutlined, 
  HistoryOutlined, 
  CheckCircleOutlined,
  PlayCircleOutlined,
  SyncOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
  LeftOutlined,
  RightOutlined,
  ArrowRightOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface OrderQuickViewModalProps {
  visible: boolean;
  order: any;
  departments: any[];
  onClose: () => void;
  onNavigate?: (direction: 'next' | 'prev') => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export default function OrderQuickViewModal({ 
  visible, order, departments, onClose, onNavigate, isFirst, isLast 
}: OrderQuickViewModalProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('1');
  const [, forceUpdate] = useState({});

  useEffect(() => {
    if (visible && order) {
      fetchTaskDetails();
    }
  }, [visible, order]);

  // Auto-refresh thời gian phản hồi real-time mỗi 30 giây
  useEffect(() => {
    if (!visible) return;
    
    const interval = setInterval(() => {
      // Force re-render để cập nhật thời gian phản hồi real-time
      forceUpdate({});
    }, 30000); // 30 giây

    return () => clearInterval(interval);
  }, [visible]);

  const fetchTaskDetails = async () => {
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
          assigned_to,
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
      if (order.tasks) {
        setTasks(order.tasks);
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = () => {
    if (!tasks.length) return 0;
    const doneTasks = tasks.filter(t => t.status === 'done').length;
    return Math.round((doneTasks / tasks.length) * 100);
  };

  const getCurrentStep = () => {
    return tasks.findIndex(t => t.status !== 'done');
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      done: 'emerald',
      in_progress: 'indigo',
      ready: 'sky',
      issue: 'rose',
      on_hold: 'amber',
      pending: 'slate'
    };
    return colors[status] || 'slate';
  };

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

  const handleNext = () => onNavigate?.('next');
  const handlePrev = () => onNavigate?.('prev');

  const tabItems = [
    {
      key: '1',
      label: <span className="flex items-center gap-2"><InfoCircleOutlined /> TỔNG QUAN</span>,
      children: (
        <div className="p-6 space-y-6 animate-in">
          <Row gutter={[24, 24]}>
            <Col span={14}>
              <div className="ui-surface p-6 h-full flex flex-col justify-between">
                <div>
                   <Text className="premium-label text-slate-400 block mb-4">THÔNG TIN CHI TIẾT</Text>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                        <Text className="text-slate-500 font-medium">Mã Lệnh Sản Xuất</Text>
                        <Text className="font-mono font-black text-indigo-600 text-lg">{order?.code}</Text>
                      </div>
                      <div className="flex justify-between items-start pb-3 border-b border-slate-50">
                        <Text className="text-slate-500 font-medium">Nội dung đơn</Text>
                        <Text strong className="text-right max-w-[200px]">{order?.title}</Text>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                        <Text className="text-slate-500 font-medium">Khách hàng</Text>
                        <Tag color="blue" className="m-0 border-none font-bold rounded-lg px-3">{order?.customers?.name || 'Vãng lai'}</Tag>
                      </div>
                      <div className="flex justify-between items-center">
                        <Text className="text-slate-500 font-medium">Quy cách</Text>
                        <Text strong className="text-indigo-900 bg-indigo-50 px-3 py-1 rounded-full text-xs">
                          {order?.specs?.quantity?.toLocaleString()} {order?.specs?.unit}
                        </Text>
                      </div>
                   </div>
                </div>
              </div>
            </Col>
            <Col span={10}>
              <div className="ui-surface p-6 h-full bg-slate-900 text-white border-none flex flex-col items-center justify-center relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full -mr-16 -mt-16"></div>
                 <Text className="premium-label text-slate-400 mb-6">TIẾN ĐỘ TỔNG THỂ</Text>
                 <Progress 
                    type="circle" 
                    percent={calculateProgress()} 
                    strokeColor={{
                      '0%': '#6366f1',
                      '100%': '#10b981',
                    }}
                    trailColor="rgba(255,255,255,0.1)"
                    size={140}
                    format={percent => (
                      <div className="text-white">
                        <div className="text-2xl font-black">{percent}%</div>
                        <div className="text-[8px] opacity-60 uppercase font-bold tracking-tighter">Completed</div>
                      </div>
                    )}
                  />
                  <div className="mt-6 flex gap-2">
                     <span className="text-xs font-bold px-3 py-1 bg-white/10 rounded-full border border-white/10">
                        {tasks.filter(t => t.status === 'done').length}/{tasks.length} BƯỚC HOÀN TẤT
                     </span>
                  </div>
              </div>
            </Col>
            <Col span={24}>
               <div className="ui-surface p-6 bg-slate-50">
                  <Text className="premium-label text-slate-400 block mb-4 uppercase">Các khâu đã qua</Text>
                  <div className="flex flex-wrap gap-2">
                    {tasks.map((task: any) => {
                      const color = getStatusColor(task.status);
                      return (
                        <div 
                          key={task.id}
                          className={`
                            flex items-center gap-2 px-4 py-2 rounded-2xl border-2 transition-all
                            bg-${color}-50 border-${color}-100 text-${color}-700 font-bold text-xs
                          `}
                        >
                          {task.status === 'done' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                          {task.departments?.name}: {getStatusLabel(task.status)}
                        </div>
                      );
                    })}
                  </div>
               </div>
            </Col>
          </Row>
        </div>
      )
    },
    {
      key: '2',
      label: <span className="flex items-center gap-2"><NodeIndexOutlined /> QUY TRÌNH KỸ THUẬT</span>,
      children: (
        <div className="p-8 animate-in overflow-y-auto max-h-[60vh] custom-scrollbar">
          <Steps
            orientation="vertical"
            current={getCurrentStep()}
            className="premium-steps"
            items={tasks.map((task: any, idx: number) => {
              const responderName = task.users?.full_name || 'Hệ thống';
              const readyTime = task.ready_at;
              // Thời gian phản hồi: 
              // - Nếu đã nhận việc (có start_time): lấy khoảng thời gian đã lưu (KHÔNG đếm nữa)
              // - Nếu chưa nhận việc (chưa có start_time) NHƯNG đã được giao (có ready_at) VÀ đang chờ (status = ready/pending): đếm real-time
              // - Nếu đang làm (in_progress) hoặc đã xong (done): KHÔNG đếm, chỉ hiển thị giá trị đã lưu
              // - Nếu chưa được giao (chưa có ready_at): không tính (bước trước chưa xong)
              const responseTime = task.start_time && readyTime 
                ? dayjs(task.start_time).diff(dayjs(readyTime), 'minute')
                : (readyTime && !task.start_time && (task.status === 'ready' || task.status === 'pending'))
                  ? dayjs().diff(dayjs(readyTime), 'minute')
                  : null;
              
              const isOverdue = task.status === 'in_progress' && task.start_time && task.estimated_duration_seconds && 
                                dayjs().isAfter(dayjs(task.start_time).add(task.estimated_duration_seconds, 'second'));

              return {
                title: (
                  <div className="flex flex-col w-full">
                    <div className="flex items-center justify-between pr-4">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-mono text-[10px] font-bold">BƯỚC {idx + 1}</span>
                        <Text className="font-black text-slate-800 text-base tracking-tight">{task.departments?.name}</Text>
                        {task.estimated_duration_seconds > 0 && (
                          <Tag className="m-0 border-none bg-indigo-50 text-indigo-600 text-[9px] font-bold px-2 rounded-lg">
                            KPI: {Math.round(task.estimated_duration_seconds / 60)}P
                          </Tag>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {task.status === 'done' && (
                           <Tag className="m-0 border-none bg-emerald-50 text-emerald-600 font-black text-[9px] px-3 py-1 rounded-full">HOÀN TẤT</Tag>
                        )}
                        {task.status === 'in_progress' && (
                           <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 text-white rounded-full text-[9px] font-black animate-shimmer">
                              <SyncOutlined spin /> ĐANG LÀM
                           </div>
                        )}
                        {(task.status === 'issue' || task.status === 'on_hold') && (
                           <Tag className="m-0 border-none bg-rose-50 text-rose-600 font-black text-[9px] px-3 py-1 rounded-full uppercase tracking-tighter">SỰ CỐ / DỪNG</Tag>
                        )}
                        {task.status === 'ready' && (
                           <Tag className="m-0 border-none bg-cyan-50 text-cyan-600 font-black text-[9px] px-3 py-1 rounded-full uppercase tracking-tighter">SẴN SÀNG</Tag>
                        )}
                      </div>
                    </div>
                  </div>
                ),
                description: (
                  <div className={`mt-4 mb-6 rounded-[28px] border transition-all duration-300 overflow-hidden ${
                    task.status === 'in_progress' ? 'bg-white shadow-xl shadow-indigo-100 border-indigo-100 ring-2 ring-indigo-50' : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                  }`}>
                    <div className="p-5">
                      <Row gutter={[24, 16]}>
                        <Col span={10}>
                          <div className="space-y-4">
                             <div>
                                <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Người xác nhận</Text>
                                <div className="flex items-center gap-2.5">
                                   <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs border-2 border-white shadow-sm font-mono overflow-hidden uppercase">
                                      {responderName.charAt(0)}
                                   </div>
                                   <div>
                                      <Text className="text-xs font-bold text-slate-700 block leading-tight">{responderName}</Text>
                                      <Text className="text-[10px] text-slate-400 font-medium tracking-tight">BP. {task.departments?.code || 'XNK'}</Text>
                                   </div>
                                </div>
                             </div>
                             {task.machine_info?.machine_id && (
                               <div>
                                  <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Thiết bị sử dụng</Text>
                                  <Text className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 inline-block font-mono">
                                     {task.machine_info.machine_id}
                                  </Text>
                               </div>
                             )}
                          </div>
                        </Col>
                        
                        <Col span={14} className="border-l border-slate-100 pl-6">
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-3">
                                 <div>
                                    <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Thời gian phản hồi</Text>
                                    <div className="flex items-center gap-2">
                                       <ClockCircleOutlined className={`text-xs ${!task.start_time && responseTime !== null ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`} />
                                       <Text className={`text-xs font-black font-mono ${
                                         task.start_time && responseTime !== null && responseTime > 30 ? 'text-rose-500' : 
                                         !task.start_time && responseTime !== null ? 'text-amber-600' :
                                         'text-slate-600'
                                       }`}>
                                          {responseTime !== null ? `${responseTime} phút` : (readyTime ? '---' : 'Chờ bước trước')}
                                       </Text>
                                       {!task.start_time && responseTime !== null && (
                                         <Tag className="m-0 text-[8px] bg-amber-50 text-amber-600 border-none font-bold animate-pulse">ĐANG ĐẾM</Tag>
                                       )}
                                       {task.start_time && responseTime !== null && responseTime > 30 && (
                                         <Tag className="m-0 text-[8px] bg-rose-50 text-rose-500 border-none font-bold">ĐÃ LƯU - CHẬM</Tag>
                                       )}
                                       {task.start_time && responseTime !== null && responseTime <= 30 && (
                                         <Tag className="m-0 text-[8px] bg-emerald-50 text-emerald-600 border-none font-bold">ĐÃ LƯU</Tag>
                                       )}
                                    </div>
                                 </div>
                                 {readyTime && (
                                   <div>
                                      <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Giao việc lúc</Text>
                                      <Text className="text-[11px] font-bold text-slate-500 font-mono tracking-tighter">{dayjs(readyTime).format('HH:mm - DD/MM')}</Text>
                                   </div>
                                 )}
                                 {!readyTime && (
                                   <div>
                                      <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Trạng thái</Text>
                                      <Tag className="m-0 text-[8px] bg-slate-100 text-slate-500 border-none font-bold">CHỜ BƯỚC TRƯỚC</Tag>
                                   </div>
                                 )}
                              </div>
                              <div className="space-y-3">
                                 {task.start_time && (
                                   <div>
                                      <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Xác nhận lúc</Text>
                                      <Text className="text-[11px] font-black text-indigo-600 font-mono tracking-tighter">{dayjs(task.start_time).format('HH:mm - DD/MM')}</Text>
                                   </div>
                                 )}
                                 {task.status === 'in_progress' && task.start_time && (
                                   <div>
                                      <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Hạn hoàn thành</Text>
                                      <div className="flex flex-col">
                                         <Text className={`text-[11px] font-black font-mono tracking-tighter ${isOverdue ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}>
                                            {dayjs(task.start_time).add(task.estimated_duration_seconds, 'second').format('HH:mm - DD/MM')}
                                         </Text>
                                      </div>
                                   </div>
                                 )}
                                 {task.status === 'done' && task.end_time && (
                                   <div>
                                      <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Hoàn tất lúc</Text>
                                      <Text className="text-[11px] font-black text-emerald-600 font-mono tracking-tighter">{dayjs(task.end_time).format('HH:mm - DD/MM')}</Text>
                                   </div>
                                 )}
                              </div>
                           </div>
                        </Col>
                      </Row>
 
                      {task.issue_log && (
                        <div className="mt-4 p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-start gap-3">
                           <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-rose-500 shadow-sm border border-rose-100">
                              <WarningOutlined />
                           </div>
                           <div>
                              <Text className="text-[10px] font-black text-rose-400 uppercase tracking-widest block mb-1">Thông tin sự cố / Ghi chú</Text>
                              <Text className="text-xs font-bold text-rose-700 leading-snug">{task.issue_log}</Text>
                           </div>
                        </div>
                      )}
                    </div>
                  </div>
                ),
                status: task.status === 'done' ? 'finish' : 
                        task.status === 'in_progress' ? 'process' :
                        task.status === 'issue' || task.status === 'on_hold' ? 'error' : 'wait',
              };
            })}
          />
        </div>
      )
    },
    {
      key: '3',
      label: <span className="flex items-center gap-2"><HistoryOutlined /> LỊCH SỬ HỆ THỐNG</span>,
      children: (
        <div className="p-8 animate-in">
          <Timeline
            mode="left"
            className="premium-timeline"
            items={tasks
              .filter(t => t.start_time || t.end_time)
              .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
              .slice(0, 10)
              .map(task => ({
                color: task.status === 'done' ? '#10b981' : 
                       task.status === 'issue' ? '#ef4444' : '#6366f1',
                children: (
                  <div className="bg-white p-4 rounded-[20px] shadow-sm border border-slate-50 mb-4 transition-all hover:translate-x-1">
                    <div className="flex justify-between items-center mb-1">
                       <Text strong className="text-slate-900">{task.departments?.name}</Text>
                       <Text className="text-[10px] items-center px-2 py-0.5 bg-slate-100 rounded-full font-bold text-slate-500">
                          {dayjs(task.updated_at).format('HH:mm DD/MM')}
                       </Text>
                    </div>
                    <Tag 
                      className={`m-0 border-none font-black text-[9px] rounded-lg px-2 bg-${getStatusColor(task.status)}-50 text-${getStatusColor(task.status)}-600`}
                    >
                      {task.status.toUpperCase()}
                    </Tag>
                  </div>
                )
              }))}
          />
        </div>
      )
    }
  ];

  return (
    <Modal
      title={
        <div className="flex flex-col gap-1 pr-12">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl text-lg">
                 <PrinterOutlined />
              </div>
              <div className="flex flex-col">
                 <span className="text-2xl font-black tracking-tighter text-slate-900 leading-tight">LSX: {order?.code}</span>
                 <Text className="text-[10px] font-black uppercase tracking-wider text-indigo-500">{order?.status}</Text>
              </div>
           </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1000}
      centered
      className="premium-modal no-padding-body"
      closeIcon={<div className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full transition-all mt-4 mr-4"><CloseOutlined /></div>}
    >
      <div className="flex flex-col h-[75vh]">
         {/* Navigation Overlay */}
         <div className="absolute top-1/2 -left-20 group">
            <Button 
               type="primary" 
               shape="circle" 
               icon={<LeftOutlined />} 
               size="large"
               disabled={isFirst}
               onClick={handlePrev}
               className="h-14 w-14 shadow-2xl scale-0 group-hover:scale-100 transition-transform opacity-0 group-hover:opacity-100"
            />
         </div>
         <div className="absolute top-1/2 -right-20 group">
            <Button 
               type="primary" 
               shape="circle" 
               icon={<RightOutlined />} 
               size="large"
               disabled={isLast}
               onClick={handleNext}
               className="h-14 w-14 shadow-2xl scale-0 group-hover:scale-100 transition-transform opacity-0 group-hover:opacity-100"
            />
         </div>

         <div className="flex-1 overflow-auto custom-scrollbar">
            <Tabs 
               activeKey={activeTab} 
               onChange={setActiveTab}
               items={tabItems} 
               destroyOnHidden 
               className="premium-tabs-layout h-full"
               centered
            />
         </div>

         <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center rounded-b-[28px]">
            <Space size={12}>
               <Button 
                  icon={<LeftOutlined />} 
                  onClick={handlePrev} 
                  disabled={isFirst}
                  className="rounded-xl font-bold h-11 px-6 border-slate-200"
               >PREV</Button>
               <Button 
                  className="rounded-xl font-bold h-11 px-6 border-slate-200"
                  onClick={handleNext} 
                  disabled={isLast}
               >NEXT <RightOutlined /></Button>
            </Space>
            <div className="flex items-center gap-4">
               <Text className="text-xs font-black text-slate-400">QUICK ACTIONS</Text>
               <Button type="primary" className="rounded-xl font-bold h-11 px-8 shadow-indigo-200 shadow-lg">XUẤT LỆNH <ArrowRightOutlined /></Button>
            </div>
         </div>
      </div>

      <style jsx global>{`
        .premium-tabs-layout .ant-tabs-nav { margin-bottom: 0 !important; background: #ffffff; padding: 0 32px; border-bottom: 1px solid #f1f5f9; }
        .premium-tabs-layout .ant-tabs-nav::before { border: none !important; }
        .premium-modal .ant-modal-content { padding: 0 !important; border-radius: 32px !important; overflow: hidden; }
        .premium-modal .ant-modal-header { padding: 32px 32px 24px 32px !important; margin: 0 !important; }
        .premium-steps .ant-steps-item-title { width: 100%; }
        .premium-steps .ant-steps-item-process .ant-steps-item-icon { background: #6366f1; border-color: #6366f1; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .animate-in { animation: slideIn 0.3s ease-out; }
      `}</style>
    </Modal>
  );
}
