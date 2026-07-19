 import { useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, ProtectedRoute } from './contexts/AuthContext';
import { LayoutProvider } from './contexts/LayoutContext';
import Layout from './components/Layout';
import AdminLauncher from './components/AdminLauncher';
import Auth from './pages/Auth';
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
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import OnboardingFlow from './pages/OnboardingFlow';

const scrollPositions = {};

function ScrollManager() {
  const location = useLocation();
  const prevPathRef = useRef(null);
  const restoreAttemptsRef = useRef(0);

  useEffect(() => {
    const key = location.pathname;
    const prevPath = prevPathRef.current;
    if (prevPath && prevPath !== key) scrollPositions[prevPath] = window.scrollY;
    prevPathRef.current = key;
    const savedY = scrollPositions[key];
    restoreAttemptsRef.current = 0;
    let userScrolled = false;
    const cancelRestore = () => { userScrolled = true; };
    if (savedY !== undefined) {
      window.addEventListener('touchstart', cancelRestore, { passive: true });
      window.addEventListener('wheel', cancelRestore, { passive: true });
      const attemptRestore = () => {
        if (userScrolled) return;
        const maxHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
        const viewportHeight = window.innerHeight;
        const maxScrollY = maxHeight - viewportHeight;
        if (maxScrollY >= savedY - 100 || restoreAttemptsRef.current >= 30) { window.scrollTo(0, Math.min(savedY, Math.max(0, maxScrollY))); return; }
        restoreAttemptsRef.current++;
        requestAnimationFrame(attemptRestore);
      };
      requestAnimationFrame(attemptRestore);
    } else window.scrollTo(0, 0);
    let saveTimer;
    const handleScroll = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { scrollPositions[key] = window.scrollY; }, 150); };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => { window.removeEventListener('scroll', handleScroll); window.removeEventListener('touchstart', cancelRestore); window.removeEventListener('wheel', cancelRestore); clearTimeout(saveTimer); scrollPositions[key] = window.scrollY; };
  }, [location.pathname]);
  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <ScrollManager />
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/login" element={<Layout><Auth /></Layout>} />
        <Route path="/register" element={<Layout><Auth /></Layout>} />
        <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
        <Route path="/profile" element={<Layout><Profile /></Layout>} />
        <Route path="/onboarding" element={<Layout><OnboardingFlow /></Layout>} />
        <Route path="/quiz" element={<Layout><ProtectedRoute><Quiz /></ProtectedRoute></Layout>} />
        <Route path="/past-papers" element={<Layout><PastPapers /></Layout>} />
        <Route path="/recall" element={<Layout><ProtectedRoute><BioRecall /></ProtectedRoute></Layout>} />
        <Route path="/notes/read" element={<Layout><ProtectedRoute><NoteDetail /></ProtectedRoute></Layout>} />
        <Route path="/glossary/:slug" element={<Layout><ProtectedRoute><Glossary /></ProtectedRoute></Layout>} />
        <Route path="/glossary" element={<Layout><ProtectedRoute><Glossary /></ProtectedRoute></Layout>} />
        <Route path="/lab" element={<Layout><ProtectedRoute><LearningLab /></ProtectedRoute></Layout>} />
        <Route path="/about" element={<Layout><AboutPage /></Layout>} />
        <Route path="/flashcards" element={<Layout><ProtectedRoute><FlashcardsPage /></ProtectedRoute></Layout>} />
        <Route path="/terms" element={<Layout><LegalPage type="terms" /></Layout>} />
        <Route path="/privacy" element={<Layout><LegalPage type="privacy" /></Layout>} />
        <Route path="/classroom" element={<Layout><ProtectedRoute><Classroom /></ProtectedRoute></Layout>} />
        <Route path="/classroom/:roomId" element={<Layout><ProtectedRoute><ClassroomRoom /></ProtectedRoute></Layout>} />
        <Route path="/tutor/apply" element={<Layout><ProtectedRoute><TutorApply /></ProtectedRoute></Layout>} />
        <Route path="/tutor/dashboard" element={<Layout><ProtectedRoute><TutorDashboard /></ProtectedRoute></Layout>} />
        <Route path="/info/:slug" element={<Layout><InfoPage /></Layout>} />
        <Route path="*" element={<Layout><div className="section" style={{ textAlign: 'center', paddingTop: '6rem' }}><h1 className="section-title">404</h1><p className="section-subtitle">Page not found</p></div></Layout>} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return <AuthProvider><LayoutProvider><AnimatedRoutes /><AdminLauncher /></LayoutProvider></AuthProvider>;
}

export default App;
