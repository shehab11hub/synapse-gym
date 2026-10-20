import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  login: (username: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  addUser: (user: Omit<User, 'id' | 'createdAt'>) => boolean;
  deleteUser: (id: string) => boolean;
  updateUserStatus: (id: string, active: boolean) => void;
  canAccessPage: (page: string) => boolean;
}

const DEFAULT_USERS: User[] = [
  {
    id: 'usr-admin-master',
    username: 'cahmed255u',
    password: 'cahmed255p',
    name: 'كابتن أحمد (المدير العام)',
    role: 'admin',
    phone: '01000000001',
    createdAt: new Date().toISOString(),
    active: true,
  },
  {
    id: 'usr-reception-1',
    username: 'reception',
    password: '123',
    name: 'سارة محمد (موظفة الاستقبال)',
    role: 'receptionist',
    phone: '01123456789',
    createdAt: new Date().toISOString(),
    active: true,
  },
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('synapse_users');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_USERS;
      }
    }
    return DEFAULT_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('synapse_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    localStorage.setItem('synapse_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('synapse_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('synapse_current_user');
    }
  }, [currentUser]);

  const login = (username: string, password: string) => {
    const found = users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
    );

    if (!found) {
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    }

    if (!found.active) {
      return { success: false, error: 'هذا الحساب معطل حالياً من قبل الإدارة' };
    }

    setCurrentUser(found);
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const addUser = (userData: Omit<User, 'id' | 'createdAt'>) => {
    // Check username uniqueness
    if (users.some((u) => u.username.toLowerCase() === userData.username.trim().toLowerCase())) {
      return false;
    }

    const newUser: User = {
      ...userData,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    setUsers((prev) => [...prev, newUser]);
    return true;
  };

  const deleteUser = (id: string) => {
    // Don't delete master admin
    if (id === 'usr-admin-master') return false;
    setUsers((prev) => prev.filter((u) => u.id !== id));
    return true;
  };

  const updateUserStatus = (id: string, active: boolean) => {
    if (id === 'usr-admin-master') return;
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, active } : u))
    );
  };

  const canAccessPage = (page: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;

    // Receptionist access permissions:
    // Page 1 (reception), Page 2 (sessions), Page 3 (physio), Page 4 (trainers - requested), expenses, master_report, pos, analytics
    const receptionistAllowed = [
      'reception',
      'sessions',
      'physiotherapy',
      'trainers',
      'expenses',
      'master_report',
      'pos',
      'analytics',
    ];
    return receptionistAllowed.includes(page);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        login,
        logout,
        addUser,
        deleteUser,
        updateUserStatus,
        canAccessPage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
