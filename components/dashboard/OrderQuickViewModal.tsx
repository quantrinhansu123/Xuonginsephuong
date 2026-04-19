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

  useEffect(() => {
    if (visible && order) {
      fetchTaskDetails();
    }
  }, [visible, order]);

  const fetchTaskDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          departments (name, code),
          estimated_duration_seconds
        `)
        .eq('order_id', order.id)
        .order('sequence_order', { ascending: true });
      
      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error(err);
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
              <div className="ui-surface p-6 h-full bg-slate-900 text-white border-none flex flex-col items-center justify-center">
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
                        {tasks.filter(t => t.status === 'done').length}/{tasks.length} BƯỚC
                     </span>
                  </div>
              </div>
            </Col>
            <Col span={24}>
              <div className="glass-card p-6 rounded-[24px]">
                <Text className="premium-label text-slate-400 block mb-4">LỘ TRÌNH BỘ PHẬN</Text>
                <div className="flex flex-wrap gap-3">
                  {tasks.map((task) => {
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
        <div className="p-8 animate-in">
          <Steps
            orientation="vertical"
            current={getCurrentStep()}
            className="premium-steps"
            items={tasks.map((task, idx) => ({
              title: (
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-2">
                    <Text className="font-black text-slate-800 tracking-tight">{task.departments?.name}</Text>
                    {task.estimated_duration_seconds > 0 && (
                      <Tag className="m-0 border-none bg-slate-100 text-slate-500 text-[9px] font-bold">
                        KPI: {Math.round(task.estimated_duration_seconds / 60)}P
                      </Tag>
                    )}
                  </div>
                  <Tag 
                    className={`m-0 border-none font-black text-[10px] rounded-full px-3 py-0.5 bg-${getStatusColor(task.status)}-100 text-${getStatusColor(task.status)}-700`}
                  >
                    {getStatusLabel(task.status)}
                  </Tag>
                </div>
              ),
              description: (
                <div className="mt-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center gap-6">
                    {task.start_time && (
                      <div className="flex flex-col">
                        <Text type="secondary" className="text-[9px] font-black uppercase tracking-wider">BẮT ĐẦU</Text>
                        <Text className="text-xs font-bold text-slate-600">{dayjs(task.start_time).format('DD/MM HH:mm')}</Text>
                      </div>
                    )}
                    {task.status === 'in_progress' && task.start_time && task.estimated_duration_seconds && (
                      <div className="flex flex-col">
                        <Text type="secondary" className="text-[9px] font-black uppercase tracking-wider">HẠN KPI</Text>
                        <Text className={`text-xs font-bold ${
                          dayjs().isAfter(dayjs(task.start_time).add(task.estimated_duration_seconds, 'second')) 
                          ? 'text-rose-600 animate-pulse' 
                          : 'text-amber-500'
                        }`}>
                          {dayjs(task.start_time).add(task.estimated_duration_seconds, 'second').format('HH:mm DD/MM')}
                        </Text>
                      </div>
                    )}
                  </div>
                  {task.issue_log && (
                    <div className="mt-2 p-2 bg-rose-100 text-rose-700 rounded-lg text-[11px] font-bold flex items-center gap-2">
                       <WarningOutlined /> {task.issue_log}
                    </div>
                  )}
                  {task.material_shortage && (
                    <div className="mt-2 p-2 bg-amber-100 text-amber-700 rounded-lg text-[11px] font-bold flex items-center gap-2">
                       <ClockCircleOutlined /> ĐANG THIẾU VẬT TƯ (CHỜ KHO)
                    </div>
                  )}
                </div>
              ),
              status: task.status === 'done' ? 'finish' : 
                      task.status === 'in_progress' ? 'process' :
                      task.status === 'issue' || task.status === 'on_hold' ? 'error' : 'wait',
            }))}
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

  const handleNext = () => onNavigate?.('next');
  const handlePrev = () => onNavigate?.('prev');

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
        .animate-slide { animation: slideIn 0.3s ease-out; }
      `}</style>
    </Modal>
  );
}
