import './App.css';
import Navbar from './components/navbar';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Error from './pages/Error';
import Fields from './pages/fields';
import Home from './pages/home';

function App() {
  return (
    <div className="NCHLOD">
      <BrowserRouter>

    <Navbar />

   
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path='/fields' element={<Fields/>} />
      <Route path='*' element={<Error/>} />
    </Routes>
    </BrowserRouter>
    </div>

  );
}

export default App;
