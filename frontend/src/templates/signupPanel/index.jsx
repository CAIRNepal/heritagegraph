import { SignUp } from '@clerk/clerk-react';

const Signup = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <SignUp path="/signup" signInUrl="/login" signInForceRedirectUrl="/login" routing="path" />
    </div>
  );
};

export default Signup;


