import React from 'react';

const Navbar = () => {
    return (
        <div className='navbar'>
        <div className="projectLogo">
            <h1>NCHLOD</h1>
        </div>
        <div className="login-signup">
            <button className="login">Login</button>
            <button className="signup">Sign Up</button>
        </div>
      </div>
    );
};

export default Navbar;