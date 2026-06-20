 import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Quiz from './pages/Quiz';
import PastPapers from './pages/PastPapers';
import NoteDetail from './pages/NoteDetail';
import BioRecall from './pages/Recall';
import LegalPage from './pages/LegalPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/quiz" element={<div>Quiz disabled</div>} />
          <Route path="/past-papers" element={<PastPapers />} />
          <Route path="/recall" element={<div>Recall disabled</div>} />
          <Route path="/notes/read" element={<div>Notes disabled</div>} />
          <Route path="*" element={<Home />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
