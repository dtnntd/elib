import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { BookOpen, Crown, Shield, Star, Users } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Catalog from './pages/Catalog';
import BookDetail from './pages/BookDetail';

import MyLoans from './pages/MyLoans';
import StaffDashboard from './pages/StaffDashboard';
import StatsDashboard from './pages/StatsDashboard';
import WalletPage from './pages/WalletPage';
import UserProfile from './pages/UserProfile';
import VIPPage from './pages/VIPPage';
import AdminMembersPage from './pages/AdminMembersPage';
import { cn } from './lib/utils';

// Protected Route Component
const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center text-white">Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  return <Outlet />;
};

// Layout for Authenticated Users
const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const isStaff = user?.role === 'ADMIN' || user?.role === 'STAFF';

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-slate-800 flex items-center gap-2 hover:opacity-80 transition">
            <span className="text-cyan-600 text-2xl">⚡</span> E-Library <span className="hidden sm:inline text-xs font-normal text-slate-500">Sharded Cluster</span>
          </Link>
          <div className="flex items-center gap-4">
            {isStaff && (
              <Link to="/staff" className="flex items-center gap-2 rounded-lg bg-indigo-50 text-indigo-600 px-4 py-2 text-sm font-bold hover:bg-indigo-100 transition border border-indigo-100">
                Dashboard
              </Link>
            )}
            {isStaff && (
              <Link to="/stats/dashboard" className="flex items-center gap-2 rounded-lg bg-emerald-50 text-emerald-600 px-3 py-2 text-sm font-bold hover:bg-emerald-100 transition border border-emerald-100">
                Analytics
              </Link>
            )}
            {isStaff && (
              <Link to="/admin/members" className="flex items-center gap-2 rounded-lg bg-purple-50 text-purple-600 px-3 py-2 text-sm font-bold hover:bg-purple-100 transition border border-purple-100">
                <Users className="h-4 w-4" /> Members
              </Link>
            )}
            <Link to="/my-loans" className="flex items-center gap-2 rounded-lg bg-cyan-50 text-cyan-700 px-4 py-2 text-sm font-bold hover:bg-cyan-100 transition border border-cyan-100">
              <BookOpen className="h-4 w-4" /> My Shelf
            </Link>
            <Link to="/vip" className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 text-sm font-bold hover:scale-105 transition shadow-md">
              <Crown className="h-4 w-4" /> VIP
            </Link>

            <div className="hidden text-right sm:block border-l border-slate-200 pl-4 ml-2">
              <div className="flex items-center justify-end gap-2">
                <Link to="/profile" className="text-sm font-bold text-slate-800 hover:text-cyan-600 transition flex items-center gap-2">
                  {user?.fullName}
                </Link>
                {user?.role === 'ADMIN' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-extrabold text-yellow-700 border border-yellow-200">
                    <Crown className="h-3 w-3" /> ADMIN
                  </span>
                )}
                {user?.role === 'STAFF' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-700 border border-blue-200">
                    <Shield className="h-3 w-3" /> STAFF
                  </span>
                )}
                {user?.isVip && user?.role !== 'ADMIN' && user?.role !== 'STAFF' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-extrabold text-purple-700 border border-purple-200">
                    <Star className="h-3 w-3" /> VIP
                  </span>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 mt-0.5">
                <Link to="/wallet" className="text-xs text-slate-500 hover:text-slate-800 transition">
                  Wallet: <span className={cn("font-mono font-bold", (user?.walletBalance || 0) < 0 ? "text-red-500" : "text-emerald-600")}>{(user?.walletBalance || 0).toLocaleString()}đ</span>
                </Link>
                <span className="text-slate-300">|</span>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  Branch: <span className="text-slate-700 font-semibold">{
                    { 'HN': 'Hanoi', 'HP': 'Haiphong', 'DN': 'Danang' }[user?.branchId] || user?.branchId
                  }</span>
                </p>
              </div>
            </div>
            <button onClick={logout} className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-100 transition border border-rose-100">Logout</button>
          </div>
        </div>
      </header>
      <main className="container mx-auto flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Catalog />} />
              <Route path="/books/:id" element={<BookDetail />} />
              <Route path="/my-loans" element={<MyLoans />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/vip" element={<VIPPage />} />
              <Route path="/staff" element={<StaffDashboard />} />
              <Route path="/stats/dashboard" element={<StatsDashboard />} />
              <Route path="/admin/members" element={<AdminMembersPage />} />
              <Route path="/profile" element={<UserProfile />} />
            </Route>
          </Route>

        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
