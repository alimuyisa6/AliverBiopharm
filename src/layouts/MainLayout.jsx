  import { Outlet } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import AuthModal from '../components/common/AuthModal';
import ChatWidget from '../components/common/ChatWidget';

function MainLayout() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        <Outlet />
      </main>
      <Footer />
      <AuthModal />
      <ChatWidget />
      {/* Back to top, sticky CTA, resource modal are handled inside HomePage */}
    </>
  );
}

export default MainLayout;
