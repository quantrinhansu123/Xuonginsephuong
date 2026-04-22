'use client';

import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Layout } from 'antd';
import { UserOutlined, LockOutlined, PrinterOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { setUser } from '../../lib/auth';
import bcrypt from 'bcryptjs';

const { Title, Text } = Typography;
const { Content } = Layout;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // Fetch user from DB with role and department info
      const { data: user, error } = await supabase
        .from('users')
        .select(`
          *,
          roles (id, name, portal),
          departments (id, name, code)
        `)
        .eq('username', values.username)
        .single();

      if (error || !user) {
        message.error('Username không tồn tại');
        setLoading(false);
        return;
      }

      // Check password (support both plain text and hashed)
      let isMatch = false;
      if (values.password === user.password) {
        isMatch = true;
      } else {
        try {
          isMatch = await bcrypt.compare(values.password, user.password);
        } catch (e) {
          isMatch = false;
        }
      }

      if (!isMatch) {
        message.error('Mật khẩu không chính xác');
        setLoading(false);
        return;
      }

      // Create session user object
      const sessionUser = {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.roles,
        department: user.departments,
        department_id: user.department_id,
      };
      
      // Use auth helper to set user
      setUser(sessionUser);
      message.success('Đăng nhập thành công!');

      // Redirect based on portal
      if (user.roles?.portal === 'management') {
        router.push('/management/dashboard');
      } else {
        router.push('/operation/tasks');
      }
    } catch (err) {
      console.error(err);
      message.error('Có lỗi xảy ra khi đăng nhập');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
      <Content className="flex items-center justify-center p-4">
        <Card className="w-full max-w-[400px] shadow-lg rounded-xl">
          <div className="text-center mb-8">
            <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-blue-200 shadow-lg">
              <PrinterOutlined className="text-white text-3xl" />
            </div>
            <Title level={2} className="m-0">In Hoà Phát</Title>
            <Text type="secondary">Hệ thống quản lý sản xuất in ấn</Text>
          </div>

          <Form
            name="login"
            initialValues={{ remember: true }}
            onFinish={onFinish}
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: 'Vui lòng nhập username!' }]}
            >
              <Input 
                prefix={<UserOutlined className="text-gray-400" />} 
                placeholder="Username" 
                className="rounded-lg"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="Mật khẩu"
                className="rounded-lg"
              />
            </Form.Item>

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                block 
                loading={loading}
                className="h-12 text-lg font-medium rounded-lg"
              >
                Đăng nhập
              </Button>
            </Form.Item>
          </Form>
          
          <div className="text-center mt-4">
            <Text type="secondary" className="text-xs">
              Sử dụng tài khoản đã được cấp bởi Quản trị viên
            </Text>
          </div>
        </Card>
      </Content>
    </Layout>
  );
}
