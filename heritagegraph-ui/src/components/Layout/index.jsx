import React from "react";
import Helmet from "react-helmet";
import { Link, useNavigate } from 'react-router-dom';
import { Header, NavBar, Footer } from "./datacomponent";
import { Button } from 'antd';
import { UserOutlined, LoginOutlined, LogoutOutlined } from '@ant-design/icons';
import config from "../../assets/config.json";
import links from "../../assets/menu.json";
import './Layout.css';

const Layout = ({ children, title, description }) => {
  const navigate = useNavigate();

  // Check if the user is logged in by checking the access token in localStorage
  const isLoggedIn = localStorage.getItem('access_token');

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    navigate('/');
  };

  return (
    <div className="App">
      <Helmet
        title={`${title} - Heritage Graph`}
        description={description}
        defer={false}
        htmlAttributes={{
          "lang": "en"
        }}
      />


      <div className="headerNav">
        <Header site={config.site} slogan={config.slogan} logo={config.logo} customClasses={config.container} />

        <div className="navbar-buttons">
          {!isLoggedIn ? (
            <div className="auth-buttons">
              <Link to="/login">
                <Button type="primary" icon={<LoginOutlined />} className="auth-btn">
                  Login
                </Button>
              </Link>
         
              <Link to="/signup">
                <Button type="default" icon={<UserOutlined />} className="auth-btn">
                  Sign Up
                </Button>
              </Link>
            </div>
          ) : (
            <div className="auth-buttons">
              <Button
                type="default"
                icon={<UserOutlined />}
                className="auth-btn"
                onClick={() => navigate('/profile')}
              >
                Profile
              </Button>
              <Button
                type="default"
                icon={<LogoutOutlined />}
                className="auth-btn"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </div>
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
      >
        <div className="navbar-buttons">
          {!isLoggedIn ? (
            <div className="auth-buttons">
              <Link to="/login">
                <Button type="primary" icon={<LoginOutlined />}>
                  Login
                </Button>
              </Link>
              <Link to="/signup">
                <Button type="default" icon={<UserOutlined />} className="auth-btn">
                  Sign Up
                </Button>
              </Link>
            </div>
          ) : (
            <div className="auth-buttons">
              <Button
                type="default"
                icon={<UserOutlined />}
                className="auth-btn"
                onClick={() => navigate('/profile')}
              >
                Profile
              </Button>
              <Button
                type="default"
                icon={<LogoutOutlined />}
                className="auth-btn"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </div>
          )}
        </div>
      </NavBar>

      <main className="main-content">
        {children}
      </main>

      <Footer links={links} customClasses={config.container} />
    </div>
  );
};

export default Layout;
