import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
    return (
        <div className='navbar'>
        <div className="projectLogo">
            <Link to="/" className='homeLink'>
            <h1>NCHLOD</h1>
            </Link>
        </div>
        <div className="login-signup">
            <Link to="/login">
            <button className="login">Login</button>
            </Link>
            <Link to="/signup">
            <button className="signup">Sign Up</button>
            </Link>
        </div>
      </div>
    );
};

export default Navbar;