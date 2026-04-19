'use client';

import React, { useState, useEffect } from 'react';
import { 
  Modal, Form, Input, Select, InputNumber, Checkbox, Tabs,
  Row, Col, Divider, Space, Button, message, Typography, Alert, Spin, Tag 
} from 'antd';
import { supabase } from '@/lib/supabase';
import { validateWorkflow, getWorkflowTemplates, clearCache } from '@/lib/auth';

const { Option } = Select;
const { Title, Text } = Typography;

import { 
  ArrowRightOutlined, 
  CloseOutlined, 
  OrderedListOutlined,
  PlusCircleOutlined,
  DoubleRightOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  NodeIndexOutlined,
  LeftOutlined,
  RightOutlined,
  PlusOutlined,
  WarningOutlined,
  ShoppingCartOutlined,
  HolderOutlined,
  SwapOutlined
} from '@ant-design/icons';
import { Dropdown, type MenuProps } from 'antd';

interface CreateOrderModalProps {
  visible: boolean;
  onClose: () => void;
  customerId?: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  department_sequence: number[];
}

export default function CreateOrderModal({ visible, onClose, customerId }: CreateOrderModalProps) {
  const [form] = Form.useForm();
  const [customers, setCustomers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSteps, setSelectedSteps] = useState<any[]>([]);
  const [workflowError, setWorkflowError] = useState<string>('');
  const [activeTab, setActiveTab] = useState('1');

  useEffect(() => {
    if (visible) {
      fetchData();
      if (customerId) {
        form.setFieldsValue({ customer_id: customerId });
      }
    }
  }, [visible, customerId, form]);

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
    const stepsWithDuration = workflowSteps.map(id => ({
      deptId: id,
      duration: 60 // Default 60 minutes
    }));
    setSelectedSteps(stepsWithDuration);
    form.setFieldsValue({ workflow_steps: stepsWithDuration });
    setWorkflowError('');
  };

  const handleAddStep = (deptId: number) => {
    const newSteps = [...selectedSteps, { deptId, duration: 60 }];
    setSelectedSteps(newSteps);
    form.setFieldsValue({ workflow_steps: newSteps });
    setWorkflowError('');
  };

  const handleRemoveStep = (index: number) => {
    const newSteps = selectedSteps.filter((_, i) => i !== index);
    setSelectedSteps(newSteps);
    form.setFieldsValue({ workflow_steps: newSteps });
  };

  const handleReorder = (dragIndex: number, dropIndex: number) => {
    if (dragIndex === dropIndex) return;
    const newSteps = [...selectedSteps];
    const [removed] = newSteps.splice(dragIndex, 1);
    newSteps.splice(dropIndex, 0, removed);
    setSelectedSteps(newSteps);
    form.setFieldsValue({ workflow_steps: newSteps });
  };

  const handleReplaceStep = (index: number, newDeptId: number) => {
    const newSteps = [...selectedSteps];
    newSteps[index] = { ...newSteps[index], deptId: newDeptId };
    setSelectedSteps(newSteps);
    form.setFieldsValue({ workflow_steps: newSteps });
  };

  const handleUpdateDuration = (index: number, duration: number | null) => {
    const newSteps = [...selectedSteps];
    newSteps[index] = { ...newSteps[index], duration: duration || 0 };
    setSelectedSteps(newSteps);
    form.setFieldsValue({ workflow_steps: newSteps });
  };

  const handleNext = async () => {
    try {
      // Validate current tab fields if necessary
      if (activeTab === '1') {
        await form.validateFields(['customer_id', 'title', 'quantity']);
        setActiveTab('2');
      } else if (activeTab === '2') {
        if (selectedSteps.length === 0) {
          setWorkflowError('Vui lòng chọn ít nhất một bộ phận sản xuất');
          return;
        }
        setActiveTab('3');
      }
    } catch (err) {
      console.error('Validation failed:', err);
    }
  };

  const handleBack = () => {
    const prev = (parseInt(activeTab) - 1).toString();
    setActiveTab(prev);
  };

  const onFinish = async (values: any) => {
    // Validate workflow
    const deptIds = values.workflow_steps.map((s: any) => s.deptId);
    const validation = validateWorkflow(deptIds);
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
        workflow_steps: values.workflow_steps.map((s: any) => s.deptId),
      };

      const { data: order, error: orderError } = await supabase
        .from('production_orders')
        .insert([orderData])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create tasks for each department in sequence
      const tasksToCreate = values.workflow_steps.map((step: any, index: number) => ({
        order_id: (order as any).id,
        department_id: step.deptId,
        sequence_order: index + 1,
        status: index === 0 ? 'ready' : 'pending',
        ready_at: index === 0 ? new Date().toISOString() : null,
        estimated_duration_seconds: (step.duration || 60) * 60,
      }));

      const { error: tasksError } = await supabase.from('tasks').insert(tasksToCreate);
      if (tasksError) throw tasksError;

      message.success(`Đã tạo lệnh sản xuất ${orderCode}`);
      form.resetFields();
      setSelectedSteps([]);
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
    setSelectedSteps([]);
    setActiveTab('1');
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
      width={900}
      footer={[
        <Button key="cancel" onClick={handleCancel} className="rounded-xl">Hủy</Button>,
        activeTab !== '1' && (
          <Button key="back" icon={<LeftOutlined />} onClick={handleBack} className="rounded-xl">
            Quay lại
          </Button>
        ),
        activeTab !== '3' ? (
          <Button key="next" type="primary" onClick={handleNext} className="rounded-xl bg-indigo-600 border-none shadow-md">
            Tiếp theo <RightOutlined />
          </Button>
        ) : (
          <Button key="submit" type="primary" onClick={() => form.submit()} loading={submitting} className="rounded-xl bg-green-600 hover:bg-green-700 border-none shadow-md shadow-green-100">
            Tạo Lệnh Sản Xuất <PlusOutlined />
          </Button>
        )
      ]}
      wrapClassName="designer-modal"
    >
      <Spin spinning={loading} description="Đang tải dữ liệu...">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ quantity: 1, unit_price: 0, vat: 8, unit: 'Bộ', workflow_steps: [] }}
        >
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            className="manual-step-tabs"
            items={[
              {
                key: '1',
                label: <span><InfoCircleOutlined /> 1. Thông số chung</span>,
                children: (
                  <div className="py-2">
                    <Row gutter={24}>
                      <Col span={16}>
                        <Form.Item name="customer_id" label="Khách hàng" rules={[{ required: true, message: 'Vui lòng chọn khách hàng' }]}>
                          <Select showSearch placeholder="Chọn khách hàng" optionFilterProp="children" className="premium-select">
                            {customers.map((c: any) => (
                              <Option key={c.id} value={c.id}>{c.name} ({c.code})</Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="title" label="Nội dung in" rules={[{ required: true, message: 'Nhập nội dung in' }]}>
                          <Input placeholder="Ví dụ: In Card Visit" className="premium-input" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={24}>
                      <Col span={6}>
                        <Form.Item name="quantity" label="Số lượng" rules={[{ required: true }]}>
                          <InputNumber min={1} style={{ width: '100%' }} className="premium-input" />
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

                    <Row gutter={24}>
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
                  </div>
                )
              },
              {
                key: '2',
                label: <span><NodeIndexOutlined /> 2. Quy trình sản xuất</span>,
                children: (
                  <div className="py-2">
                    <div className="mb-6 p-5 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <div className="flex justify-between items-center mb-4">
                        <Text strong className="text-slate-500 uppercase text-[11px] tracking-wider flex items-center gap-2">
                          <OrderedListOutlined /> Lộ trình sản xuất hiện tại
                        </Text>
                        {selectedSteps.length > 0 && (
                          <Button 
                            type="text" 
                            danger 
                            size="small" 
                            icon={<CloseOutlined />} 
                            onClick={() => { setSelectedSteps([]); form.setFieldsValue({ workflow_steps: [] }); }}
                          >
                            Xóa tất cả
                          </Button>
                        )}
                      </div>

                      {selectedSteps.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-y-3">
                      {selectedSteps.map((deptId, index) => {
                        const deptItems: MenuProps['items'] = departments.map(d => ({
                          key: d.id.toString(),
                          label: d.name,
                          onClick: () => handleReplaceStep(index, d.id)
                        }));

                        return (
                          <div 
                            key={`${deptId}-${index}`} 
                            className="flex items-center"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('dragIndex', index.toString());
                              e.currentTarget.classList.add('opacity-40');
                            }}
                            onDragEnd={(e) => {
                              e.currentTarget.classList.remove('opacity-40');
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              const dragIndex = parseInt(e.dataTransfer.getData('dragIndex'));
                              handleReorder(dragIndex, index);
                            }}
                          >
                            <div className="flex flex-col gap-1 items-center">
                              <Dropdown menu={{ items: deptItems }} trigger={['click']}>
                                <Tag 
                                  closable 
                                  onClose={(e: React.MouseEvent) => { e.preventDefault(); handleRemoveStep(index); }}
                                  className="px-3 py-2 rounded-xl border-blue-100 bg-white shadow-sm flex items-center gap-2 m-0 cursor-move hover:border-blue-300 transition-all"
                                  color="blue"
                                >
                                  <HolderOutlined className="text-slate-300 mr-1" />
                                  <span className="bg-blue-600 text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold">
                                    {index + 1}
                                  </span>
                                  <span className="font-bold text-slate-700">{getDeptName(selectedSteps[index].deptId)}</span>
                                  <SwapOutlined className="text-slate-300 ml-1 text-[10px]" />
                                </Tag>
                              </Dropdown>
                              <div className="px-2 py-0.5 bg-slate-100 rounded-lg flex items-center gap-1">
                                <ClockCircleOutlined className="text-[10px] text-slate-400" />
                                <InputNumber 
                                  size="small" 
                                  min={1} 
                                  value={selectedSteps[index].duration} 
                                  onChange={(v) => handleUpdateDuration(index, v)}
                                  className="w-16 border-none bg-transparent font-bold text-[10px]"
                                  suffix={<span className="text-[9px] text-slate-400">P</span>}
                                  controls={false}
                                />
                              </div>
                            </div>
                            {index < selectedSteps.length - 1 && (
                              <DoubleRightOutlined className="mx-2 text-slate-300 text-[10px] mb-6" />
                            )}
                          </div>
                        );
                      })}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-slate-400 italic text-sm">
                          Bấm vào các bộ phận bên dưới để xây dựng quy trình...
                        </div>
                      )}
                    </div>

                    <div className="mb-6">
                      <Text strong className="block mb-3 text-slate-600 text-sm">Chọn nhanh quy trình mẫu:</Text>
                      <div className="flex flex-wrap gap-2">
                        {workflowTemplates.map((wf) => (
                          <Button
                            key={wf.id}
                            size="small"
                            onClick={() => handleWorkflowSelect(wf.department_sequence)}
                            className="rounded-lg border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white h-9 px-4"
                          >
                            {wf.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <Text strong className="block mb-3 text-slate-600 text-sm">Thêm bộ phận lẻ vào quy trình:</Text>
                      <Space wrap>
                        {departments.map(dept => (
                          <Button 
                            key={dept.id} 
                            icon={<PlusCircleOutlined />}
                            onClick={() => handleAddStep(dept.id)}
                            className="rounded-xl hover:border-blue-500 h-9"
                          >
                            {dept.name}
                          </Button>
                        ))}
                      </Space>
                    </div>

                    <Form.Item name="workflow_steps" hidden rules={[{ required: true, message: 'Vui lòng xây dựng quy trình sản xuất' }]}>
                      <Input />
                    </Form.Item>
                  </div>
                )
              },
              {
                key: '3',
                label: <span><DollarOutlined /> 3. Tài chính</span>,
                children: (
                  <div className="py-6 bg-slate-50/50 rounded-2xl px-6 border border-slate-100">
                    <Row gutter={32} align="middle">
                      <Col span={14}>
                        <div className="space-y-6">
                          <Form.Item name="unit_price" label="Đơn giá (VNĐ)" rules={[{ required: true, message: 'Nhập đơn giá' }]}>
                            <InputNumber 
                              min={0} 
                              style={{ width: '100%' }} 
                              size="large"
                              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
                              className="premium-input-large"
                            />
                          </Form.Item>
                          <Form.Item name="vat" label="VAT (%)">
                            <InputNumber min={0} max={100} style={{ width: '100%' }} size="large" />
                          </Form.Item>
                        </div>
                      </Col>
                      <Col span={10}>
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
                          <Text type="secondary" className="uppercase text-[10px] font-bold tracking-widest mb-2">Tổng tiền thanh toán</Text>
                          <Form.Item shouldUpdate noStyle>
                            {({ getFieldsValue }) => {
                              const { quantity, unit_price, vat } = getFieldsValue();
                              const total = (quantity || 0) * (unit_price || 0) * (1 + ((vat || 0) / 100));
                              return (
                                <div className="text-center">
                                  <div className="text-3xl font-black text-indigo-600 mb-1">
                                    {total.toLocaleString()} 
                                    <span className="text-sm ml-1 uppercase font-normal text-indigo-400">đ</span>
                                  </div>
                                  <Text type="secondary" className="text-[11px]">Đã bao gồm VAT</Text>
                                </div>
                              );
                            }}
                          </Form.Item>
                        </div>
                      </Col>
                    </Row>

                    {workflowError && (
                      <Alert 
                        title={workflowError} 
                        type="error" 
                        showIcon 
                        className="mt-6"
                        action={<Button size="small" danger onClick={() => setWorkflowError('')}>Đã hiểu</Button>}
                      />
                    )}
                  </div>
                )
              }
            ]} 
          />
        </Form>
      </Spin>
    </Modal>
  );
}
