 import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function Home() { return <h1>Home</h1>; }
function Quiz() { return <h1>Quiz Works</h1>; }

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/quiz" element={<Quiz />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
