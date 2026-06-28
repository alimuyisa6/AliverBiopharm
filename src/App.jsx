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
  const retryTimer = useRef(null);
  const lastSavedY = useRef(0);
  const restoreInProgress = useRef(false);
  const currentKey = useRef('');

  const savePosition = useCallback(() => {
    const key = location.pathname + location.search;
    const y = window.scrollY;
    if (y === lastSavedY.current && key === currentKey.current) return;
    lastSavedY.current = y;
    currentKey.current = key;
    scrollCache.set(key, {
      x: window.scrollX,
      y: y,
      timestamp: Date.now()
    });
    try {
      const cacheObj = Object.fromEntries(scrollCache);
      sessionStorage.setItem('scrollCache', JSON.stringify(cacheObj));
    } catch (e) {}
  }, [location.pathname, location.search]);

  const restorePosition = useCallback((key, targetY) => {
    restoreInProgress.current = true;
    let attempts = 0;
    const maxAttempts = 50;

    const tryScroll = () => {
      if (!restoreInProgress.current) return;
      if (currentKey.current !== key) return;

      const docHeight = document.documentElement.scrollHeight;
      const bodyHeight = document.body.scrollHeight;
      const maxHeight = Math.max(docHeight, bodyHeight);
      const viewportHeight = window.innerHeight;
      const maxScrollY = maxHeight - viewportHeight;

      if (maxScrollY >= targetY - 200 || attempts >= maxAttempts) {
        window.scrollTo(0, Math.min(targetY, maxScrollY));
        if (attempts < 5) {
          requestAnimationFrame(() => {
            window.scrollTo(0, Math.min(targetY, maxScrollY));
          });
        }
        restoreInProgress.current = false;
        return;
      }

      attempts++;
      retryTimer.current = setTimeout(() => {
        requestAnimationFrame(tryScroll);
      }, 200);
    };

    tryScroll();
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
    window.addEventListener('pagehide', savePosition);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', savePosition);
    };
  }, [savePosition]);

  useEffect(() => {
    const key = location.pathname + location.search;
    currentKey.current = key;
    restoreInProgress.current = false;
    if (retryTimer.current) clearTimeout(retryTimer.current);

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
      restoreInProgress.current = false;
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [location.pathname, location.search, savePosition, restorePosition]);

  useEffect(() => {
    let saveTimer;
    const handleScroll = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(savePosition, 100);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) savePosition();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
