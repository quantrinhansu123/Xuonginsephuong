'use client';

import React, { useState, useEffect } from 'react';
import { 
  Modal, Tabs, Form, Input, Select, Button, Table, 
  Typography, Space, Row, Col, Tag, message, 
  Divider, Card, Empty, Popconfirm, Switch, Descriptions, Statistic, Progress
} from 'antd';
import { 
  SaveOutlined, 
  DeleteOutlined,
  InfoCircleOutlined,
  HistoryOutlined,
  ToolOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface MachineDetailModalProps {
  visible: boolean;
  machine: any;
  departments: any[];
  onClose: () => void;
  onRefresh?: () => void;
}

export default function MachineDetailModal({ visible, machine, departments, onClose, onRefresh }: MachineDetailModalProps) {
  const [form] = Form.useForm();
  const [maintenanceLogs, setMaintenanceLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (visible && machine) {
      form.setFieldsValue({
        code: machine.code,
        name: machine.name,
        type: machine.type,
        department_id: machine.department_id,
        status: machine.status,
        specs: machine.specs,
      });
      fetchMaintenanceLogs();
    } else if (visible) {
      form.resetFields();
      setMaintenanceLogs([]);
    }
  }, [visible, machine, form]);

  const fetchMaintenanceLogs = async () => {
    if (!machine?.id) return;
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('machine_maintenance_logs')
        .select('*')
        .eq('machine_id', machine.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error('Supabase error fetching logs:', error.message, error.details);
        return;
      }
      setMaintenanceLogs(data || []);
    } catch (err: any) {
      console.error('Unexpected error fetching maintenance logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      if (machine) {
        const { error } = await supabase
          .from('machines')
          .update(values)
          .eq('id', machine.id);
        if (error) throw error;
        message.success('Đã cập nhật máy');
      } else {
        const { error } = await supabase
          .from('machines')
          .insert([values]);
        if (error) throw error;
        message.success('Đã thêm máy mới');
      }
      onRefresh?.();
      onClose();
    } catch (err: any) {
      console.error('Error saving machine:', err.message || err);
      message.error(`Lỗi khi lưu: ${err.message || 'Không xác định'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('machines')
        .delete()
        .eq('id', machine.id);
      if (error) throw error;
      message.success('Đã xóa máy');
      onRefresh?.();
      onClose();
    } catch (err: any) {
      console.error('Error deleting machine:', err.message || err);
      message.error(`Lỗi khi xóa: ${err.message || 'Không xác định'}`);
    } finally {
      setDeleting(false);
    }
  };

  const logColumns = [
    { 
      title: 'Ngày', 
      dataIndex: 'created_at', 
      key: 'date',
      render: (d: string) => dayjs(d).format('DD/MM/YYYY')
    },
    { 
      title: 'Loại', 
      dataIndex: 'type', 
      key: 'type',
      render: (t: string) => (
        <Tag color={t === 'repair' ? 'red' : 'blue'}>
          {t === 'repair' ? 'SỬA CHỮA' : 'BẢO DƯỠNG'}
        </Tag>
      )
    },
    { 
      title: 'Mô tả', 
      dataIndex: 'description', 
      key: 'description',
      ellipsis: true
    },
    { 
      title: 'Chi phí', 
      dataIndex: 'cost', 
      key: 'cost',
      align: 'right' as const,
      render: (c: number) => c ? `${c.toLocaleString()} đ` : '---'
    },
  ];

  const tabItems = [
    {
      key: '1',
      label: <span><InfoCircleOutlined /> Thông tin máy</span>,
      children: (
        <div className="p-4">
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item name="code" label="Mã máy" rules={[{ required: true }]}>
                  <Input placeholder="VD: KM-01" disabled={!!machine} />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item name="name" label="Tên máy" rules={[{ required: true }]}>
                  <Input placeholder="VD: Konica 6120" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="type" label="Loại máy" rules={[{ required: true }]}>
                  <Select>
                    <Option value="Digital">Digital (In kỹ thuật số)</Option>
                    <Option value="Offset">Offset (In offset)</Option>
                    <Option value="Processing">Processing (Gia công)</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="department_id" label="Bộ phận" rules={[{ required: true }]}>
                  <Select placeholder="Chọn bộ phận">
                    {departments.map(d => (
                      <Option key={d.id} value={d.id}>{d.name}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="status" label="Trạng thái">
                  <Select>
                    <Option value="active">Hoạt động</Option>
                    <Option value="maintenance">Đang bảo trì</Option>
                    <Option value="inactive">Ngưng hoạt động</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Divider />
            <div className="flex justify-between mt-4">
              {machine ? (
                <Popconfirm
                  title="Xóa máy này?"
                  onConfirm={handleDelete}
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true, loading: deleting }}
                >
                  <Button danger icon={<DeleteOutlined />}>Xóa Máy</Button>
                </Popconfirm>
              ) : <div />}
              <Space>
                <Button onClick={onClose}>Hủy</Button>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                  {machine ? 'Lưu thay đổi' : 'Tạo mới'}
                </Button>
              </Space>
            </div>
          </Form>
        </div>
      ),
    },
    {
      key: '2',
      label: <span><HistoryOutlined /> Lịch sử bảo trì</span>,
      disabled: !machine,
      children: (
        <div className="p-4">
          <Table 
            columns={logColumns} 
            dataSource={maintenanceLogs} 
            rowKey="id" 
            loading={loadingLogs}
            pagination={{ pageSize: 5 }}
            size="small"
            locale={{ emptyText: <Empty description="Chưa có lịch sử bảo trì" /> }}
          />
        </div>
      ),
    },
    {
      key: '3',
      label: <span><DashboardOutlined /> Thông số kỹ thuật</span>,
      disabled: !machine,
      children: (
        <div className="p-4">
          <Descriptions title="Thông số máy" bordered column={2}>
            <Descriptions.Item label="Mã máy">{machine?.code}</Descriptions.Item>
            <Descriptions.Item label="Tên máy">{machine?.name}</Descriptions.Item>
            <Descriptions.Item label="Loại">{machine?.type}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={machine?.status === 'active' ? 'green' : machine?.status === 'maintenance' ? 'orange' : 'red'}>
                {machine?.status === 'active' ? 'Hoạt động' : machine?.status === 'maintenance' ? 'Bảo trì' : 'Ngưng'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </div>
      ),
    },
  ];

  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><ToolOutlined /></div>
          <div>
            <div className="text-lg font-black text-slate-900 leading-tight uppercase">{machine ? 'CHI TIẾT MÁY MÓC' : 'THÊM MÁY MỚI'}</div>
            <Text className="premium-label text-slate-400">Equipment Configuration</Text>
          </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
      centered
      className="premium-modal no-padding-body"
    >
      <div className="p-0">
        <Tabs defaultActiveKey="1" items={tabItems} destroyOnHidden centered className="premium-tabs-layout" />
      </div>
    </Modal>
  );
}
