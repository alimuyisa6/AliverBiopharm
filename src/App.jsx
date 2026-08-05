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
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Layout><Home /></Layout>} />
          <Route path="/login" element={<Layout><Auth /></Layout>} />
          <Route path="/register" element={<Layout><Auth /></Layout>} />
          <Route path="/dashboard" element={<Layout><ProtectedRoute><Dashboard /></ProtectedRoute></Layout>} />
          <Route path="/profile" element={<Layout><ProtectedRoute><Profile /></ProtectedRoute></Layout>} />
          <Route path="/onboarding" element={<Layout><ProtectedRoute><OnboardingFlow /></ProtectedRoute></Layout>} />
          <Route path="/quiz" element={<Layout><ProtectedRoute><Quiz /></ProtectedRoute></Layout>} />
          <Route path="/past-papers" element={<Layout><PastPapers /></Layout>} />
          <Route path="/recall" element={<Layout><ProtectedRoute><BioRecall /></ProtectedRoute></Layout>} />
          <Route path="/notes/read" element={<Layout><ProtectedRoute><NoteDetail /></ProtectedRoute></Layout>} />
          <Route path="/glossary/:slug" element={<Layout><ProtectedRoute><Glossary /></ProtectedRoute></Layout>} />
          <Route path="/glossary" element={<Layout><ProtectedRoute><Glossary /></ProtectedRoute></Layout>} />
          <Route path="/about" element={<Layout><AboutPage /></Layout>} />
          <Route path="/flashcards" element={<Layout><ProtectedRoute><FlashcardsPage /></ProtectedRoute></Layout>} />
          <Route path="/terms" element={<Layout><LegalPage type="terms" /></Layout>} />
          <Route path="/privacy" element={<Layout><LegalPage type="privacy" /></Layout>} />
          <Route path="/classroom" element={<Layout><ProtectedRoute><Classroom /></ProtectedRoute></Layout>} />
          <Route path="/classroom/:roomId" element={<Layout><ProtectedRoute><ClassroomRoom /></ProtectedRoute></Layout>} />
          <Route path="/tutor/apply" element={<Layout><ProtectedRoute><TutorApply /></ProtectedRoute></Layout>} />
          <Route path="/tutor/dashboard" element={<Layout><ProtectedRoute><TutorDashboard /></ProtectedRoute></Layout>} />
          <Route path="/tutors" element={<Layout><TutorMarketplace /></Layout>} />
          <Route path="*" element={<Layout><div className="section" style={{ textAlign: 'center', paddingTop: 'var(--space-16)' }}><h1>404</h1><p>Page not found</p></div></Layout>} />
        </Routes>
      </AnimatePresence>
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
