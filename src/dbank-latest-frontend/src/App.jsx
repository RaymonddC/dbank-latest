import { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import { dbank_latest_backend } from 'declarations/dbank-latest-backend';
import Dbank from './pages/Dbank';
import './App.scss';

function App() {
  const [greeting, setGreeting] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const name = event.target.elements.name.value;
    dbank_latest_backend.greet(name).then(setGreeting);
  };

  return (
    <Router>
      <div className="app-container">
        <nav className="navbar">
          <div className="nav-links">
            <Link to="/" className="nav-link">Home</Link>
            <Link to="/dbank" className="nav-link">DBank</Link>
          </div>
        </nav>
        <Routes>
          <Route
            path="/"
            element={
              <main className="main-content">
                <div className="logo-container">
                  <img src="/logo2.svg" alt="DFINITY logo" className="logo" />
                </div>
                <div className="form-container">
                  <form onSubmit={handleSubmit} className="greeting-form">
                    <div className="input-group">
                      <label htmlFor="name">Enter your name:</label>
                      <input id="name" type="text" className="input-field" />
                    </div>
                    <button type="submit" className="submit-button">Submit</button>
                  </form>
                  {greeting && <div className="greeting-message">{greeting}</div>}
                </div>
              </main>
            }
          />
          <Route path="/dbank" element={<Dbank />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
