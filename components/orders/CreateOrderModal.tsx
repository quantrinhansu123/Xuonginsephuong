'use client';

import React, { useState, useEffect } from 'react';
import { 
  Modal, Form, Input, Select, InputNumber, Checkbox, 
  Row, Col, Divider, Space, Button, message, Typography, Alert, Spin 
} from 'antd';
import { ShoppingCartOutlined, NodeIndexOutlined, DollarOutlined, WarningOutlined } from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import { validateWorkflow, getWorkflowTemplates, clearCache } from '@/lib/auth';

const { Option } = Select;
const { Title, Text } = Typography;

interface CreateOrderModalProps {
  visible: boolean;
  onClose: () => void;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  department_sequence: number[];
}

export default function CreateOrderModal({ visible, onClose }: CreateOrderModalProps) {
  const [form] = Form.useForm();
  const [customers, setCustomers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<number[] | null>(null);
  const [workflowError, setWorkflowError] = useState<string>('');

  useEffect(() => {
    if (visible) {
      fetchData();
    }
  }, [visible]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch customers
      const { data: custData, error: custError } = await supabase
        .from('customers')
        .select('id, name, code');
      if (custError) throw custError;
      setCustomers(custData || []);

      // Fetch departments
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .order('id', { ascending: true });
      if (deptError) throw deptError;
      setDepartments(deptData || []);

      // Fetch workflow templates from database
      const templates = await getWorkflowTemplates();
      setWorkflowTemplates(templates);

    } catch (err) {
      console.error(err);
      message.error('Lỗi khi tải dữ liệu khởi tạo');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkflowSelect = (workflowSteps: number[]) => {
    setSelectedWorkflow(workflowSteps);
    form.setFieldsValue({ workflow_steps: workflowSteps });
    setWorkflowError('');
  };

  const onFinish = async (values: any) => {
    // Validate workflow
    const validation = validateWorkflow(values.workflow_steps);
    if (!validation.valid) {
      setWorkflowError(validation.error || 'Quy trình không hợp lệ');
      return;
    }

    setSubmitting(true);
    try {
      const orderCode = `LSX${Date.now().toString().slice(-6)}`;
      
      const orderData = {
        code: orderCode,
        customer_id: values.customer_id,
        title: values.title,
        specs: {
          quantity: values.quantity,
          unit: values.unit,
          size: values.size,
          sides: values.sides,
          paper_type: values.paper_type,
        },
        financials: {
          unit_price: values.unit_price,
          vat: values.vat,
          total: values.quantity * values.unit_price * (1 + (values.vat / 100)),
          total_with_vat: values.quantity * values.unit_price * (1 + (values.vat / 100)),
          received: 0,
        },
        status: 'in_progress',
        workflow_steps: values.workflow_steps,
      };

      const { data: order, error: orderError } = await supabase
        .from('production_orders')
        .insert([orderData])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create tasks for each department in sequence
      const tasksToCreate = values.workflow_steps.map((deptId: number, index: number) => ({
        order_id: (order as any).id,
        department_id: deptId,
        sequence_order: index + 1,
        status: index === 0 ? 'ready' : 'pending',
        ready_at: index === 0 ? new Date().toISOString() : null,
      }));

      const { error: tasksError } = await supabase.from('tasks').insert(tasksToCreate);
      if (tasksError) throw tasksError;

      message.success(`Đã tạo lệnh sản xuất ${orderCode}`);
      form.resetFields();
      setSelectedWorkflow(null);
      setWorkflowError('');
      onClose();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi tạo lệnh sản xuất');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setSelectedWorkflow(null);
    setWorkflowError('');
    onClose();
  };

  // Get department name by ID
  const getDeptName = (deptId: number) => {
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || `ID: ${deptId}`;
  };

  // Format workflow template for display
  const formatWorkflowSteps = (steps: number[]) => {
    return steps.map(id => getDeptName(id)).join(' → ');
  };

  return (
    <Modal
      title={<><ShoppingCartOutlined /> Tạo Lệnh Sản Xuất Mới</>}
      open={visible}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={900}
      okText="Tạo Lệnh"
      cancelText="Hủy"
      wrapClassName="designer-modal"
    >
      <Spin spinning={loading} description="Đang tải dữ liệu...">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ quantity: 1, unit_price: 0, vat: 8, unit: 'Bộ', workflow_steps: [] }}
        >
          <Divider orientation={"left" as any} plain className="ui-section-title">Thông tin chung</Divider>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="customer_id" label="Khách hàng" rules={[{ required: true }]}>
                <Select showSearch placeholder="Chọn khách hàng" optionFilterProp="children">
                  {customers.map((c: any) => (
                    <Option key={c.id} value={c.id}>{c.name} ({c.code})</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="title" label="Nội dung in" rules={[{ required: true }]}>
                <Input placeholder="Ví dụ: In Card Visit" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="quantity" label="Số lượng" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="unit" label="Đơn vị">
                <Input placeholder="Cuốn, Bộ..." />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="size" label="Khổ giấy">
                <Select placeholder="Chọn khổ">
                  <Option value="A3">A3</Option>
                  <Option value="A4">A4</Option>
                  <Option value="A5">A5</Option>
                  <Option value="A6">A6</Option>
                  <Option value="Custom">Khác</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="sides" label="Mặt in">
                <Select>
                  <Option value={1}>In 1 mặt</Option>
                  <Option value={2}>In 2 mặt</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="paper_type" label="Loại giấy">
                <Select placeholder="Chọn loại giấy">
                  <Option value="C150">C150 (Couche 150g)</Option>
                  <Option value="C200">C200 (Couche 200g)</Option>
                  <Option value="C250">C250 (Couche 250g)</Option>
                  <Option value="C300">C300 (Couche 300g)</Option>
                  <Option value="Ford70">Ford 70g</Option>
                  <Option value="Ford80">Ford 80g</Option>
                  <Option value="Bristol">Bristol</Option>
                  <Option value="Kraft">Kraft</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation={"left" as any} plain className="ui-section-title"><NodeIndexOutlined /> Quy trình sản xuất (Workflow)</Divider>
          
          <Alert 
            message="Chọn quy trình sản xuất theo thứ tự" 
            description="Mỗi bộ phận sẽ nhận việc khi bộ phận trước hoàn thành. Chọn một quy trình mẫu hoặc tự chọn các bộ phận."
            type="info" 
            showIcon 
            className="mb-4"
          />

          {workflowTemplates.length > 0 && (
            <div className="mb-4">
              <Text strong>Quy trình mẫu:</Text>
              <div className="flex flex-wrap gap-2 mt-2">
                {workflowTemplates.map((wf) => (
                  <Button
                    key={wf.id}
                    size="small"
                    type={selectedWorkflow?.join(',') === wf.department_sequence.join(',') ? 'primary' : 'default'}
                    onClick={() => handleWorkflowSelect(wf.department_sequence)}
                    title={wf.description}
                  >
                    {wf.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Form.Item 
            name="workflow_steps" 
            label="Hoặc tự chọn bộ phận (theo thứ tự)" 
            rules={[{ required: true, message: 'Vui lòng chọn quy trình sản xuất' }]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Row>
                {departments.map(dept => (
                  <Col span={8} key={dept.id} className="mb-2">
                    <Checkbox value={dept.id}>
                      {dept.name} 
                      {dept.is_entry_point && <Text type="success" className="ml-1 text-xs">(Đầu vào)</Text>}
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>

          {workflowError && (
            <Alert 
              message={workflowError} 
              type="error" 
              showIcon 
              icon={<WarningOutlined />}
              className="mb-4"
            />
          )}

          <Divider orientation={"left" as any} plain className="ui-section-title"><DollarOutlined /> Tài chính</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="unit_price" label="Đơn giá (VNĐ)">
                <InputNumber min={0} style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="vat" label="VAT (%)">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <div className="ui-surface p-4 flex flex-col items-end">
                <Text type="secondary">Tạm tính:</Text>
                <Form.Item shouldUpdate noStyle>
                  {({ getFieldsValue }) => {
                    const { quantity, unit_price, vat } = getFieldsValue();
                    const total = (quantity || 0) * (unit_price || 0) * (1 + ((vat || 0) / 100));
                    return <Title level={4} className="m-0 text-blue-600">{total.toLocaleString()} VNĐ</Title>;
                  }}
                </Form.Item>
              </div>
            </Col>
          </Row>
        </Form>
      </Spin>
    </Modal>
  );
}
