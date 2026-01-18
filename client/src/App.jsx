import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { BookOpen, Crown, Shield, Star, Users, Package, Library, LayoutDashboard } from 'lucide-react';
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
import BookManagementPage from './pages/BookManagementPage';

import PolicyManagementPage from './pages/PolicyManagementPage';
import { QuotaWidget } from './components/QuotaWidget';
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
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl">
        <div className="container mx-auto flex items-center gap-4">
          {/* 1. Logo */}
          <Link to="/" className="flex shrink-0 items-center gap-2 text-xl font-bold text-slate-800 hover:opacity-80 transition">
            <span className="text-cyan-600 text-2xl">⚡</span>
            <span className="hidden md:inline">E-Library</span>
            <span className="md:hidden">ELib</span>
          </Link>

          {/* 2. Navigation */}
          <nav className="flex items-center gap-1 mr-auto">
            {isStaff && (
              <>
                <Link to="/staff" title="Staff Dashboard" className="flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition">
                  <LayoutDashboard className="h-4 w-4" /> <span className="hidden xl:inline">Dashboard</span>
                </Link>
                <Link to="/admin/members" className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-purple-50 hover:text-purple-600 transition whitespace-nowrap">
                  <Users className="h-4 w-4" /> <span className="hidden xl:inline">Members</span>
                </Link>
                <Link to="/admin/books" className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition whitespace-nowrap">
                  <Library className="h-4 w-4" /> <span className="hidden xl:inline">Books</span>
                </Link>
              </>
            )}
            {user?.role === 'ADMIN' && (
              <Link to="/admin/policy" className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 transition whitespace-nowrap">
                <Shield className="h-4 w-4" /> <span className="hidden xl:inline">Policy</span>
              </Link>
            )}

            <Link to="/my-loans" title="My Shelf" className="flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-cyan-50 hover:text-cyan-600 transition">
              <BookOpen className="h-4 w-4" /> <span className="hidden xl:inline">My Shelf</span>
            </Link>
            <Link to="/vip" className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-1.5 text-xs font-bold text-white shadow hover:shadow-md hover:scale-105 transition whitespace-nowrap ml-2">
              <Crown className="h-3.5 w-3.5" /> VIP
            </Link>
          </nav>

          {/* 3. User Actions (Right Aligned) */}
          <div className="flex items-center gap-4 shrink-0 bg-white pl-2">
            {/* Quota Widget (Desktop only) */}
            <div className="hidden lg:block">
              <QuotaWidget />
            </div>

            {/* User Info Compact */}
            <div className="hidden sm:flex flex-col items-end text-right leading-tight">
              <div className="flex items-center gap-2">
                <Link to="/profile" className="text-sm font-bold text-slate-800 hover:text-cyan-600 transition truncate max-w-[150px]">
                  {user?.fullName}
                </Link>
                {/* Role Badge */}
                {user?.role === 'ADMIN' && <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold text-yellow-700 border border-yellow-200">ADMIN</span>}
                {user?.role === 'STAFF' && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">STAFF</span>}
                {user?.isVip && <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">VIP</span>}

              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Link to="/wallet" className={cn("font-mono hover:underline", (user?.walletBalance || 0) < 0 ? "text-red-500" : "text-emerald-600")}>
                  {(user?.walletBalance || 0).toLocaleString()}đ
                </Link>
                <span className="text-slate-300">|</span>
                <span>{{ 'HN': 'Hanoi', 'HP': 'Haiphong', 'DN': 'Danang' }[user?.branchId] || user?.branchId}</span>
              </div>
            </div>

            <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>

            <button onClick={logout} className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition border border-slate-200">
              Logout
            </button>
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
              <Route path="/admin/books" element={<BookManagementPage />} />
              <Route path="/admin/policy" element={<PolicyManagementPage />} />

              <Route path="/profile" element={<UserProfile />} />
            </Route>
          </Route>

        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
