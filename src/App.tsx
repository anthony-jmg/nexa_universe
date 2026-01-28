import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import { CartProvider } from './contexts/CartContext';
import { FavoritesProvider } from './contexts/FavoritesContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';
import { Header } from './components/Header';

const Landing = lazy(() => import('./pages/Landing').then(m => ({ default: m.Landing })));
const SignIn = lazy(() => import('./pages/SignIn').then(m => ({ default: m.SignIn })));
const SignUp = lazy(() => import('./pages/SignUp').then(m => ({ default: m.SignUp })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const Academy = lazy(() => import('./pages/Academy').then(m => ({ default: m.Academy })));
const VideoPlayer = lazy(() => import('./pages/VideoPlayer').then(m => ({ default: m.VideoPlayer })));
const Professors = lazy(() => import('./pages/Professors').then(m => ({ default: m.Professors })));
const ProfessorDetail = lazy(() => import('./pages/ProfessorDetail').then(m => ({ default: m.ProfessorDetail })));
const ProfessorDashboard = lazy(() => import('./pages/ProfessorDashboard').then(m => ({ default: m.ProfessorDashboard })));
const ProgramDetail = lazy(() => import('./pages/ProgramDetail').then(m => ({ default: m.ProgramDetail })));
const Account = lazy(() => import('./pages/Account').then(m => ({ default: m.Account })));
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const Shop = lazy(() => import('./pages/Shop').then(m => ({ default: m.Shop })));
const Cart = lazy(() => import('./pages/Cart').then(m => ({ default: m.Cart })));
const Favorites = lazy(() => import('./pages/Favorites').then(m => ({ default: m.Favorites })));
const MyPurchases = lazy(() => import('./pages/MyPurchases').then(m => ({ default: m.MyPurchases })));
const Events = lazy(() => import('./pages/Events').then(m => ({ default: m.Events })));
const EventDetail = lazy(() => import('./pages/EventDetail').then(m => ({ default: m.EventDetail })));
const MyTickets = lazy(() => import('./pages/MyTickets').then(m => ({ default: m.MyTickets })));
const EventTicketPurchasePage = lazy(() => import('./pages/EventTicketPurchasePage').then(m => ({ default: m.EventTicketPurchasePage })));
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));

type Page = 'landing' | 'signin' | 'signup' | 'forgot-password' | 'reset-password' | 'academy' | 'video' | 'professors' | 'account' | 'admin' | 'shop' | 'cart' | 'favorites' | 'my-purchases' | 'professor-dashboard' | 'events' | 'event-detail' | 'my-tickets' | 'event-ticket-purchase' | 'notifications' | string;

