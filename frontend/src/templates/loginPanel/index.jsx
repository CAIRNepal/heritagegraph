import { SignIn } from '@clerk/clerk-react';

const Signin = () => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
      <SignIn routing="path" path="/login" signUpUrl="/signup" />
    </div>
  );
};

export default Signin;  