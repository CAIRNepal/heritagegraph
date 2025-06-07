import { Outlet } from 'react-router-dom';
import AuthNav from './AuthNav';

const Layout = () => {
  return (
    <div className="app-container">
      <header>
        <AuthNav />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;