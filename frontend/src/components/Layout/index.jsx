import React from "react";
import Helmet from "react-helmet";
import { Link } from 'react-router-dom';
import { useUser, UserButton } from '@clerk/clerk-react';
import { Header, NavBar, Footer } from "./datacomponent";
import { Button } from 'antd';
import { LoginOutlined, UserOutlined } from '@ant-design/icons';
import config from "../../assets/config.json";
import links from "../../assets/menu.json";
import './Layout.css';

const Layout = ({ children, title, description }) => {
  const { isSignedIn } = useUser();

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
          {isSignedIn ? (
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                variables: {
                  colorPrimary: '#4A90E2',
                  colorText: '#333',
                  fontFamily: '"Roboto", sans-serif',
                  borderRadius: '8px',
                },
                elements: {
                  userButtonAvatarBox: {
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                  },
                  userButtonTrigger: {
                    padding: '8px',
                  },
                },
              }}
            />
          ) : (
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