 import React, { useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
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
import AboutPage from './pages/AboutPage';
import InfoPage from './pages/PageInfo';

const scrollCache = new Map();

function ScrollManager() {
  const location = useLocation();
  const isInitialRender = useRef(true);
  const restoreAttempts = useRef(0);
  const maxRestoreAttempts = 10;

  const savePosition = useCallback(() => {
    const key = location.pathname + location.search;
    scrollCache.set(key, {
      x: window.scrollX,
      y: window.scrollY,
      timestamp: Date.now()
    });
    try {
      const cacheObj = Object.fromEntries(scrollCache);
      sessionStorage.setItem('scrollCache', JSON.stringify(cacheObj));
    } catch (e) {}
  }, [location.pathname, location.search]);

  const restorePosition = useCallback((key, y, attempts = 0) => {
    if (attempts >= maxRestoreAttempts) return;
    
    const docHeight = document.documentElement.scrollHeight;
    if (docHeight >= y || attempts > 5) {
      window.scrollTo(0, y);
      restoreAttempts.current = 0;
    } else {
      restoreAttempts.current = attempts + 1;
      requestAnimationFrame(() => restorePosition(key, y, attempts + 1));
    }
  }, []);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('scrollCache');
      if (saved && scrollCache.size === 0) {
        const parsed = JSON.parse(saved);
        Object.entries(parsed).forEach(([key, value]) => {
          scrollCache.set(key, value);
        });
      }
    } catch (e) {}

    const handleBeforeUnload = () => savePosition();
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [savePosition]);

  useEffect(() => {
    const key = location.pathname + location.search;

    if (isInitialRender.current) {
      const cached = scrollCache.get(key);
      if (cached && cached.y > 0) {
        restorePosition(key, cached.y);
      }
      isInitialRender.current = false;
      return;
    }

    const cached = scrollCache.get(key);
    if (cached && cached.y > 0) {
      restorePosition(key, cached.y);
    } else {
      window.scrollTo(0, 0);
    }

    return () => {
      savePosition();
    };
  }, [location.pathname, location.search, savePosition, restorePosition]);

  useEffect(() => {
    let saveTimer;
    const handleScroll = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(savePosition, 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(saveTimer);
      savePosition();
    };
  }, [savePosition]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollManager />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/quiz" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
          <Route path="/past-papers" element={<PastPapers />} />
          <Route path="/recall" element={<ProtectedRoute><BioRecall /></ProtectedRoute>} />
          <Route path="/notes/read" element={<ProtectedRoute><NoteDetail /></ProtectedRoute>} />
          <Route path="/glossary/:slug" element={<ProtectedRoute><Glossary /></ProtectedRoute>} />
          <Route path="/glossary" element={<ProtectedRoute><Glossary /></ProtectedRoute>} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/info/:slug" element={<InfoPage />} />
          <Route path="*" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
