import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import config from "../../assets/config";
import { Announcement } from '@civicactions/data-catalog-components';
import { Alert, Form, Input, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

const { TextArea } = Input;

const SubmissionForm = () => {
  const [form] = Form.useForm(); // 🔹 AntD form instance
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    axios.get('http://127.0.0.1:8000/api/user/info', {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then(res => {
      const { username, email } = res.data;
      form.setFieldsValue({
        userName: username || '',
        userEmail: email || ''
      });
      setIsUserLoggedIn(true);
    })
    .catch(err => {
      console.error(err);
      setError('Failed to fetch user info');
    });
  }, [form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields(); // 🔹 Use validated form values
      setError('');
      setSuccess('');
      setLoading(true);

      const payload = {
        user: {
          name: values.userName,
          email: values.userEmail,
        },
        heritage: {
          title: values.heritageTitle,
          description: values.heritageDescription,
          location: '', 
          historicalContext: '',
          mediaFiles: [],
        },
        contributor: {
          name: 'nabin2004',
          consentToShare: false,
        },
        verification: {
          confirmAccuracy: false,
        },
        status: 'Pending',
      };

      const token = localStorage.getItem('access_token');
      if (!token) {
        setError('You must be logged in to submit.');
        setLoading(false);
        return;
      }

      const response = await axios.post(
        'http://127.0.0.1:8000/data/form-submit/',
        payload,
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
      );

      if (response.status === 200) {
        setSuccess('Submission created successfully!');
        form.resetFields(); // 🔹 Reset the form
      } else {
        setError('Submission failed. Please try again.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Submit New Entry">
      <div className={`dc-page ${config.container}`}>
        <h1>Contribute to HeritageGraph</h1>

        {!isUserLoggedIn ? (
          <Alert
            message="Authentication Required"
            description="You must be logged in to submit your entry."
            type="warning"
            showIcon
            style={{ marginBottom: '20px' }}
          />
        ) : (
          <div className="dc-page-content row">
            <div className="col-md-9 col-sm-12">
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
              >
                <h2>User Information</h2>
                <Form.Item
                  label="Username"
                  name="userName"
                  rules={[{ required: true, message: 'Please enter your name' }]}>
                  <Input placeholder="Enter your name" />
                </Form.Item>

                <Form.Item
                  label="Email"
                  name="userEmail"
                  rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}>
                  <Input placeholder="Enter your email" />
                </Form.Item>

                <h2>Cultural Heritage Details</h2>
                <Form.Item
                  label="Title"
                  name="heritageTitle"
                  rules={[{ required: true, message: 'Please enter a title' }]}>
                  <Input placeholder="Enter the title" />
                </Form.Item>

                <Form.Item
                  label="Description"
                  name="heritageDescription"
                  rules={[{ required: true, message: 'Please enter a description' }]}>
                  <TextArea placeholder="Enter description" rows={4} />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={loading}>
                    Submit
                  </Button>
                </Form.Item>
              </Form>

              {error && <Alert message={error} type="error" showIcon />}
              {success && <Alert message={success} type="success" showIcon />}
            </div>

            <div className="col-md-3 col-sm-12">
              <Announcement variation="info" heading="Note">
                <p>Ensure all fields are filled before submitting.</p>
              </Announcement>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SubmissionForm;
