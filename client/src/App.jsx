import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Catalog from './pages/Catalog';
import BookDetail from './pages/BookDetail';

import MyLoans from './pages/MyLoans';
import StaffDashboard from './pages/StaffDashboard';
import WalletPage from './pages/WalletPage';
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
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-900/80 p-4 shadow-lg backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-white flex items-center gap-2 hover:opacity-80 transition">
            <span className="text-cyan-500 text-2xl">⚡</span> E-Library <span className="hidden sm:inline text-xs font-normal text-slate-400">Sharded Cluster</span>
          </Link>
          <div className="flex items-center gap-4">
            {isStaff && (
              <Link to="/staff" className="flex items-center gap-2 rounded-lg bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition">
                Dashboard
              </Link>
            )}
            <Link to="/my-loans" className="flex items-center gap-2 rounded-lg bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition">
              <BookOpen className="h-4 w-4" /> My Shelf
            </Link>

            <div className="hidden text-right sm:block">
              <div className="flex items-center justify-end gap-2">
                <p className="text-sm font-medium text-white">{user?.fullName}</p>
                {user?.subscription?.plan === 'VIP' && (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">VIP</span>
                )}
                {isStaff && (
                  <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-500/30">STAFF</span>
                )}
              </div>
              <Link to="/wallet" className="text-xs text-slate-400 hover:text-white transition">
                Wallet: <span className={cn("font-mono", (user?.walletBalance || 0) < 0 ? "text-red-400" : "text-emerald-400")}>{(user?.walletBalance || 0).toLocaleString()}đ</span>
              </Link>
            </div>
            <button onClick={logout} className="rounded bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 active:scale-95 transition">Logout</button>
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
              <Route path="/staff" element={<StaffDashboard />} />
            </Route>
          </Route>

        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
