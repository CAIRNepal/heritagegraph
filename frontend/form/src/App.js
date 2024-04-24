import './App.css';
import cairnepal from './images/fulllogo.png';


function App() {
  return (
    <div className="NCHLOD">


      <div className='navbar'>
        <div className="projectLogo">
            <h1>NCHLOD</h1>
        </div>
        <div className="login-signup">
            <button className="login">Login</button>
            <button className="signup">Sign Up</button>
        </div>
      </div>

    <div className="main">
      <h1 className='projectName'>NCHLOD</h1>

      <div className="mainButtons">

      <div className="mainElement">
      <button className="contributor">
      <span class="material-symbols-outlined">
bloodtype
</span>
        </button>
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

    </div>
  );
}

export default App;
