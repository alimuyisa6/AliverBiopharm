import { Outlet, Link } from 'react-router-dom';
import { APP_NAME } from '@utils/constants';

const AuthLayout = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-dark-900 dark:to-dark-800 px-4 py-12">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <Link to="/">
          <h1 className="text-3xl font-heading font-bold text-primary-600 dark:text-primary-400">{APP_NAME}</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">Your Gateway to Biology & Pharmacy Excellence</p>
        </Link>
      </div>
      <div className="card p-8">
        <Outlet />
      </div>
      <p className="text-center text-sm text-dark-400 mt-6">&copy; {new Date().getFullYear()} {APP_NAME}</p>
    </div>
  </div>
);

export default AuthLayout;
