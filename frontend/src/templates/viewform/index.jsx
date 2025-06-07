import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Announcement } from "@civicactions/data-catalog-components";
import Layout from '../../components/Layout';
import config from "../../assets/config";
import { UserOutlined } from '@ant-design/icons';
import { Avatar, Spin, Input, Button, Form, message } from 'antd';
import { useParams } from 'react-router-dom'; // Import useParams to get the username from the URL

const ViewForm = () => {
  const { username } = useParams(); // Get the username from the URL
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch user profile data from the API
  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) {
        setError('No username provided.');
        setLoading(false);
        return;
      }

      try {
        // Make a GET request to the user profile endpoint using the username
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/data/user/${username}/`);
        setProfileData(response.data);  // Set the profile data to the state
        setLoading(false);
      } catch (error) {
        if (error.response && error.response.status === 404) {
          setError('User not found.');
        } else {
          setError('Failed to load profile data. Please refresh the page or check your internet connection.');
        }
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]); // The username from the URL is a dependency for the effect

  // Handle form submission to update profile
  const handleSubmit = async (values) => {
    try {
      // Send a PUT request to update the profile data
      const response = await axios.put(`${import.meta.env.VITE_API_BASE_URL}/data/user/${username}/`, values);
      setProfileData(response.data);
      message.success('Profile updated successfully!');
    } catch (error) {
      message.error('Failed to update profile.');
    }
  };

  // Loading state: display a spinner while the data is being fetched
  if (loading) {
    return (
      <Layout title="User Profile">
        <div className={`dc-page ${config.container}`}>
          <h1>Loading...</h1>
          <Spin size="large" />
        </div>
      </Layout>
    );
  }

  // Error state: display the error message and a button to refresh the page
  if (error) {
    return (
      <Layout title="User Profile">
        <div className={`dc-page ${config.container}`}>
          <h1>{error}</h1>
        </div>
      </Layout>
    );
  }

  // Profile data state: display the profile information and form when data is successfully loaded
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
                <p><strong>Email:</strong> {profileData.email}</p>
                <p><strong>Username:</strong> {profileData.username}</p>

                {/* Optional: Display organization or additional profile data */}
                {profileData.organization && (
                  <p><strong>Organization:</strong> {profileData.organization}</p>
                )}
              </div>
            </Announcement>

            {/* Render a form to update the profile */}
            <h2>Edit Profile</h2>
            <Form
              initialValues={{
                first_name: profileData.first_name,
                last_name: profileData.last_name,
                email: profileData.email,
                organization: profileData.organization || '',
              }}
              onFinish={handleSubmit}
            >
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

export default ViewForm;
