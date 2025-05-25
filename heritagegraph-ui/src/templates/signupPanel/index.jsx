import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  message,
  Row,
  Col
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  MailOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

const Signup = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (values) => {
    setLoading(true);

    try {
      const response = await axios.post('http://127.0.0.1:8000/api/register/', {
        username: values.username,
        email: values.email,
        password: values.password,
      });

      message.success('Account created successfully! Please log in.');
      navigate('/login');
    } catch (error) {
      console.error('Signup error:', error);
      message.error(
        error.response?.data?.email?.[0] ||
        error.response?.data?.username?.[0] ||
        'Signup failed. Please check your input.'
      );
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
            <Title level={3} style={{ textAlign: 'center' }}>Create Account</Title>
            <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
              Sign up to get started with your account.
            </Text>

            <Form layout="vertical" onFinish={handleSubmit}>
              <Form.Item
                label="Username"
                name="username"
                rules={[{ required: true, message: 'Please enter your username' }]}
              >
                <Input prefix={<UserOutlined />} placeholder="Username" />
              </Form.Item>

              <Form.Item
                label="Email"
                name="email"
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Enter a valid email address' }
                ]}
              >
                <Input prefix={<MailOutlined />} placeholder="Email" />
              </Form.Item>

              <Form.Item
                label="Password"
                name="password"
                rules={[{ required: true, message: 'Please enter your password' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Password" />
              </Form.Item>

              <Form.Item
                label="Confirm Password"
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Please confirm your password' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Passwords do not match!'));
                    }
                  })
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Confirm Password" />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                  size="large"
                >
                  Sign Up
                </Button>
              </Form.Item>

              <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
                Already have an account?{' '}
                <Link to="/login">Log in</Link>
              </Text>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Signup;
