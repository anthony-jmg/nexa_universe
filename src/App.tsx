import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import { CartProvider } from './contexts/CartContext';
import { FavoritesProvider } from './contexts/FavoritesContext';
import { NotificationProvider } from './contexts/NotificationContext';
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
  // Check for recovery token BEFORE initializing the page state
  const getInitialPage = (): Page => {
    const url = window.location.href;
    const hash = window.location.hash;

    console.log('=== Initial page detection ===');
    console.log('Full URL:', url);
    console.log('Hash:', hash);

    // Check for recovery token in various formats
    const hasRecoveryToken =
      hash.includes('type=recovery') ||
      hash.includes('access_token') ||
      url.includes('type=recovery') ||
      url.includes('#access_token=');

    if (hasRecoveryToken) {
      console.log('✅ Recovery token detected on initial load - redirecting to reset-password');
      return 'reset-password';
    }

    console.log('❌ No recovery token found - showing landing page');
    return 'landing';
  };

  const [currentPage, setCurrentPage] = useState<Page>(getInitialPage());
  const [currentVideoId, setCurrentVideoId] = useState<string>('');
  const [currentProfessorId, setCurrentProfessorId] = useState<string>('');
  const [currentProgramId, setCurrentProgramId] = useState<string>('');
  const [currentEventId, setCurrentEventId] = useState<string>('');
  const [currentProductId, setCurrentProductId] = useState<string>('');
  const { user, loading } = useAuth();

  // Build URL path from current state
  const buildPath = (page: Page, videoId?: string, professorId?: string, programId?: string, eventId?: string): string => {
    if (page === 'video' && videoId) return `/video/${videoId}`;
    if (page === 'professor-detail' && professorId) return `/professor/${professorId}`;
    if (page === 'program-detail' && programId) return `/program/${programId}`;
    if (page === 'event-detail' && eventId) return `/event/${eventId}`;
    if (page === 'landing') return '/';
    return `/${page}`;
  };

  // Parse URL path to state
  const parsePathToState = (path: string): NavigationState | null => {
    if (path === '/' || path === '') return { page: 'landing' };

    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return { page: 'landing' };

    const [first, second] = parts;

    if (first === 'video' && second) return { page: 'video', videoId: second };
    if (first === 'professor' && second) return { page: 'professor-detail', professorId: second };
    if (first === 'program' && second) return { page: 'program-detail', programId: second };
    if (first === 'event' && second) return { page: 'event-detail', eventId: second };

    return { page: first as Page };
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setCurrentPage('reset-password');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initialize state from URL on mount
  useEffect(() => {
    // Check for recovery token first (takes priority)
    const hash = window.location.hash;
    const hasRecoveryToken = hash.includes('type=recovery') || hash.includes('access_token');

    if (hasRecoveryToken) {
      // Don't modify URL for recovery flow
      return;
    }

    const currentPath = window.location.pathname;
    const stateFromPath = parsePathToState(currentPath);

    if (stateFromPath && stateFromPath.page !== 'landing') {
      setCurrentPage(stateFromPath.page);
      if (stateFromPath.videoId) setCurrentVideoId(stateFromPath.videoId);
      if (stateFromPath.professorId) setCurrentProfessorId(stateFromPath.professorId);
      if (stateFromPath.programId) setCurrentProgramId(stateFromPath.programId);
      if (stateFromPath.eventId) setCurrentEventId(stateFromPath.eventId);

      // Initialize browser history state
      window.history.replaceState(
        {
          page: stateFromPath.page,
          videoId: stateFromPath.videoId,
          professorId: stateFromPath.professorId,
          programId: stateFromPath.programId,
          eventId: stateFromPath.eventId
        },
        '',
        currentPath
      );
    } else if (currentPage !== 'reset-password') {
      // Initialize browser history with current state only if not on password reset page
      const initialPath = buildPath(currentPage, currentVideoId, currentProfessorId, currentProgramId, currentEventId);
      window.history.replaceState(
        {
          page: currentPage,
          videoId: currentVideoId,
          professorId: currentProfessorId,
          programId: currentProgramId,
          eventId: currentEventId
        },
        '',
        initialPath
      );
    }
  }, []);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state) {
        setCurrentPage(event.state.page || 'landing');
        setCurrentVideoId(event.state.videoId || '');
        setCurrentProfessorId(event.state.professorId || '');
        setCurrentProgramId(event.state.programId || '');
        setCurrentEventId(event.state.eventId || '');
      } else {
        // Fallback: parse from URL
        const stateFromPath = parsePathToState(window.location.pathname);
        if (stateFromPath) {
          setCurrentPage(stateFromPath.page);
          setCurrentVideoId(stateFromPath.videoId || '');
          setCurrentProfessorId(stateFromPath.professorId || '');
          setCurrentProgramId(stateFromPath.programId || '');
          setCurrentEventId(stateFromPath.eventId || '');
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (page: string, videoId?: string) => {
    let newPage: Page = page as Page;
    let newVideoId = currentVideoId;
    let newProfessorId = currentProfessorId;
    let newProgramId = currentProgramId;
    let newEventId = currentEventId;

    if (page === 'video' && videoId) {
      newVideoId = videoId;
      newPage = 'video';
    } else if (page.startsWith('video-')) {
      newVideoId = page.replace('video-', '');
      newPage = 'video';
    } else if (page === 'professor-dashboard') {
      newPage = 'professor-dashboard';
    } else if (page.startsWith('shop-')) {
      newPage = 'shop';
      setCurrentProductId(page.replace('shop-', ''));
    } else if (page === 'shop') {
      newPage = 'shop';
      setCurrentProductId('');
    } else if (page.startsWith('professor-')) {
      newProfessorId = page.replace('professor-', '');
      newPage = 'professor-detail';
    } else if (page.startsWith('program-')) {
      newProgramId = page.replace('program-', '');
      newPage = 'program-detail';
    } else if (page === 'event-detail' && videoId) {
      newEventId = videoId;
      newPage = 'event-detail';
    } else {
      newPage = page as Page;
      if (videoId) {
        newVideoId = videoId;
      }
    }

    // Update browser history
    const newPath = buildPath(newPage, newVideoId, newProfessorId, newProgramId, newEventId);
    window.history.pushState(
      {
        page: newPage,
        videoId: newVideoId,
        professorId: newProfessorId,
        programId: newProgramId,
        eventId: newEventId
      },
      '',
      newPath
    );

    // Update internal state
    setCurrentPage(newPage);
    setCurrentVideoId(newVideoId);
    setCurrentProfessorId(newProfessorId);
    setCurrentProgramId(newProgramId);
    setCurrentEventId(newEventId);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    window.history.back();
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
        return <Shop onNavigate={handleNavigate} initialProductId={currentProductId || undefined} />;
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
                <NotificationProvider>
                  <AppContent />
                </NotificationProvider>
              </FavoritesProvider>
            </CartProvider>
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
