// src/App.jsx
import { Routes, Route, useLocation, useNavigationType, useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, ProtectedRoute } from './contexts/AuthContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { ToastProvider } from './components/Toast/Toast';
import Layout from './components/Layout/Layout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import OnboardingFlow from './pages/OnboardingFlow';
import Quiz from './pages/Quiz';
import FlashcardsPage from './pages/FlashcardsPage';
import Classroom from './pages/Classroom';
import ClassroomRoom from './pages/ClassroomRoom';
import PastPapers from './pages/PastPapers';
import NoteDetail from './pages/NoteDetail';
import Glossary from './pages/Glossary';
import BioRecall from './pages/Recall';
import AboutPage from './pages/AboutPage';
import LegalPage from './pages/LegalPage';
import Auth from './pages/Auth';
import TutorApply from './pages/TutorApply';
import TutorDashboard from './pages/TutorDashboard';
import TutorMarketplace from './pages/TutorMarketplace';

function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType();
  const prevPathRef = useRef(null);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    const key = location.pathname;
    const prevPath = prevPathRef.current;
    if (prevPath && prevPath !== key) {
      sessionStorage.setItem(`scroll:${prevPath}`, String(window.scrollY));
    }
    prevPathRef.current = key;
    if (navType === 'POP') {
      const saved = sessionStorage.getItem(`scroll:${key}`);
      const target = saved ? parseInt(saved, 10) : 0;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => window.scrollTo(0, target));
      });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, navType]);

  return null;
}

function AppRoutes() {
  const location = useLocation();

  return (
    <>
      <ScrollManager />
      <Layout>
        <AnimatePresence mode="wait">
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/register" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><OnboardingFlow /></ProtectedRoute>} />
            <Route path="/quiz" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
            <Route path="/past-papers" element={<PastPapers />} />
            <Route path="/recall" element={<ProtectedRoute><BioRecall /></ProtectedRoute>} />
            <Route path="/notes/read" element={<ProtectedRoute><NoteDetail /></ProtectedRoute>} />
            <Route path="/glossary/:slug" element={<ProtectedRoute><Glossary /></ProtectedRoute>} />
            <Route path="/glossary" element={<ProtectedRoute><Glossary /></ProtectedRoute>} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/flashcards" element={<ProtectedRoute><FlashcardsPage /></ProtectedRoute>} />
            <Route path="/terms" element={<LegalPage type="terms" />} />
            <Route path="/privacy" element={<LegalPage type="privacy" />} />
            <Route path="/classroom" element={<ProtectedRoute><Classroom /></ProtectedRoute>} />
            <Route path="/classroom/:roomId" element={<ProtectedRoute><ClassroomRoom /></ProtectedRoute>} />
            <Route path="/tutor/apply" element={<ProtectedRoute><TutorApply /></ProtectedRoute>} />
            <Route path="/tutor/dashboard" element={<ProtectedRoute><TutorDashboard /></ProtectedRoute>} />
            <Route path="/tutors" element={<TutorMarketplace />} />
            <Route path="*" element={<div className="section" style={{ textAlign: 'center', paddingTop: 'var(--space-16)' }}><h1>404</h1><p>Page not found</p></div>} />
          </Routes>
        </AnimatePresence>
      </Layout>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LayoutProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </LayoutProvider>
    </AuthProvider>
  );
}
