 import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LegalDataProvider } from './context/LegalDataContext';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/HomePage';
import OLevelBiology from './pages/notes/OLevelBiology';
import ALevelBiology from './pages/notes/ALevelBiology';
import PharmacyBiology from './pages/notes/PharmacyBiology';
import TermsOfService from './pages/legal/TermsOfService';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import NotePage from './pages/notes/NotePage';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LegalDataProvider>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/index.html" element={<Navigate to="/" replace />} />
              <Route path="/notes/olevel" element={<OLevelBiology />} />
              <Route path="/notes/alevel" element={<ALevelBiology />} />
              <Route path="/notes/pharmacy" element={<PharmacyBiology />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/note/:id" element={<NotePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </LegalDataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
