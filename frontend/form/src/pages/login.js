import React from 'react';
// import './login.css';
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
                <input type="text" placeholder="Username" />
                <input type="password" placeholder="Password" />
                <Link to='/signup' className='signtext'>Create new account</Link>
                <button type="submit" className='login'>Login</button>
            </form>
            </div>
        </div>
    );
}

export default Login;