import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GymDataProvider } from './context/GymDataContext';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
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

const MainDashboard: React.FC = () => {
  const { currentUser, canAccessPage } = useAuth();
  const [activeTab, setActiveTab] = useState('reception');

  // Enforce access control if role changes or unauthorized page requested
  useEffect(() => {
    if (currentUser) {
      if (!canAccessPage(activeTab)) {
        setActiveTab('reception');
      }
    }
  }, [currentUser, activeTab, canAccessPage]);

  if (!currentUser) {
    return <LoginPage />;
  }

  const renderActivePage = () => {
    switch (activeTab) {
      case 'reception':
        return <ReceptionPage />;
      case 'sessions':
        return <SessionsPage />;
      case 'physiotherapy':
        return <PhysiotherapyPage />;
      case 'trainers':
        return <TrainerAccountsPage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'master_report':
        return <MasterReportPage />;
      case 'analytics':
        return <AnalyticsPage />;
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
      {/* Role-Aware Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <Topbar activeTab={activeTab} />
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

  return (
    <AuthProvider>
      <GymDataProvider>
        {isCheckInRoute ? <PlayerCheckInPage /> : <MainDashboard />}
      </GymDataProvider>
    </AuthProvider>
  );
}
