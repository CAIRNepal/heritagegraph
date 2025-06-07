import React, { useState } from 'react';
import axios from 'axios';
import { Announcement } from "@civicactions/data-catalog-components";
import Layout from '../../components/Layout';
import config from "../../assets/config";

const LogoutPanel = () => {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogout = async () => {
    setError('');
    setSuccess('');

    try {
      // Send a request to the server to log out (this could be optional depending on your backend setup)
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/logout/`, {}, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`, // Include the access token in the request
        },
      });

      if (response.status === 200 || response.status === 204) {
        // Clear the JWT tokens from localStorage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        
        setSuccess('Logout successful! You are now logged out.');
      } else {
        setError('Logout failed. Please try again.');
      }
    } catch (error) {
      setError('An error occurred during logout. Please try again.');
    }
  };

  return (
    <Layout title="Logout">
      <div className={`dc-page ${config.container}`}>
        <h1>Logout</h1>
        <div className="dc-page-content row">
          <div className="col-md-9 col-sm-12">
            <button onClick={handleLogout} className="btn btn-primary">Logout</button>
            {error && <div className="alert alert-danger mt-3">{error}</div>}
            {success && <div className="alert alert-success mt-3">{success}</div>}
          </div>
          <div className="col-md-3 col-sm-12">
            <Announcement variation="info" heading="Note">
              <p>Click the button to log out and clear your session.</p>
            </Announcement>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LogoutPanel;
