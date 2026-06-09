import { Routes, Route } from 'react-router-dom';
import MainLayout from '@layouts/MainLayout';
import AuthLayout from '@layouts/AuthLayout';
import ProtectedRoute from '@components/common/ProtectedRoute';

import HomePage from '@pages/public/HomePage';
import OLevelBiology from '@pages/OLevelBiology';

import LoginPage from '@pages/auth/LoginPage';
import RegisterPage from '@pages/auth/RegisterPage';
import ForgotPasswordPage from '@pages/auth/ForgotPasswordPage';

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes with main layout */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        
        {/* Protected routes */}
        <Route
          path="/notes/olevel"
          element={
            <ProtectedRoute>
              <OLevelBiology />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Auth routes (no header/footer) */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
