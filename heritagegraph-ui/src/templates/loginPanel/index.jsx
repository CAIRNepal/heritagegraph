import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message, Row, Col, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Handle login form submit
  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const response = await axios.post('http://127.0.0.1:8000/api/token/', {
        username: values.username,
        password: values.password,
      });

      const { access, refresh } = response.data;

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);

      message.success('Login successful!');
      navigate('/contribution'); // change this to your desired landing page

    } catch (error) {
      console.error('Login error:', error);
      message.error('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', background: '#f0f2f5' }}>
      <Row justify="center" style={{ width: '100%' }}>
        <Col xs={22} sm={16} md={12} lg={8} xl={6}>
          <Card
            bordered
            style={{
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              background: '#ffffff',
            }}
          >
            <Title level={3} style={{ textAlign: 'center' }}>Login to Your Account</Title>
            <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
              Welcome back! Please enter your credentials.
            </Text>

            <Form layout="vertical" onFinish={handleSubmit}>
              <Form.Item
                label="Username"
                name="username"
                rules={[{ required: true, message: 'Please enter your username' }]}
              >
                <Input prefix={<UserOutlined />} placeholder="Enter your username" />
              </Form.Item>

              <Form.Item
                label="Password"
                name="password"
                rules={[{ required: true, message: 'Please enter your password' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Enter your password" />
              </Form.Item>

              <div className="flex justify-between mb-4">
                <Link to="/auth/password/reset-password">
                  <Text type="secondary">Forgot password?</Text>
                </Link>
              </div>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  size="large"
                  loading={loading}
                >
                  Log In
                </Button>
              </Form.Item>

              <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
                Don’t have an account?{' '}
                <Link to="/signup">
                  Create one
                </Link>
              </Text>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Login;
