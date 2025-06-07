import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Announcement } from "@civicactions/data-catalog-components";
import Layout from '../../components/Layout';
import config from "../../assets/config";
import { UserOutlined } from '@ant-design/icons';
import { Avatar, Spin, Button } from 'antd';
import { useNavigate } from 'react-router-dom'; // Import useNavigate for navigation

const SignupPanel = () => {
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate(); // Hook to navigate to different routes

  // Fetch user profile data from the API
  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('accessToken'); // Get the JWT access token from localStorage
      if (!token) {
        setError('You are not logged in. Please log in to view your profile.');
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/data/auth/users/me/`, {
          headers: {
            'Authorization': `Bearer ${token}`, 
          },
        });
        setProfileData(response.data);  // Set the profile data to the state
        setLoading(false);
      } catch (error) {
        if (error.response && error.response.status === 401) {
          setError('Your session has expired. Please log in again.');
        } else {
          setError('Failed to load profile data. Please refresh the page or check your internet connection.');
        }
        setLoading(false);
      }
    };

    fetchProfile();
  }, []); // The empty dependency array means this will run once when the component mounts

  // Logout function
  const handleLogout = () => {
    // Remove the access token from localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken'); // Optionally remove refresh token

    // Optionally redirect to login page or homepage after logout
    navigate('/login'); // Assuming the login route is '/login'
  };

  // Loading state: display a spinner while the data is being fetched
  if (loading) {
    return (
      <Layout title="Profile">
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
      <Layout title="Your Profile">
        <div className={`dc-page ${config.container}`}>
          <h1>{error}</h1>
          <Button type="primary" onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </div>
      </Layout>
    );
  }

  // Profile data state: display the profile information when data is successfully loaded
  return (
    <Layout title="Your Profile">
      <div className={`dc-page ${config.container}`}>
        <h1>Your Profile</h1>
        <div className="dc-page-content row">
          <div className="col-md-9 col-sm-12">
            <Announcement variation="info" heading="Details">
              <div>
                <Avatar size={164} icon={<UserOutlined />} />
                <h1>{profileData.first_name} {profileData.last_name}</h1>
                <p><strong>Email:</strong> {profileData.email}</p>

                {/* Check if profile exists before rendering organization and score */}
                {profileData.profile ? (
                  <>
                    <p><strong>Organization:</strong> {profileData.profile.organization}</p>
                    <p><strong>Score:</strong> {profileData.profile.score}</p>
                  </>
                ) : (
                  <p><strong>Profile details are unavailable.</strong></p>
                )}
              </div>
                        {/* Logout Button */}
          <div className="col-md-3 col-sm-12 justify-end">
            <Button
              type="primary"
              onClick={handleLogout}
              className="mt-4"
            >
              Logout
            </Button>
          </div>
            </Announcement>
          </div>
          

        </div>
      </div>
    </Layout>
  );
};

export default SignupPanel;
