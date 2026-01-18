import { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { Loader2, TrendingUp, Users, BookOpen, DollarSign, Building, Search, AlertCircle, Clock, ChevronLeft, ChevronRight, Crown, AlertTriangle, BarChart3 } from 'lucide-react';
import api from '../api/axios';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

const BRANCHES = [
    { id: 'HN', name: 'Hanoi Branch' },
    { id: 'HP', name: 'Haiphong Branch' },
    { id: 'DN', name: 'Danang Branch' },
];

export default function StatsDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [trends, setTrends] = useState([]);
    const [members, setMembers] = useState([]);
    const [circulation, setCirculation] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedBranch, setSelectedBranch] = useState(user?.role === 'ADMIN' ? '' : user?.branchId || '');
    const [activeTab, setActiveTab] = useState('OVERVIEW'); // OVERVIEW, ANALYTICS, MEMBERS, CIRCULATION, REPORTS

    // New data states
    const [topSubjects, setTopSubjects] = useState([]);
    const [memberTypes, setMemberTypes] = useState([]);
    const [loansByBranch, setLoansByBranch] = useState([]);
    const [inventoryByBranch, setInventoryByBranch] = useState([]);
    const [revenueTrend, setRevenueTrend] = useState([]);
    const [topBooks, setTopBooks] = useState([]);
    const [overdueSummary, setOverdueSummary] = useState([]);
    const [expiringVIP, setExpiringVIP] = useState([]);

    // Pagination State
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [currentPage, setCurrentPage] = useState(1);

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedBranch, activeTab, itemsPerPage]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = selectedBranch ? { branchId: selectedBranch } : {};

            if (activeTab === 'OVERVIEW') {
                const [statsRes, trendsRes] = await Promise.all([
                    api.get('/stats/dashboard', { params }),
                    api.get('/stats/trends', { params })
                ]);
                setStats(statsRes.data);
                const formattedTrends = (trendsRes.data || []).map(item => ({
                    name: `${item._id.month}/${item._id.year}`,
                    loans: item.count
                }));
                setTrends(formattedTrends);
            } else if (activeTab === 'ANALYTICS') {
                const [subjectsRes, memberTypesRes, loansBranchRes, inventoryRes, revenueRes] = await Promise.all([
                    api.get('/stats/top-subjects'),
                    api.get('/stats/member-types', { params }),
                    api.get('/stats/loans-by-branch'),
                    api.get('/stats/inventory-by-branch'),
                    api.get('/stats/revenue-trend')
                ]);
                setTopSubjects(subjectsRes.data || []);
                setMemberTypes(memberTypesRes.data || []);
                setLoansByBranch(loansBranchRes.data || []);
                setInventoryByBranch(inventoryRes.data || []);
                const formattedRevenue = (revenueRes.data || []).map(item => ({
                    name: `${item.month}/${item.year}`,
                    revenue: item.revenue
                }));
                setRevenueTrend(formattedRevenue);
            } else if (activeTab === 'MEMBERS') {
                const res = await api.get('/stats/members', { params });
                setMembers(res.data);
            } else if (activeTab === 'CIRCULATION') {
                const res = await api.get('/stats/circulation', { params });
                setCirculation(res.data);
            } else if (activeTab === 'REPORTS') {
                const [topBooksRes, overdueRes, expiringRes] = await Promise.all([
                    api.get('/stats/top-books', { params }),
                    api.get('/stats/overdue-summary'),
                    api.get('/stats/expiring-vip', { params })
                ]);
                setTopBooks(topBooksRes.data || []);
                setOverdueSummary(overdueRes.data || []);
                setExpiringVIP(expiringRes.data || []);
            }

        } catch (error) {
            console.error("Failed to fetch analytics", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedBranch, activeTab]);

    const COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b'];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header & Filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h2>
                    <p className="text-slate-500 text-sm">Overview of library performance and metrics</p>
                </div>

                <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    <div className="p-2 bg-slate-50 rounded-lg">
                        <Building className="h-5 w-5 text-slate-400" />
                    </div>
                    {user?.role === 'ADMIN' ? (
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="bg-transparent font-medium text-slate-700 outline-none border-none focus:ring-0 cursor-pointer min-w-[150px]"
                        >
                            <option value="">All Branches</option>
                            {BRANCHES.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    ) : (
                        <div className="px-2 font-medium text-slate-700 min-w-[150px]">
                            {BRANCHES.find(b => b.id === user?.branchId)?.name || user?.branchId || 'My Branch'}
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-200 overflow-x-auto">
                {['OVERVIEW', 'ANALYTICS', 'MEMBERS', 'CIRCULATION', 'REPORTS'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn("pb-3 text-sm font-bold transition border-b-2",
                            activeTab === tab ? "border-cyan-500 text-cyan-700" : "border-transparent text-slate-500 hover:text-slate-700"
                        )}
                    >
                        {tab === 'OVERVIEW' && 'Overview'}
                        {tab === 'ANALYTICS' && '📊 Analytics'}
                        {tab === 'MEMBERS' && 'Member Stats'}
                        {tab === 'CIRCULATION' && 'Active Circulation'}
                        {tab === 'REPORTS' && '📋 Reports'}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-cyan-500" /></div>
            ) : (
                <>
                    {/* OVERVIEW TAB */}
                    {activeTab === 'OVERVIEW' && stats && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* KPI Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <StatCard
                                    title="Total Books"
                                    value={stats.totalBooks}
                                    icon={<BookOpen className="h-5 w-5 text-cyan-600" />}
                                    color="bg-cyan-100 border-cyan-200 text-cyan-700"
                                    trend={selectedBranch ? "Catalog (Global)" : "Total Catalog"}
                                />
                                <StatCard
                                    title="Total Members"
                                    value={stats.totalMembers}
                                    icon={<Users className="h-5 w-5 text-purple-600" />}
                                    color="bg-purple-100 border-purple-200 text-purple-700"
                                    trend={selectedBranch ? "In Branch" : "All Branches"}
                                />
                                <StatCard
                                    title="Active Loans"
                                    value={stats.activeLoans}
                                    icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
                                    color="bg-emerald-100 border-emerald-200 text-emerald-700"
                                    trend="Currently Borrowed"
                                />
                                <StatCard
                                    title="Total Revenue"
                                    value={`${stats.totalRevenue.toLocaleString()} đ`}
                                    icon={<DollarSign className="h-5 w-5 text-amber-600" />}
                                    color="bg-amber-100 border-amber-200 text-amber-700"
                                    trend="Deposits Collected"
                                />
                            </div>

                            {/* Charts Section */}
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                        Monthly Borrowing Trends <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{selectedBranch || "Global"}</span>
                                    </h3>
                                    <div className="h-[300px] w-full min-h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={trends}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                    itemStyle={{ color: '#0891b2' }}
                                                    cursor={{ fill: '#f1f5f9' }}
                                                />
                                                <Bar dataKey="loans" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={40} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-6">Loan Distribution</h3>
                                    <div className="h-[300px] w-full flex items-center justify-center min-h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Physical', value: stats.activeLoans > 0 ? stats.activeLoans : 10 },
                                                        { name: 'E-Book', value: 5 }
                                                    ]}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {COLORS.map((color, index) => (
                                                        <Cell key={`cell-${index}`} fill={color} strokeWidth={0} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-slate-600 font-medium">{value}</span>} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ANALYTICS TAB */}
                    {activeTab === 'ANALYTICS' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Row 1: Revenue Trend */}
                            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <DollarSign className="h-5 w-5 text-emerald-600" /> Revenue Trend (Last 6 Months)
                                </h3>
                                <div className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={revenueTrend}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                            <XAxis dataKey="name" fontSize={12} />
                                            <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                            <Tooltip formatter={(v) => `${v.toLocaleString()}đ`} />
                                            <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981' }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Row 2: Top Subjects + VIP/Basic */}
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <BookOpen className="h-5 w-5 text-cyan-600" /> Top Book Categories
                                    </h3>
                                    <div className="h-[280px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={topSubjects} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis type="number" fontSize={12} />
                                                <YAxis type="category" dataKey="name" width={120} fontSize={11} tickFormatter={(v) => v.length > 15 ? v.slice(0, 15) + '...' : v} />
                                                <Tooltip />
                                                <Bar dataKey="count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <Crown className="h-5 w-5 text-purple-600" /> VIP vs Basic Members
                                    </h3>
                                    <div className="h-[280px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={memberTypes.map(m => ({ ...m, value: m.count }))}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={90}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                >
                                                    <Cell fill="#8b5cf6" />
                                                    <Cell fill="#94a3b8" />
                                                </Pie>
                                                <Tooltip />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Row 3: Loans by Branch + Inventory by Branch */}
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <TrendingUp className="h-5 w-5 text-amber-600" /> Active Loans by Branch
                                    </h3>
                                    <div className="h-[250px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={loansByBranch}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="branch" fontSize={12} />
                                                <YAxis fontSize={12} />
                                                <Tooltip />
                                                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <BarChart3 className="h-5 w-5 text-blue-600" /> Inventory by Branch
                                    </h3>
                                    <div className="h-[250px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={inventoryByBranch}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="branch" fontSize={12} />
                                                <YAxis fontSize={12} />
                                                <Tooltip />
                                                <Legend />
                                                <Bar dataKey="available" stackId="a" fill="#10b981" name="Available" />
                                                <Bar dataKey="borrowed" stackId="a" fill="#f59e0b" name="Borrowed" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MEMBERS TAB */}
                    {activeTab === 'MEMBERS' && (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4">Member Info</th>
                                        <th className="px-6 py-4">Active Loans</th>
                                        <th className="px-6 py-4">History Count</th>
                                        <th className="px-6 py-4">Joined At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {members.length === 0 ? (
                                        <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-400">No members found in this branch.</td></tr>
                                    ) : members.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(m => (
                                        <tr key={m.id} className="hover:bg-slate-50 transition">
                                            <td className="px-6 py-4">
                                                <div className="text-slate-900 font-bold">{m.fullName}</div>
                                                <div className="text-xs text-slate-500">{m.email}</div>
                                                <div className="text-[10px] font-mono text-slate-400">{m.memberCode || m.id}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {m.activeLoans > 0 ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-100 text-cyan-700 border border-cyan-200">
                                                        {m.activeLoans} Active
                                                    </span>
                                                ) : <span className="text-slate-400">-</span>}
                                            </td>
                                            <td className="px-6 py-4 font-mono font-medium text-slate-700">{m.totalReturn}</td>
                                            <td className="px-6 py-4 text-slate-500">{new Date(m.joinedAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {members.length > 0 && (
                                <Pagination
                                    currentPage={currentPage}
                                    totalItems={members.length}
                                    itemsPerPage={itemsPerPage}
                                    onPageChange={setCurrentPage}
                                    onLimitChange={setItemsPerPage}
                                />
                            )}
                        </div>
                    )}

                    {/* CIRCULATION TAB */}
                    {activeTab === 'CIRCULATION' && (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4">Book Title</th>
                                        <th className="px-6 py-4">Borrower</th>
                                        <th className="px-6 py-4">Timing</th>
                                        <th className="px-6 py-4 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {circulation.length === 0 ? (
                                        <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-400">No active circulation.</td></tr>
                                    ) : circulation.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50 transition">
                                            <td className="px-6 py-4">
                                                <div className="text-slate-900 font-bold line-clamp-1 max-w-[200px]" title={c.bookTitle}>{c.bookTitle}</div>
                                                <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                                    CP: {c.copyId || 'Virtual'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-slate-900 font-medium">{c.memberName}</div>
                                                <div className="text-xs text-slate-500">{c.memberEmail}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1 text-slate-500 text-xs"><Clock className="h-3 w-3" /> Out: {new Date(c.borrowedAt).toLocaleDateString()}</div>
                                                <div className="flex items-center gap-1 text-slate-700 font-medium text-xs mt-1"><AlertCircle className="h-3 w-3" /> Due: {new Date(c.dueDate).toLocaleDateString()}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-bold border",
                                                    new Date(c.dueDate) < new Date() ? "bg-red-100 text-red-700 border-red-200" :
                                                        c.status === 'RESERVED' ? "bg-amber-100 text-amber-700 border-amber-200" :
                                                            "bg-cyan-100 text-cyan-700 border-cyan-200"
                                                )}>
                                                    {new Date(c.dueDate) < new Date() ? "OVERDUE" : c.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {circulation.length > 0 && (
                                <Pagination
                                    currentPage={currentPage}
                                    totalItems={circulation.length}
                                    itemsPerPage={itemsPerPage}
                                    onPageChange={setCurrentPage}
                                    onLimitChange={setItemsPerPage}
                                />
                            )}
                        </div>
                    )}

                    {/* REPORTS TAB */}
                    {activeTab === 'REPORTS' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Top Borrowed Books */}
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-slate-200 flex items-center gap-2">
                                    <BookOpen className="h-5 w-5 text-cyan-600" />
                                    <h3 className="font-bold text-slate-800">Top 10 Most Borrowed Books</h3>
                                </div>
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-3">#</th>
                                            <th className="px-6 py-3">Book Title</th>
                                            <th className="px-6 py-3">Authors</th>
                                            <th className="px-6 py-3 text-right">Borrow Count</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {topBooks.length === 0 ? (
                                            <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-400">No data available</td></tr>
                                        ) : topBooks.map((book, idx) => (
                                            <tr key={book.bookId} className="hover:bg-slate-50">
                                                <td className="px-6 py-3 font-bold text-slate-400">{idx + 1}</td>
                                                <td className="px-6 py-3 font-medium text-slate-900">{book.title}</td>
                                                <td className="px-6 py-3 text-slate-500">{(book.authors || []).join(', ')}</td>
                                                <td className="px-6 py-3 text-right">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-100 text-cyan-700">
                                                        {book.count}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Overdue Summary */}
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-slate-200 flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-red-600" />
                                    <h3 className="font-bold text-slate-800">Overdue Summary by Branch</h3>
                                </div>
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-3">Branch</th>
                                            <th className="px-6 py-3 text-right">Overdue Count</th>
                                            <th className="px-6 py-3 text-right">Est. Fine Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {overdueSummary.length === 0 ? (
                                            <tr><td colSpan="3" className="px-6 py-8 text-center text-slate-400">No overdue loans 🎉</td></tr>
                                        ) : overdueSummary.map(item => (
                                            <tr key={item.branch} className="hover:bg-slate-50">
                                                <td className="px-6 py-3 font-medium text-slate-900">{item.branch}</td>
                                                <td className="px-6 py-3 text-right">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                                        {item.count}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-right font-mono text-red-600">
                                                    {(item.totalFine || 0).toLocaleString()}đ
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Expiring VIP */}
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-slate-200 flex items-center gap-2">
                                    <Crown className="h-5 w-5 text-purple-600" />
                                    <h3 className="font-bold text-slate-800">VIP Subscriptions Expiring Within 30 Days</h3>
                                </div>
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-3">Member</th>
                                            <th className="px-6 py-3">Branch</th>
                                            <th className="px-6 py-3">Expires At</th>
                                            <th className="px-6 py-3 text-right">Days Left</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {expiringVIP.length === 0 ? (
                                            <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-400">No VIP subscriptions expiring soon</td></tr>
                                        ) : expiringVIP.map(member => (
                                            <tr key={member._id} className="hover:bg-slate-50">
                                                <td className="px-6 py-3">
                                                    <div className="font-medium text-slate-900">{member.fullName}</div>
                                                    <div className="text-xs text-slate-500">{member.email}</div>
                                                </td>
                                                <td className="px-6 py-3">{member.branchId}</td>
                                                <td className="px-6 py-3">{new Date(member.vipExpiresAt).toLocaleDateString()}</td>
                                                <td className="px-6 py-3 text-right">
                                                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold",
                                                        member.daysLeft <= 7 ? "bg-red-100 text-red-700" :
                                                            member.daysLeft <= 14 ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700"
                                                    )}>
                                                        {member.daysLeft} days
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}


function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange, onLimitChange }) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalItems);

    if (totalItems === 0) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 border-t border-slate-200 mt-2">
            <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>Rows per page:</span>
                <select
                    value={itemsPerPage}
                    onChange={(e) => onLimitChange(Number(e.target.value))}
                    className="bg-slate-50 border border-slate-200 rounded-md text-slate-700 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none py-1 px-2"
                >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                </select>
                <span className="hidden sm:inline">| Showing {start}-{end} of {totalItems}</span>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm font-medium text-slate-700">
                    Page {currentPage} of {totalPages}
                </span>
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    <ChevronRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color, trend }) {
    return (
        <div className="rounded-xl border border-slate-200 p-6 bg-white shadow-sm flex items-center justify-between transition hover:shadow-md hover:border-cyan-200">
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{title}</p>
                <p className="text-2xl font-black text-slate-900">{value}</p>
                {trend && <p className="text-xs text-slate-400 mt-1 font-medium">{trend}</p>}
            </div>
            <div className={cn("p-3 rounded-xl border border-transparent shadow-sm", color)}>
                {icon}
            </div>
        </div>
    );
}
