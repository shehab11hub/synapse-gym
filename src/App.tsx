import React, { useState, useEffect } from 'react';
import { WifiOff, X } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GymDataProvider, useGymData } from './context/GymDataContext';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { PageSkeleton } from './components/PageSkeleton';
import { LoginPage } from './pages/LoginPage';
import { ReceptionPage } from './pages/ReceptionPage';
import { SessionsPage } from './pages/SessionsPage';
import { PhysiotherapyPage } from './pages/PhysiotherapyPage';
import { TrainerAccountsPage } from './pages/TrainerAccountsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { MasterReportPage } from './pages/MasterReportPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { PosPage } from './pages/PosPage';
import { UsersPage } from './pages/UsersPage';
import { PlayerCheckInPage } from './pages/PlayerCheckInPage';
import { MembersSearchPage } from './pages/MembersSearchPage';
import { CoachPortalPage } from './pages/CoachPortalPage';

const GlobalNetworkErrorToast: React.FC = () => {
  const { networkError, clearNetworkError } = useGymData();
  if (!networkError) return null;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-xl w-[92%] bg-rose-600 text-white border-2 border-rose-300/60 rounded-2xl p-4 shadow-2xl shadow-rose-950/80 flex items-center justify-between gap-3 animate-scale-up"
      dir="rtl"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-white/15 shrink-0">
          <WifiOff className="w-5 h-5 text-white" />
        </div>
        <span className="text-xs sm:text-sm font-black leading-relaxed">{networkError}</span>
      </div>
      <button
        onClick={clearNetworkError}
        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 text-white shrink-0 cursor-pointer"
        aria-label="إغلاق التنبيه"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const MainDashboard: React.FC = () => {
  const { currentUser, canAccessPage } = useAuth();
  const { isInitialLoading } = useGymData();
  const [activeTab, setActiveTab] = useState('reception');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Enforce strict access control on both activeTab and direct browser URL paths
  useEffect(() => {
    if (currentUser) {
      if (!canAccessPage(activeTab)) {
        setActiveTab('reception');
      }
      if (typeof window !== 'undefined' && currentUser.role !== 'admin') {
        const path = window.location.pathname.toLowerCase();
        if (
          path.includes('master_report') ||
          path.includes('master-report') ||
          path.includes('analytics') ||
          path.includes('users')
        ) {
          window.history.replaceState({}, '', '/');
          setActiveTab('reception');
        }
      }
    }
  }, [currentUser, activeTab, canAccessPage]);

  if (!currentUser) {
    return <LoginPage />;
  }

  const renderActivePage = () => {
    if (isInitialLoading) {
      return <PageSkeleton />;
    }

    switch (activeTab) {
      case 'reception':
        return <ReceptionPage />;
      case 'members_search':
        return <MembersSearchPage />;
      case 'sessions':
        return <SessionsPage />;
      case 'physiotherapy':
        return <PhysiotherapyPage />;
      case 'trainers':
        return <TrainerAccountsPage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'master_report':
        return currentUser.role === 'admin' ? <MasterReportPage /> : <ReceptionPage />;
      case 'analytics':
        return currentUser.role === 'admin' ? <AnalyticsPage /> : <ReceptionPage />;
      case 'pos':
        return <PosPage />;
      case 'users':
        return currentUser.role === 'admin' ? <UsersPage /> : <ReceptionPage />;
      default:
        return <ReceptionPage />;
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-row selection:bg-teal-500 selection:text-white">
      {/* Role-Aware Sidebar (Hidden on mobile by default, drawer when opened) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <Topbar
          activeTab={activeTab}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
        />
        <main className="flex-1 pb-16">
          {renderActivePage()}
        </main>
      </div>
    </div>
  );
};


export default function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    return typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '/';
  });

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname.toLowerCase());
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Public Member Check-in Route (accessible directly without admin login when scanning Desk QR)
  const isCheckInRoute =
    currentPath.startsWith('/checkin') ||
    currentPath.startsWith('/scan');

  const isCoachRoute = currentPath.startsWith('/coach');

  return (
    <AuthProvider>
      <GymDataProvider>
        <GlobalNetworkErrorToast />
        {isCheckInRoute ? (
          <PlayerCheckInPage />
        ) : isCoachRoute ? (
          <CoachPortalPage
            onBackToStaffLogin={() => {
              if (window.history && window.history.pushState) {
                window.history.pushState({}, '', '/');
                setCurrentPath('/');
              }
            }}
          />
        ) : (
          <MainDashboard />
        )}
      </GymDataProvider>
    </AuthProvider>
  );
}
