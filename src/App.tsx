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
        // NOW VISIBLE TO RECEPTIONIST AS REQUESTED
        return <TrainerAccountsPage />;
      case 'expenses':
        // NEW EXPENSES & CASH DRAWER PAGE
        return <ExpensesPage />;
      case 'master_report':
        // COMPREHENSIVE EXCEL LEDGER & NEW MONTH
        return <MasterReportPage />;
      case 'analytics':
        // NEW FINANCIAL ANALYTICS & BI CHARTS PAGE
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
  return (
    <AuthProvider>
      <GymDataProvider>
        <MainDashboard />
      </GymDataProvider>
    </AuthProvider>
  );
}
