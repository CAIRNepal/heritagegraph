import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import config from "../../assets/config";
import { Announcement } from '@civicactions/data-catalog-components';
import { Alert, Form, Input, Button, Checkbox, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { TextArea } = Input;

const SubmissionForm = () => {
  const [form] = Form.useForm();
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [mediaFiles, setMediaFiles] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsUserLoggedIn(false);
    } else {
      axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/user/info`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then(response => {
        const userInfo = response.data;
        form.setFieldsValue({
          userName: userInfo.username,
          userEmail: userInfo.email,
        });
        setIsUserLoggedIn(true);
      })
      .catch(err => {
        console.error('Error fetching user info:', err);
        setError('Failed to fetch user info.');
      });
    }
  }, [form, navigate]);

  const handleSubmit = async (values) => {
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
        location: values.location,
        historicalContext: values.historicalContext,
        mediaFiles: mediaFiles.map(file => file.name), // store just file names
      },
      contributor: {
        name: values.userName,
        consentToShare: values.consentToShare || false,
      },
      verification: {
        confirmAccuracy: values.confirmAccuracy,
      },
      status: 'Pending',
    };

    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setError('You must be logged in to submit.');
        setLoading(false);
        return;
      }

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/data/form-submit/`,
        payload,{
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      console.log("RESPONSE: ", response.status)
      if (response.status === 201) {
        setSuccess('Submission created successfully!');
        form.resetFields();
        setMediaFiles([]);
      } else {
        setError('Submission failed. Please try again.');
      }
    } catch (error) {
      console.error('Submission error:', error);
      setError('An error occurred while submitting. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Submit New Entry">
      <div className={`dc-page ${config.container}`}>
        <h1>Contribute to HeritageGraph</h1>

        {!isUserLoggedIn && (
          <Alert 
            message="Authentication Required" 
            description="You must be logged in to submit your entry. Please log in first."
            type="warning" 
            showIcon 
            style={{ marginBottom: '20px' }} 
          />
        )}

        {isUserLoggedIn && (
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
                  rules={[{ required: true, message: 'Please enter your username!' }]}
                >
                  <Input placeholder="Enter your name" />
                </Form.Item>

                <Form.Item
                  label="Email"
                  name="userEmail"
                  rules={[{ required: true, type: 'email', message: 'Please enter a valid email!' }]}
                >
                  <Input placeholder="Enter your email" />
                </Form.Item>

                <h2>Cultural Heritage Details</h2>
                <Form.Item
                  label="Title"
                  name="heritageTitle"
                  rules={[{ required: true, message: 'Please enter the heritage title!' }]}
                >
                  <Input placeholder="Enter the title" />
                </Form.Item>

                <Form.Item
                  label="Description"
                  name="heritageDescription"
                  rules={[{ required: true, message: 'Please provide a description!' }]}
                >
                  <TextArea rows={4} placeholder="Enter a description" />
                </Form.Item>

                <Form.Item
                  label="Location"
                  name="location"
                  rules={[{ required: true, message: 'Please enter the location!' }]}
                >
                  <Input placeholder="Enter the location" />
                </Form.Item>

                <Form.Item
                  label="Historical Context"
                  name="historicalContext"
                  rules={[{ required: true, message: 'Please provide the historical context!' }]}
                >
                  <TextArea rows={4} placeholder="Enter historical context" />
                </Form.Item>

                <Form.Item
                  label="Upload Media"
                  name="mediaFiles"
                >
                  <Upload
                    beforeUpload={(file) => {
                      setMediaFiles(prev => [...prev, file]);
                      return false;
                    }}
                    multiple
                  >
                    <Button icon={<UploadOutlined />}>Select Files</Button>
                  </Upload>
                </Form.Item>

                <Form.Item
                  name="consentToShare"
                  valuePropName="checked"
                >
                  <Checkbox>
                    I consent to share my submission publicly.
                  </Checkbox>
                </Form.Item>

                <Form.Item
                  name="confirmAccuracy"
                  valuePropName="checked"
                  rules={[
                    {
                      validator: (_, value) =>
                        value ? Promise.resolve() : Promise.reject(new Error('You must confirm the accuracy.')),
                    },
                  ]}
                >
                  <Checkbox>
                    I confirm that the information provided is accurate.
                  </Checkbox>
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                  >
                    Submit
                  </Button>
                </Form.Item>
              </Form>

              {error && <Alert message={error} type="error" showIcon style={{ marginTop: 16 }} />}
              {success && <Alert message={success} type="success" showIcon style={{ marginTop: 16 }} />}
            </div>

            <div className="col-md-3 col-sm-12">
              <Announcement variation="info" heading="Note">
                <p>Ensure all fields are filled before submitting. Media files will not be uploaded now, just listed.</p>
              </Announcement>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SubmissionForm;
