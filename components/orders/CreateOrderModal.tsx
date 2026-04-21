'use client';

import React, { useState, useEffect } from 'react';
import { 
  Modal, Form, Input, Select, InputNumber, Checkbox, Tabs, DatePicker,
  Row, Col, Divider, Space, Button, message, Typography, Alert, Spin, Tag, TreeSelect
} from 'antd';
import { supabase } from '@/lib/supabase';
import { validateWorkflow, getWorkflowTemplates, clearCache } from '@/lib/auth';
import dayjs from 'dayjs';

const { Option } = Select;
const { Title, Text } = Typography;

import { 
  CloseOutlined, 
  OrderedListOutlined,
  PlusCircleOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  NodeIndexOutlined,
  LeftOutlined,
  RightOutlined,
  PlusOutlined,
  ShoppingCartOutlined
} from '@ant-design/icons';

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

interface WorkflowStepConfig {
  deptId: number;
  duration: number;
  material_name?: string;
  material_requested_qty?: number;
}

export default function CreateOrderModal({ visible, onClose, customerId }: CreateOrderModalProps) {
  const [form] = Form.useForm();
  const [stepSetupForm] = Form.useForm();
  const [customers, setCustomers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSteps, setSelectedSteps] = useState<WorkflowStepConfig[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [workflowError, setWorkflowError] = useState<string>('');
  const [activeTab, setActiveTab] = useState('1');
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [stepSetupVisible, setStepSetupVisible] = useState(false);

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

      const { data: materialData, error: materialError } = await supabase
        .from('materials')
        .select('id, name, unit, stock_quantity')
        .order('name', { ascending: true });
      if (materialError) throw materialError;
      setMaterials(materialData || []);

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
      duration: 60, // Default 60 minutes
      material_name: '',
      material_requested_qty: 0,
    }));
    setSelectedSteps(stepsWithDuration);
    form.setFieldsValue({ workflow_steps: stepsWithDuration });
    setWorkflowError('');
  };

  const handleDepartmentCheckboxChange = (checkedValues: any) => {
    const deptIds = Array.from(
      new Set(
        (Array.isArray(checkedValues) ? checkedValues : [checkedValues])
          .map((value: string | number) => Number(value))
          .filter((value: number) => Number.isFinite(value))
      )
    );

    const newSteps = deptIds.map((deptId: number) => {
      const existing = selectedSteps.find((step: any) => step.deptId === deptId);
      return existing || { deptId, duration: 60, material_name: '', material_requested_qty: 0 };
    });

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

  const openStepSetup = (index: number) => {
    const step = selectedSteps[index];
    if (!step) return;
    setEditingStepIndex(index);
    stepSetupForm.setFieldsValue({
      duration: step.duration ?? 60,
      material_name: step.material_name || '',
      material_requested_qty: step.material_requested_qty ?? 0,
    });
    setStepSetupVisible(true);
  };

  const submitStepSetup = async () => {
    try {
      const values = await stepSetupForm.validateFields();
      if (editingStepIndex === null) return;

      const nextSteps = [...selectedSteps];
      nextSteps[editingStepIndex] = {
        ...nextSteps[editingStepIndex],
        duration: Number(values.duration || 0),
        material_name: values.material_name?.trim() || '',
        material_requested_qty: Number(values.material_requested_qty || 0),
      };

      setSelectedSteps(nextSteps);
      form.setFieldsValue({ workflow_steps: nextSteps });
      setStepSetupVisible(false);
      setEditingStepIndex(null);
      message.success('Đã lưu cấu hình bước');
    } catch (error) {
      // Validation handled by form
    }
  };

  const handleNext = async () => {
    try {
      // Validate current tab fields if necessary
      if (activeTab === '1') {
        await form.validateFields(['customer_id', 'title', 'quantity', 'main_material_id', 'deadline']);
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
      const rawDeadline = values.deadline ?? form.getFieldValue('deadline');
      const deadlineIso = rawDeadline && dayjs(rawDeadline).isValid()
        ? dayjs(rawDeadline).endOf('day').toISOString()
        : null;
      const selectedMainMaterial = materials.find((m: any) => m.id === values.main_material_id);
      
      const orderData = {
        code: orderCode,
        customer_id: values.customer_id,
        title: values.title,
        deadline: deadlineIso,
        specs: {
          quantity: values.quantity,
          unit: values.unit,
          size: values.size,
          sides: values.sides,
          main_material_id: values.main_material_id || null,
          main_material_name: selectedMainMaterial?.name || null,
          main_material_unit: selectedMainMaterial?.unit || null,
          paper_type: selectedMainMaterial?.name || null,
          estimated_pages: calculateEstimatedPages(values.quantity, values.size, values.sides),
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

      // Ensure deadline is persisted on main order row even if payload normalization differs.
      if (deadlineIso) {
        const { error: deadlineUpdateError } = await supabase
          .from('production_orders')
          .update({ deadline: deadlineIso })
          .eq('id', (order as any).id);
        if (deadlineUpdateError) {
          console.error('Deadline update failed:', deadlineUpdateError);
        }
      }

      // Create tasks for each department in sequence
      const tasksToCreate = values.workflow_steps.map((step: any, index: number) => ({
        order_id: (order as any).id,
        department_id: step.deptId,
        sequence_order: index + 1,
        status: index === 0 ? 'ready' : 'pending',
        ready_at: index === 0 ? new Date().toISOString() : null,
        estimated_duration_seconds: (step.duration || 60) * 60,
        material_requested_qty: step.material_requested_qty || 0,
        processing_info: {
          material_name: step.material_name || null,
          setup_note: 'Cấu hình từ màn tạo lệnh',
        },
      }));

      const { error: tasksError } = await supabase.from('tasks').insert(tasksToCreate);
      if (tasksError) throw tasksError;

      message.success(`Đã tạo lệnh sản xuất ${orderCode}`);
      form.resetFields();
      setSelectedSteps([]);
      setSelectedTemplateIds([]);
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
    setSelectedTemplateIds([]);
    setStepSetupVisible(false);
    setEditingStepIndex(null);
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

  const getA4EquivalentFactor = (size?: string) => {
    const normalized = (size || 'A4').toUpperCase();
    const map: Record<string, number> = {
      A6: 0.25,
      A5: 0.5,
      A4: 1,
      A3: 2,
    };
    return map[normalized] ?? 1;
  };

  const calculateEstimatedPages = (quantity?: number, size?: string, sides?: number) => {
    const qty = Number(quantity || 0);
    if (!qty) return 0;

    const sideCount = Number(sides || 1);
    const sizeFactor = getA4EquivalentFactor(size);
    const estimated = (qty * sizeFactor) / (sideCount === 2 ? 2 : 1);

    // Luon lam tron len de du tru du trang in thuc te.
    return Math.ceil(estimated);
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
                        <Form.Item
                          name="main_material_id"
                          label="Nguyên liệu chính (lấy từ kho)"
                          rules={[{ required: true, message: 'Vui lòng chọn nguyên liệu chính từ kho' }]}
                        >
                          <Select
                            showSearch
                            optionFilterProp="label"
                            placeholder="Chọn nguyên liệu chính từ kho"
                            options={materials.map((m: any) => ({
                              value: m.id,
                              label: `${m.name} (Tồn: ${Number(m.stock_quantity || 0).toLocaleString()} ${m.unit || ''})`,
                            }))}
                          />
                        </Form.Item>
                        <Form.Item name="paper_type" hidden>
                          <Input />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="deadline"
                          label="Deadline"
                          rules={[{ required: true, message: 'Vui lòng chọn deadline' }]}
                        >
                          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Chọn ngày deadline" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Form.Item shouldUpdate noStyle>
                      {({ getFieldsValue }) => {
                        const { quantity, size, sides } = getFieldsValue(['quantity', 'size', 'sides']);
                        const estimatedPages = calculateEstimatedPages(quantity, size, sides);
                        return (
                          <div className="mt-1 mb-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <Text className="text-xs font-semibold text-indigo-700">
                                So trang du kien (quy doi A4)
                              </Text>
                              <Tag className="m-0 border-none bg-white text-indigo-700 font-bold text-sm px-3 py-1 rounded-lg">
                                {estimatedPages.toLocaleString()} trang
                              </Tag>
                            </div>
                            <Text className="text-[11px] text-indigo-500 block mt-1">
                              Logic: A4 1 mat giu nguyen, 2 mat chia 2, A3 nhan 2 theo chuan A4.
                            </Text>
                          </div>
                        );
                      }}
                    </Form.Item>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {selectedSteps.map((step, index) => (
                            <div
                              key={`${step.deptId}-${index}`}
                              className="rounded-2xl border border-indigo-100 bg-white p-3 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
                              onClick={() => openStepSetup(index)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">
                                    {index + 1}
                                  </span>
                                  <Text className="font-bold text-slate-700">{getDeptName(step.deptId)}</Text>
                                </div>
                                <Button
                                  type="text"
                                  size="small"
                                  danger
                                  icon={<CloseOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveStep(index);
                                  }}
                                  className="!px-1"
                                />
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Tag className="m-0 border-none bg-indigo-50 text-indigo-700 font-semibold">
                                  <ClockCircleOutlined /> {step.duration || 0} phút
                                </Tag>
                                <Tag className="m-0 border-none bg-amber-50 text-amber-700 font-semibold">
                                  NL: {step.material_name?.trim() ? step.material_name : 'Chưa chọn'}
                                </Tag>
                                <Tag className="m-0 border-none bg-slate-100 text-slate-700 font-semibold">
                                  SL NL: {step.material_requested_qty || 0}
                                </Tag>
                              </div>

                              <div className="mt-3 flex items-center justify-between">
                                <Button
                                  size="small"
                                  icon={<LeftOutlined />}
                                  disabled={index === 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReorder(index, index - 1);
                                  }}
                                >
                                  Lùi
                                </Button>
                                <Button
                                  size="small"
                                  type="primary"
                                  icon={<PlusCircleOutlined />}
                                  className="bg-indigo-600 border-none"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openStepSetup(index);
                                  }}
                                >
                                  Thiết lập
                                </Button>
                                <Button
                                  size="small"
                                  icon={<RightOutlined />}
                                  disabled={index === selectedSteps.length - 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReorder(index, index + 1);
                                  }}
                                >
                                  Tiến
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-slate-400 italic text-sm">
                          Bấm vào các bộ phận bên dưới để xây dựng quy trình...
                        </div>
                      )}
                    </div>

                    <div className="mb-6">
                      <Text strong className="block mb-3 text-slate-600 text-sm">Chọn nhanh quy trình mẫu:</Text>
                      <TreeSelect
                        style={{ width: '100%' }}
                        treeCheckable
                        maxTagCount={1}
                        value={selectedTemplateIds}
                        placeholder="Sổ xuống để chọn quy trình mẫu (checkbox)"
                        treeData={workflowTemplates.map((wf) => ({
                          value: wf.id,
                          title: wf.name,
                        }))}
                        onChange={(values) => {
                          const selected = Array.isArray(values) ? values : [];
                          const latest = String(selected[selected.length - 1] || '');
                          const normalized = latest ? [latest] : [];
                          setSelectedTemplateIds(normalized);
                          const template = workflowTemplates.find((wf) => wf.id === latest);
                          if (template) {
                            handleWorkflowSelect(template.department_sequence || []);
                          }
                        }}
                      />
                    </div>

                    <div className="mb-4">
                      <Text strong className="block mb-3 text-slate-600 text-sm">Thêm bộ phận lẻ vào quy trình:</Text>
                      <TreeSelect
                        style={{ width: '100%' }}
                        treeCheckable
                        showCheckedStrategy={TreeSelect.SHOW_ALL}
                        value={Array.from(new Set(selectedSteps.map((step: any) => String(step.deptId))))}
                        placeholder="Sổ xuống để tick chọn bộ phận"
                        treeData={departments.map((dept) => ({
                          value: String(dept.id),
                          title: dept.name,
                        }))}
                        onChange={handleDepartmentCheckboxChange}
                      />
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

          <Modal
            title={`Thiết lập bước ${editingStepIndex !== null ? editingStepIndex + 1 : ''}`}
            open={stepSetupVisible}
            onCancel={() => {
              setStepSetupVisible(false);
              setEditingStepIndex(null);
            }}
            onOk={submitStepSetup}
            okText="Lưu thiết lập"
            cancelText="Hủy"
            destroyOnHidden
          >
            <Form form={stepSetupForm} layout="vertical">
              <Form.Item
                name="duration"
                label="Thời gian dự kiến (phút)"
                rules={[{ required: true, message: 'Nhập thời gian dự kiến' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} placeholder="Ví dụ: 60" />
              </Form.Item>
              <Form.Item name="material_name" label="Nguyên liệu chính">
                <Input placeholder="Ví dụ: Giấy C300, Mực offset..." />
              </Form.Item>
              <Form.Item name="material_requested_qty" label="Số lượng nguyên liệu">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="Ví dụ: 500" />
              </Form.Item>
            </Form>
          </Modal>
        </Form>
      </Spin>
    </Modal>
  );
}
