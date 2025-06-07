import { SignIn } from '@clerk/clerk-react';

const LoginPortal = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
      }}
    >
      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/signup"
        appearance={{
          variables: {
            colorPrimary: '#4A90E2',
            colorText: '#333',
            fontFamily: '"Roboto", sans-serif',
            borderRadius: '8px',
          },
          elements: {
            formButtonPrimary: {
              backgroundColor: '#4A90E2',
              color: 'white',
              padding: '10px 20px',
              fontSize: '16px',
            },
            card: {
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              borderRadius: '10px',
            },
          },
        }}
      />
    </div>
  );
};

export default LoginPortal;