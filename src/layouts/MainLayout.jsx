import { Outlet } from 'react-router-dom';
import Navbar from '@components/common/Navbar';
import Footer from '@components/common/Footer';

const MainLayout = () => (
  <div className="flex flex-col min-h-screen">
    <Navbar />
    <main className="flex-grow pt-16">
      <Outlet />
    </main>
    <Footer />
  </div>
);

export default MainLayout;