type NavigationState = {
  page: Page;
  videoId?: string;
  professorId?: string;
  programId?: string;
  eventId?: string;
};

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [currentVideoId, setCurrentVideoId] = useState<string>('');
  const [currentProfessorId, setCurrentProfessorId] = useState<string>('');
  const [currentProgramId, setCurrentProgramId] = useState<string>('');
  const [currentEventId, setCurrentEventId] = useState<string>('');
  const [navigationHistory, setNavigationHistory] = useState<NavigationState[]>([]);
  const { user, loading } = useAuth();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');

    if (type === 'recovery') {
      setCurrentPage('reset-password');
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setCurrentPage('reset-password');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleNavigate = (page: string, videoId?: string) => {
    setNavigationHistory(prev => [...prev, {
      page: currentPage,
      videoId: currentVideoId,
      professorId: currentProfessorId,
      programId: currentProgramId,
      eventId: currentEventId
    }]);

    if (page === 'video' && videoId) {
      setCurrentVideoId(videoId);
      setCurrentPage('video');
    } else if (page.startsWith('video-')) {
      setCurrentVideoId(page.replace('video-', ''));
      setCurrentPage('video');
    } else if (page === 'professor-dashboard') {
      setCurrentPage('professor-dashboard');
    } else if (page.startsWith('professor-')) {
      setCurrentProfessorId(page.replace('professor-', ''));
      setCurrentPage('professor-detail');
    } else if (page.startsWith('program-')) {
      setCurrentProgramId(page.replace('program-', ''));
      setCurrentPage('program-detail');
    } else if (page === 'event-detail' && videoId) {
      setCurrentEventId(videoId);
      setCurrentPage('event-detail');
    } else {
      setCurrentPage(page as Page);
      if (videoId) {
        setCurrentVideoId(videoId);
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    if (navigationHistory.length > 0) {
      const previousState = navigationHistory[navigationHistory.length - 1];
      setNavigationHistory(prev => prev.slice(0, -1));

      setCurrentPage(previousState.page);
      setCurrentVideoId(previousState.videoId || '');
      setCurrentProfessorId(previousState.professorId || '');
      setCurrentProgramId(previousState.programId || '');
      setCurrentEventId(previousState.eventId || '');

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleNavigate('landing');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <img src="/nexa-logo.png" alt="NEXA" className="h-16 w-auto animate-pulse" />
            <span className="text-4xl font-light text-gray-900 tracking-wide animate-pulse">NEXA</span>
          </div>
          <div className="inline-block w-8 h-8 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    if (!user && ['video', 'account', 'admin', 'cart', 'favorites', 'my-purchases', 'professor-dashboard', 'program-detail', 'my-tickets', 'event-ticket-purchase', 'notifications'].includes(currentPage)) {
      return <SignIn onNavigate={handleNavigate} />;
    }

    switch (currentPage) {
      case 'landing':
        return <Landing onNavigate={handleNavigate} />;
      case 'signin':
        return <SignIn onNavigate={handleNavigate} />;
      case 'signup':
        return <SignUp onNavigate={handleNavigate} />;
      case 'forgot-password':
        return <ForgotPassword onNavigate={handleNavigate} />;
      case 'reset-password':
        return <ResetPassword onNavigate={handleNavigate} />;
      case 'academy':
        return <Academy onNavigate={handleNavigate} />;
      case 'video':
        return <VideoPlayer videoId={currentVideoId} onNavigate={handleNavigate} onBack={handleBack} />;
      case 'professors':
        return <Professors onNavigate={handleNavigate} />;
      case 'professor-detail':
        return <ProfessorDetail professorId={currentProfessorId} onNavigate={handleNavigate} onBack={handleBack} />;
      case 'professor-dashboard':
        return <ProfessorDashboard onNavigate={handleNavigate} />;
      case 'program-detail':
        return <ProgramDetail programId={currentProgramId} onNavigate={handleNavigate} onBack={handleBack} />;
      case 'account':
        return <Account onNavigate={handleNavigate} />;
      case 'admin':
        return <Admin onNavigate={handleNavigate} />;
      case 'shop':
        return <Shop onNavigate={handleNavigate} />;
      case 'cart':
        return <Cart onNavigate={handleNavigate} />;
      case 'favorites':
        return <Favorites onNavigate={handleNavigate} />;
      case 'my-purchases':
        return <MyPurchases onNavigate={handleNavigate} />;
      case 'events':
        return <Events onNavigate={handleNavigate} />;
      case 'event-detail':
        return <EventDetail eventId={currentEventId} onNavigate={handleNavigate} />;
      case 'my-tickets':
        return <MyTickets onNavigate={handleNavigate} />;
      case 'event-ticket-purchase':
        return <EventTicketPurchasePage onNavigate={handleNavigate} />;
      case 'notifications':
        return <NotificationsPage onNavigate={handleNavigate} />;
      default:
        return <NotFound onNavigate={handleNavigate} />;
    }
  };

  const showHeader = !['signin', 'signup', 'forgot-password', 'reset-password'].includes(currentPage);

  return (
    <div className="min-h-screen bg-white">
      <OfflineBanner />
      {showHeader && <Header onNavigate={handleNavigate} currentPage={currentPage} />}
      <Suspense fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="inline-block w-8 h-8 border-4 border-[#B8913D] border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        {renderPage()}
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <CartProvider>
              <FavoritesProvider>
                <AppContent />
              </FavoritesProvider>
            </CartProvider>
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
