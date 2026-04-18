'use client';

import React, { useState, useEffect } from 'react';
import { 
  Modal, Tabs, Form, Input, Select, Button, Table, 
  Typography, Space, Row, Col, Tag, message, 
  Divider, Card, Empty, Popconfirm, Switch, List, Badge, InputNumber
} from 'antd';
import { 
  SaveOutlined, 
  DeleteOutlined,
  InfoCircleOutlined,
  ApartmentOutlined,
  PlusOutlined,
  DragOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';

const { Text, Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface WorkflowDetailModalProps {
  visible: boolean;
  workflow: any;
  departments: any[];
  onClose: () => void;
  onRefresh?: () => void;
}

export default function WorkflowDetailModal({ visible, workflow, departments, onClose, onRefresh }: WorkflowDetailModalProps) {
  const [form] = Form.useForm();
  const [steps, setSteps] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (visible && workflow) {
      form.setFieldsValue({
        name: workflow.name,
        description: workflow.description,
        is_active: workflow.is_active !== false,
      });
      setSteps(workflow.steps || []);
    } else if (visible) {
      form.resetFields();
      setSteps([]);
    }
  }, [visible, workflow, form]);

  const addStep = () => {
    setSteps([...steps, { department_id: null, sequence: steps.length + 1 }]);
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, sequence: i + 1 }));
    setSteps(newSteps);
  };

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      const workflowData = {
        name: values.name,
        description: values.description,
        is_active: values.is_active,
        steps: steps.map((s, i) => ({
          department_id: s.department_id,
          sequence: i + 1,
        })),
      };

      if (workflow) {
        const { error } = await supabase
          .from('workflow_templates')
          .update(workflowData)
          .eq('id', workflow.id);
        if (error) throw error;
        message.success('Đã cập nhật quy trình');
      } else {
        const { error } = await supabase
          .from('workflow_templates')
          .insert([workflowData]);
        if (error) throw error;
        message.success('Đã thêm quy trình mới');
      }
      onRefresh?.();
      onClose();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi lưu thông tin');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('workflow_templates')
        .delete()
        .eq('id', workflow.id);
      if (error) throw error;
      message.success('Đã xóa quy trình');
      onRefresh?.();
      onClose();
    } catch (err) {
      message.error('Lỗi khi xóa quy trình');
    } finally {
      setDeleting(false);
    }
  };

  const tabItems = [
    {
      key: '1',
      label: <span><InfoCircleOutlined /> Thông tin chung</span>,
      children: (
        <div className="p-4">
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item name="name" label="Tên quy trình" rules={[{ required: true }]}>
                  <Input placeholder="VD: In Offset Chuẩn" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="is_active" label="Trạng thái" valuePropName="checked">
                  <Switch checkedChildren="Hoạt động" unCheckedChildren="Tạm dừng" />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="description" label="Mô tả">
                  <TextArea rows={2} placeholder="Mô tả ngắn gọn về quy trình này" />
                </Form.Item>
              </Col>
            </Row>
            <Divider />
            <div className="flex justify-between mt-4">
              {workflow ? (
                <Popconfirm
                  title="Xóa quy trình này?"
                  onConfirm={handleDelete}
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true, loading: deleting }}
                >
                  <Button danger icon={<DeleteOutlined />}>Xóa Quy trình</Button>
                </Popconfirm>
              ) : <div />}
              <Space>
                <Button onClick={onClose}>Hủy</Button>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                  {workflow ? 'Lưu thay đổi' : 'Tạo mới'}
                </Button>
              </Space>
            </div>
          </Form>
        </div>
      ),
    },
    {
      key: '2',
      label: <span><ApartmentOutlined /> Các bước ({steps.length})</span>,
      disabled: !workflow && steps.length === 0,
      children: (
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <Text strong>Cấu hình các bước trong quy trình</Text>
            <Button type="dashed" icon={<PlusOutlined />} onClick={addStep}>Thêm bước</Button>
          </div>
          
          {steps.length === 0 ? (
            <Empty description="Chưa có bước nào. Nhấn 'Thêm bước' để bắt đầu." />
          ) : (
            <List
              dataSource={steps}
              renderItem={(step, index) => (
                <List.Item className="bg-gray-50 mb-2 p-3 rounded-lg">
                  <div className="flex items-center w-full gap-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold">
                      {index + 1}
                    </div>
                    <Select
                      className="flex-1"
                      placeholder="Chọn bộ phận"
                      value={step.department_id}
                      onChange={(v) => updateStep(index, 'department_id', v)}
                    >
                      {departments.map(d => (
                        <Option key={d.id} value={d.id}>{d.name} ({d.code})</Option>
                      ))}
                    </Select>
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeStep(index)} />
                  </div>
                </List.Item>
              )}
            />
          )}
          
          {steps.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <Text type="secondary">
                <CheckCircleOutlined className="mr-2" />
                Quy trình sẽ đi qua {steps.length} bước theo thứ tự từ trên xuống
              </Text>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><ApartmentOutlined /></div>
          <div>
            <div className="text-lg font-black text-slate-900 leading-tight uppercase">{workflow ? 'CẤU HÌNH QUY TRÌNH' : 'THÊM QUY TRÌNH MỚI'}</div>
            <Text className="premium-label text-slate-400">Workflow Definition</Text>
          </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      centered
      className="premium-modal no-padding-body"
    >
      <div className="p-0">
        <Tabs defaultActiveKey="1" items={tabItems} destroyOnHidden centered className="premium-tabs-layout" />
      </div>
    </Modal>
  );
}
