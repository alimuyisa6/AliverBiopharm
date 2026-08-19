 /* src/App.jsx */
import { Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, ProtectedRoute } from './contexts/AuthContext';
import { LayoutProvider, useLayout } from './contexts/LayoutContext';
import { ToastProvider } from './components/Toast/Toast';
import Layout from './components/Layout/Layout';
import ScrollMemory from './components/ScrollMemory';
import PageTransition from './components/PageTransition';
import Spinner from './components/Spinner/Spinner';
import ChartRegistry from './components/charts/ChartRegistry';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Quiz from './pages/Quiz';
import FlashcardsPage from './pages/FlashcardsPage';
import Classroom from './pages/Classroom';
import ClassroomRoom from './pages/ClassroomRoom';
import PastPapers from './pages/PastPapers';
import NoteDetail from './pages/NoteDetail';
import NotesPage from './pages/NotesPage';
import PdfLibraryPage from './pages/PdfLibraryPage';
import Glossary from './pages/Glossary';
import Recall from './pages/Recall';
import AboutPage from './pages/AboutPage';
import LegalPage from './pages/LegalPage';
import Auth from './pages/Auth';
import TutorApply from './pages/TutorApply';
import TutorDashboard from './pages/TutorDashboard';
import TutorMarketplace from './pages/TutorMarketplace';

function GlobalLoader() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'var(--bg-page)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      transition: 'opacity 0.5s ease, visibility 0.5s ease'
    }}>
      <Spinner context="brand" size="lg" />
    </div>
  );
}

function SetupRequired() {
  return (
    <div className="section setup-required-section">
      <div className="card setup-required-card">
        <div className="setup-required-icon">
          <span>🔬</span>
        </div>
        <h1 className="setup-required-title">Complete Your Profile</h1>
        <p className="setup-required-text">
          To access learning resources, please create an account and select your level and class.
        </p>
        <div className="setup-required-actions">
          <a href="/register" className="btn btn-primary btn-lg">Create Account</a>
          <a href="/login" className="btn btn-secondary btn-lg">Sign In</a>
        </div>
      </div>
    </div>
  );
}

function FeatureRoute({ feature, children }) {
  const { features } = useLayout();
  const enabled = features[feature] ?? true;

  if (!enabled) {
    return (
      <div className="section feature-disabled-section">
        <div className="card feature-disabled-card">
          <h2 className="feature-disabled-title">Feature Unavailable</h2>
          <p className="feature-disabled-text">
            This feature is not currently available for your level. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  return children;
}

function AppRoutes() {
  const location = useLocation();
  const [appLoading, setAppLoading] = useState(true);
  const { level, loading: layoutLoading, isAuthenticated } = useLayout();

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (appLoading) {
    return <GlobalLoader />;
  }

  const needsSetup = !layoutLoading && !level && !location.pathname.startsWith('/login') && !location.pathname.startsWith('/register') && !location.pathname.startsWith('/about') && !location.pathname.startsWith('/terms') && !location.pathname.startsWith('/privacy') && location.pathname !== '/';

  if (needsSetup) {
    return <SetupRequired />;
  }

  return (
    <>
      <ScrollMemory />
      <PageTransition key={location.pathname}>
        <Layout>
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/register" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/quiz" element={<ProtectedRoute><FeatureRoute feature="quizzes"><Quiz /></FeatureRoute></ProtectedRoute>} />
            <Route path="/recall" element={<ProtectedRoute><FeatureRoute feature="recall"><Recall /></FeatureRoute></ProtectedRoute>} />
            <Route path="/flashcards" element={<ProtectedRoute><FeatureRoute feature="flashcards"><FlashcardsPage /></FeatureRoute></ProtectedRoute>} />
            <Route path="/classroom" element={<ProtectedRoute><FeatureRoute feature="classrooms"><Classroom /></FeatureRoute></ProtectedRoute>} />
            <Route path="/classroom/:roomId" element={<ProtectedRoute><FeatureRoute feature="classrooms"><ClassroomRoom /></FeatureRoute></ProtectedRoute>} />
            <Route path="/past-papers" element={<FeatureRoute feature="past_papers"><PastPapers /></FeatureRoute>} />
            <Route path="/notes" element={<ProtectedRoute><NotesPage /></ProtectedRoute>} />
            <Route path="/notes/read" element={<ProtectedRoute><NoteDetail /></ProtectedRoute>} />
            <Route path="/pdfs" element={<ProtectedRoute><PdfLibraryPage /></ProtectedRoute>} />
            <Route path="/glossary/:slug" element={<ProtectedRoute><FeatureRoute feature="glossary"><Glossary /></FeatureRoute></ProtectedRoute>} />
            <Route path="/glossary" element={<ProtectedRoute><FeatureRoute feature="glossary"><Glossary /></FeatureRoute></ProtectedRoute>} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/terms" element={<LegalPage type="terms" />} />
            <Route path="/privacy" element={<LegalPage type="privacy" />} />
            <Route path="/tutor/apply" element={<ProtectedRoute><TutorApply /></ProtectedRoute>} />
            <Route path="/tutor/dashboard" element={<ProtectedRoute><TutorDashboard /></ProtectedRoute>} />
            <Route path="/tutors" element={<TutorMarketplace />} />
            <Route path="*" element={<div className="section"><h1>404</h1><p>Page not found</p></div>} />
          </Routes>
        </Layout>
      </PageTransition>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LayoutProvider>
        <ToastProvider>
          <ChartRegistry />
          <AppRoutes />
        </ToastProvider>
      </LayoutProvider>
    </AuthProvider>
  );
}
