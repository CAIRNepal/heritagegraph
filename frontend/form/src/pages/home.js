import { Link } from 'react-router-dom';
import cairnepal from '../images/fulllogo.png';
import React from 'react';

const Home = () => {
    return (
        <div className="main">
            <h1 className='projectName'>NCHLOD</h1>

            <div className="mainButtons">
                
                <div className="mainElement">
                <Link to="/fields">
                    <button className="contributor">
                        <span class="material-symbols-outlined">
                            bloodtype
                        </span>
                    </button>
                    </Link>
                    <label>CONTRIBUTOR</label>
                </div>

                <div className="mainElement">
                    <button className="admin">
                        <span class="material-symbols-outlined">
                            admin_panel_settings
                        </span>
                    </button>
                    <label>ADMIN</label>
                </div>

                <div className="mainElement">
                    <button className="users">
                        <span class="material-symbols-outlined">
                            group
                        </span>
                    </button>
                    <label>USERS</label>
                </div>
            </div>

            <div className="mainElement">
                <img src={cairnepal} alt="Cair Nepal" />
            </div>
        </div>
    );
};

export default Home;
