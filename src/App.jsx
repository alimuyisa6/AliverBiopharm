 import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, ProtectedRoute } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Quiz from './pages/Quiz';
import PastPapers from './pages/PastPapers';
import NoteDetail from './pages/NoteDetail';
import BioRecall from './pages/Recall';
import LegalPage from './pages/LegalPage';
import Glossary from './pages/Glossary';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/quiz" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
          <Route path="/past-papers" element={<PastPapers />} />
          <Route path="/recall" element={<ProtectedRoute><BioRecall /></ProtectedRoute>} />
          <Route path="/notes/read" element={<ProtectedRoute><NoteDetail /></ProtectedRoute>} />
           <Route path="/glossary" element={<Glossary />} />
          <Route path="/glossary/:slug" element={<ProtectedRoute><Glossary /></ProtectedRoute>} />
          <Route path="*" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
