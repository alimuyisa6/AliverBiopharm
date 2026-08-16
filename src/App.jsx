 /* src/App.jsx */
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, ProtectedRoute } from './contexts/AuthContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { ToastProvider } from './components/Toast/Toast';
import Layout from './components/Layout/Layout';
import ScrollMemory from './components/ScrollMemory';
import PageTransition from './components/PageTransition';
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

function AppRoutes() {
  const location = useLocation();

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
            <Route path="/quiz" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
            <Route path="/recall" element={<ProtectedRoute><Recall /></ProtectedRoute>} />
            <Route path="/flashcards" element={<ProtectedRoute><FlashcardsPage /></ProtectedRoute>} />
            <Route path="/classroom" element={<ProtectedRoute><Classroom /></ProtectedRoute>} />
            <Route path="/classroom/:roomId" element={<ProtectedRoute><ClassroomRoom /></ProtectedRoute>} />
            <Route path="/past-papers" element={<PastPapers />} />
            <Route path="/notes" element={<ProtectedRoute><NotesPage /></ProtectedRoute>} />
            <Route path="/notes/read" element={<ProtectedRoute><NoteDetail /></ProtectedRoute>} />
            <Route path="/pdfs" element={<ProtectedRoute><PdfLibraryPage /></ProtectedRoute>} />
            <Route path="/glossary/:slug" element={<ProtectedRoute><Glossary /></ProtectedRoute>} />
            <Route path="/glossary" element={<ProtectedRoute><Glossary /></ProtectedRoute>} />
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
          <AppRoutes />
        </ToastProvider>
      </LayoutProvider>
    </AuthProvider>
  );
}
