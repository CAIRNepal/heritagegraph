import { useUser, UserButton } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import './AuthNav.css'; 

const AuthNav = () => {
  const { isSignedIn } = useUser();

  return (
    <nav className="auth-nav">
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
                borderRadius: '50%',
              },
              userButtonTrigger: {
                padding: '5px',
              },
            },
          }}
        />
      ) : (
        <div className="auth-links">
          <Link to="/login" className="auth-link">
            <span className="auth-icon sign-in-icon">🔐</span> Sign In
          </Link>
          <Link to="/signup" className="auth-link">
            <span className="auth-icon sign-up-icon">✍️</span> Sign Up
          </Link>
        </div>
      )}
    </nav>
  );
};

export default AuthNav;