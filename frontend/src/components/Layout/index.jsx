import React from "react";
import Helmet from "react-helmet";
import { Link, useNavigate } from 'react-router-dom';
import { Header, NavBar, Footer } from "@civicactions/data-catalog-components";
import config from "../../assets/config.json";
import links from "../../assets/menu.json";
import './Layout.css';
import { UserOutlined } from '@ant-design/icons';
import { Avatar, Space, Button } from 'antd';

const Layout = ({
  children,
  title,
  description
}) => {
  const navigate = useNavigate();

  // Check if user is logged in by looking for a token in localStorage
  const token = localStorage.getItem('accessToken');

  // Handle logout
  const handleLogout = () => {
    // Remove the access token from localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken'); // Optionally remove refresh token

    // Redirect to login page
    navigate('/login');
  };

  return (
    <div className="App">
      <Helmet
        title={`${title} - NCHLOD`}
        description={description}
        defer={false}
        htmlAttributes={{
          "lang": "en"
        }}
      />

      <div className="headerNav">
        <Header site={config.site} slogan={config.slogan} logo={config.logo} customClasses={config.container} />

        <div className="button-container">
          {/* Show Login and Sign Up buttons only if user is not logged in */}
          {!token ? (
            <>
              <Link to="/login">
                <Button className="custom-button" type="primary">
                  Login
                </Button>
              </Link>
              <Link to="/signup">
                <Button className="custom-button" type="default">
                  Sign Up
                </Button>
              </Link>
            </>
          ) : (
            <>
              {/* Show Profile and Logout if the user is logged in */}
              <Link to="/me">
                <Space direction="vertical" size={16}>
                  <Space wrap size={16}>
                    <Avatar size={40} icon={<UserOutlined />} />
                  </Space>
                </Space>
              </Link>
              <Button
                type="primary"
                onClick={handleLogout}
                className="custom-button mt-2"
              >
                Logout
              </Button>
            </>
          )}
        </div>
      </div>

      <NavBar
        navItems={links.main.map(item => (
          <Link to={item.url} className="nav-link" key={item.url}>
            {item.label}
          </Link>
        ))}
        customClasses={config.container}
      />

      <main className="main-content">
        {children}
      </main>

      <Footer links={links} customClasses={config.container} />
    </div>
  );
};

export default Layout;
