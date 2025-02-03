import { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import { dbank_latest_backend } from 'declarations/dbank-latest-backend';
import Dbank from './pages/Dbank';

function App() {
  const [greeting, setGreeting] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const name = event.target.elements.name.value;
    dbank_latest_backend.greet(name).then((greeting) => {
      setGreeting(greeting);
    });
    return false;
  }

  return (
    <Router>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/dbank">DBank</Link>
      </nav>
      <Routes>
        <Route
          path="/"
          element={
            <main>
              <img src="/logo2.svg" alt="DFINITY logo" />
              <br />
              <br />
              <form action="#" onSubmit={handleSubmit}>
                <label htmlFor="name">Enter your name: &nbsp;</label>
                <input id="name" alt="Name" type="text" />
                <button type="submit">Click Me!</button>
              </form>
              <section id="greeting">{greeting}</section>
            </main>
          }
        />
        <Route path="/dbank" element={<Dbank />} />
      </Routes>
    </Router>
  );
}

export default App;
