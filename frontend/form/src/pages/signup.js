import React from 'react';
import './loginSignup.css';
import '../App.css';
import { Link } from 'react-router-dom';

function Login() {
    return (
        <div className='logform'>
            <div className='loginSignup'>
                <h1 className='projectName'>NCHLOD</h1>
                <h5>Nepal Cultural Heritage Linked Open Data</h5>
            </div>

            <div className='loginform'>
                <form>
                    <input type="text" placeholder="Username or Email" />
                    <input type="password" placeholder="Password" />
                    <input type="password" placeholder="Confirm Password" />
                    <Link to='/login' className='signtext'>Already have an account</Link>
                    <button type="submit" className='login'>Signup</button>
                </form>
            </div>
        </div>
    );
}

export default Login;