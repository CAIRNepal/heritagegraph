import React, { useState } from 'react';
import {
  UploadOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Layout, Menu, theme } from 'antd';
import { useLocation, Link } from 'react-router-dom';
import config from "../../assets/config.json"; 

const { Header, Content, Footer, Sider } = Layout;

const menuItems = [
  { key: '1', icon: UserOutlined, label: 'Home', path: '/homelayout' },
  { key: '2', icon: VideoCameraOutlined, label: 'Feed', path: '/feed' },
  { key: '3', icon: VideoCameraOutlined, label: 'Queue', path: '/queuepage' },
  { key: '4', icon: VideoCameraOutlined, label: 'Submission Editor', path: '/suggestedit' },
  { key: '5', icon: UserOutlined, label: 'Diff Viewer', path: '/diffviewer' },
  { key: '', icon: UploadOutlined, label: 'Version Tracker', path: '/version' },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const selectedKey = menuItems.find(item => item.path === location.pathname)?.key;

  return (
    <Layout style={{ minHeight: '100vh'}}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 14, margin: 16 }} />
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
        >
          {menuItems.map(item => (
            <Menu.Item key={item.key} icon={React.createElement(item.icon)}>
              <Link to={item.path}>{item.label}</Link>
            </Menu.Item>
          ))}
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ padding: 22, background: colorBgContainer, }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent:'flex-start'}}>
            <img
              src={config.logo}
              alt="Logo"
              style={{ width: '250px'}}
            />
          </div>
        </Header>
        <Content style={{ margin: '24px 16px 0'}}>
          <div
            style={{
              padding: 24,
              minHeight: 'calc(100vh - 134px)',
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            {children}
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          CAIR-nepal ©{new Date().getFullYear()} Created by HeritageGraph Team
        </Footer>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
