 import React, { useEffect, useRef } from 'react';
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
import LearningLab from './pages/LearningLab';
import FlashcardsPage from './pages/FlashcardsPage';
import Classroom from './pages/Classroom';
import ClassroomRoom from './pages/ClassroomRoom';
import TutorApply from './pages/TutorApply';
import TutorDashboard from './pages/TutorDashboard';

const scrollPositions = {};

function ScrollManager() {
  const location = useLocation();
  const prevPathRef = useRef(null);
  const restoreAttemptsRef = useRef(0);

  useEffect(() => {
    const key = location.pathname;
    const prevPath = prevPathRef.current;

    if (prevPath && prevPath !== key) {
      scrollPositions[prevPath] = window.scrollY;
    }

    prevPathRef.current = key;

    const savedY = scrollPositions[key];
    restoreAttemptsRef.current = 0;

    if (savedY !== undefined) {
      const attemptRestore = () => {
        const maxHeight = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        );
        const viewportHeight = window.innerHeight;
        const maxScrollY = maxHeight - viewportHeight;

        if (maxScrollY >= savedY - 100 || restoreAttemptsRef.current >= 30) {
          window.scrollTo(0, Math.min(savedY, Math.max(0, maxScrollY)));
          return;
        }

        restoreAttemptsRef.current++;
        requestAnimationFrame(attemptRestore);
      };

      requestAnimationFrame(attemptRestore);
    } else {
      window.scrollTo(0, 0);
    }

    let saveTimer;
    const handleScroll = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        scrollPositions[key] = window.scrollY;
      }, 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(saveTimer);
      scrollPositions[key] = window.scrollY;
    };
  }, [location.pathname]);

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
          <Route path="/lab" element={<ProtectedRoute><LearningLab /></ProtectedRoute>} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/flashcards" element={<ProtectedRoute><FlashcardsPage /></ProtectedRoute>} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/classroom" element={<ProtectedRoute><Classroom /></ProtectedRoute>} />
          <Route path="/classroom/:roomId" element={<ProtectedRoute><ClassroomRoom /></ProtectedRoute>} />
          <Route path="/tutor/apply" element={<ProtectedRoute><TutorApply /></ProtectedRoute>} />
          <Route path="/tutor/dashboard" element={<ProtectedRoute><TutorDashboard /></ProtectedRoute>} />
          <Route path="/info/:slug" element={<InfoPage />} />
          <Route path="*" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
