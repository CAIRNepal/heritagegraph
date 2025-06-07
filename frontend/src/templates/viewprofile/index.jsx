import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Announcement } from "@civicactions/data-catalog-components";
import Layout from '../../components/Layout';
import config from "../../assets/config";
import { UserOutlined } from '@ant-design/icons';
import { Avatar, Spin, Input, Button, Form, message } from 'antd';
import { useParams } from 'react-router-dom';

const ViewProfileOrForm = () => {
  const { username, title } = useParams();
  const [decodedTitle, setDecodedTitle] = useState('');

  const [profileData, setProfileData] = useState(null);
  const [submissionData, setSubmissionData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isProfileView, setIsProfileView] = useState(false);

  // Fetch user profile data or submission data from the API
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // If username is provided, fetch user profile
      if (username) {
        setIsProfileView(true); // It's a profile view
        try {
          const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/data/user/${username}/`);
          console.log(response);
          setProfileData(response.data);
        } catch (error) {
          setError('User not found.');
        }
      }

      // If title is provided, fetch submission data
      if (title) {
        setIsProfileView(false); 
        setDecodedTitle(decodeURIComponent(title));
        try {
          const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/data/submissions/${title}/`);
          setSubmissionData(response.data);
        } catch (error) {
          setError('Submission not found.');
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [username, title]);

  // Handle form submission for editing profile or submission
  const handleSubmit = async (values) => {
    try {
      if (isProfileView) {
        // Submit profile updates
        const response = await axios.put(`${import.meta.env.VITE_API_BASE_URL}/data/user/${username}/`, values);
        setProfileData(response.data);
        message.success('Profile updated successfully!');
      } else {
        // Submit submission updates
        const response = await axios.put(`${import.meta.env.VITE_API_BASE_URL}/data/submissions/${title}/`, values);
        setSubmissionData(response.data);
        message.success('Submission updated successfully!');
      }
    } catch (error) {
      message.error('Failed to update data.');
    }
  };

  // Loading state: display a spinner while the data is being fetched
  if (loading) {
    return (
      <Layout title={isProfileView ? "User Profile" : "Edit Submission"}>
        <div className={`dc-page ${config.container}`}>
          <h1>Loading...</h1>
          <Spin size="large" />
        </div>
      </Layout>
    );
  }

  // Error state: display the error message
  if (error) {
    return (
      <Layout title={isProfileView ? "User Profile" : "Edit Submission"}>
        <div className={`dc-page ${config.container}`}>
          <h1>{error}</h1>
        </div>
      </Layout>
    );
  }

  // Profile view or form rendering
  if (isProfileView && profileData) {
    return (
      <Layout title="User Profile">
        <div className={`dc-page ${config.container}`}>
          <h1>User Profile</h1>
          <div className="dc-page-content row">
            <div className="col-md-9 col-sm-12">
              <Announcement variation="info" heading="Details">
                <div>
                  <Avatar size={164} icon={<UserOutlined />} />
                  <h1>{profileData.first_name} {profileData.last_name}</h1>
                  <p><strong>Email:</strong> {profileData.profile.email}</p>
                  <p><strong>Username:</strong> {profileData.username}</p>
                  <p><strong>Organization:</strong> {profileData.profile.organization}</p>
                  <p><strong>Position:</strong> {profileData.profile.position}</p>
                  <p><strong>University/School:</strong> {profileData.profile.university_school}</p>
                  <p><strong>Score:</strong> {profileData.profile.score}</p>
                  <p><strong>Birth Date:</strong> {profileData.profile.birth_date}</p>
                </div>
              </Announcement>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Form view for editing profile or submission
  return (
    <Layout title={isProfileView ? "Edit Profile" : "Edit Submission"}>
      <div className={`dc-page ${config.container}`}>
        <h1>{isProfileView ? "Edit Profile" : "Edit Submission"}</h1>
        <div className="dc-page-content row">
          <div className="col-md-9 col-sm-12">
            <Form
              initialValues={isProfileView
                ? {
                    first_name: profileData?.profile.first_name || '',
                    last_name: profileData?.profile.last_name || '',
                    email: profileData?.profile.email || '',
                    organization: profileData?.profile.organization || '',
                    position: profileData?.profile.position || '',
                    university_school: profileData?.profile.university_school || '',
                    score: profileData?.profile.score || 0,
                    birth_date: profileData?.profile.birth_date || '',
                  }
                : {
                    title: submissionData?.title || '',
                    description: submissionData?.description || '',
                  }
              }
              onFinish={handleSubmit}
            >
              {isProfileView ? (
                <>
                  <Form.Item
                    label="First Name"
                    name="first_name"
                    rules={[{ required: true, message: 'Please input your first name!' }]}
                  >
                    <Input />
                  </Form.Item>

                  <Form.Item
                    label="Last Name"
                    name="last_name"
                    rules={[{ required: true, message: 'Please input your last name!' }]}
                  >
                    <Input />
                  </Form.Item>

                  <Form.Item
                    label="Email"
                    name="email"
                    rules={[{ required: true, type: 'email', message: 'Please input a valid email!' }]}
                  >
                    <Input />
                  </Form.Item>

                  <Form.Item
                    label="Organization"
                    name="organization"
                  >
                    <Input />
                  </Form.Item>

                  <Form.Item
                    label="Position"
                    name="position"
                  >
                    <Input />
                  </Form.Item>

                  <Form.Item
                    label="University/School"
                    name="university_school"
                  >
                    <Input />
                  </Form.Item>

                  <Form.Item
                    label="Score"
                    name="score"
                  >
                    <Input type="number" />
                  </Form.Item>

                  <Form.Item
                    label="Birth Date"
                    name="birth_date"
                  >
                    <Input type="date" />
                  </Form.Item>
                </>
              ) : (
                <>
                  <Form.Item
                    label="Title"
                    name="title"
                    rules={[{ required: true, message: 'Please input the title!' }]}
                  >
                    <Input />
                  </Form.Item>

                  <Form.Item
                    label="Description"
                    name="description"
                    rules={[{ required: true, message: 'Please input the description!' }]}
                  >
                    <Input.TextArea />
                  </Form.Item>
                </>
              )}

              <Form.Item>
                <Button type="primary" htmlType="submit">
                  Save Changes
                </Button>
              </Form.Item>
            </Form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ViewProfileOrForm;
