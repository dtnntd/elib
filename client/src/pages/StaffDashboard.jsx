import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Loader2, CheckCircle, RotateCcw, Monitor, BarChart3, List } from 'lucide-react';
import StatsDashboard from './StatsDashboard';
import { cn } from '../lib/utils';

export default function StaffDashboard() {
    const [viewMode, setViewMode] = useState('LOANS'); // 'LOANS' or 'ANALYTICS'
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL'); // ALL, RESERVED, BORROWED, OVERDUE, RETURNED

    const [sortConfig, setSortConfig] = useState({ key: 'borrowedAt', direction: 'desc' });

    const fetchLoans = async (statusOverride) => {
        // Only fetch loans if in LOANS view
        if (viewMode !== 'LOANS') return;

        setLoading(true);
        try {
            const params = {
                sortBy: sortConfig.key,
                order: sortConfig.direction
            };
            if (statusOverride) params.status = statusOverride;

            const res = await api.get('/loans/all', { params });
            setLoans(res.data);
        } catch (error) {
            console.error("Failed to fetch loans", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const status = filter === 'OVERDUE' ? 'OVERDUE' : filter === 'ALL' ? undefined : filter;
        fetchLoans(status);

        const interval = setInterval(() => {
            fetchLoans(status);
        }, 30000);
        return () => clearInterval(interval);
    }, [filter, sortConfig, viewMode]); // Re-fetch when view changes back to LOANS

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <span className="ml-1 text-slate-600">↕</span>;
        return sortConfig.direction === 'asc' ? <span className="ml-1 text-cyan-400">↑</span> : <span className="ml-1 text-cyan-400">↓</span>;
    };

    const [showReturnModal, setShowReturnModal] = useState(false);
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [returnCondition, setReturnCondition] = useState('GOOD');

    const handleCheckout = async (loanId) => {
        if (!confirm("Confirm book pickup for this reservation?")) return;
        try {
            await api.put(`/loans/checkout/${loanId}`);
            alert("Pickup confirmed!");
            fetchLoans(filter === 'OVERDUE' ? 'OVERDUE' : undefined);
        } catch (error) {
            alert("Failed to confirm pickup: " + (error.response?.data?.error || "Unknown error"));
        }
    };

    const handleReturnClick = (loan) => {
        setSelectedLoan(loan);
        setReturnCondition('GOOD');
        setShowReturnModal(true);
    };

    const confirmReturn = async () => {
        if (!selectedLoan) return;
        try {
            const res = await api.put(`/loans/return/${selectedLoan.id}`, { condition: returnCondition });
            const fine = res.data.fine;
            if (fine > 0) {
                alert(`Return confirmed!\n\n⚠️ PLEASE COLLECT FINE: ${fine.toLocaleString()} VND`);
            } else {
                alert("Return confirmed!");
            }
            setShowReturnModal(false);
            fetchLoans(filter === 'OVERDUE' ? 'OVERDUE' : undefined);
        } catch (error) {
            alert("Failed to confirm return: " + (error.response?.data?.error || "Unknown error"));
        }
    };

    const isLoanOverdue = (loan) => {
        return (loan.status === 'BORROWED' || loan.status === 'ACTIVE') && new Date(loan.dueDate) < new Date();
    };

    const filteredLoans = loans.filter(loan => {
        if (filter === 'ALL') return true;
        if (filter === 'OVERDUE') return true; // Already filtered by server
        if (filter === 'RETURNED') return loan.status === 'RETURNED';
        if (filter === 'BORROWED') return (loan.status === 'BORROWED' || loan.status === 'ACTIVE') && !isLoanOverdue(loan);
        return loan.status === filter;
    });

    const getStatusColor = (loan) => {
        if (isLoanOverdue(loan)) return 'text-red-400 bg-red-400/10'; // Dynamic Overdue
        switch (loan.status) {
            case 'RESERVED': return 'text-yellow-400 bg-yellow-400/10';
            case 'BORROWED': return 'text-cyan-400 bg-cyan-400/10';
            case 'ACTIVE': return 'text-purple-400 bg-purple-400/10';
            case 'OVERDUE': return 'text-red-400 bg-red-400/10';
            case 'RETURNED': return 'text-slate-400 bg-slate-400/10';
            default: return 'text-white';
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Monitor className="text-cyan-500" /> Staff Dashboard
                    </h1>

                    {/* View Toggle */}
                    <div className="flex bg-slate-800 p-1 rounded-lg border border-white/10">
                        <button
                            onClick={() => setViewMode('LOANS')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition",
                                viewMode === 'LOANS' ? "bg-cyan-600 text-white shadow" : "text-slate-400 hover:text-white"
                            )}
                        >
                            <List className="h-4 w-4" /> Loans
                        </button>
                        <button
                            onClick={() => setViewMode('ANALYTICS')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition",
                                viewMode === 'ANALYTICS' ? "bg-cyan-600 text-white shadow" : "text-slate-400 hover:text-white"
                            )}
                        >
                            <BarChart3 className="h-4 w-4" /> Analytics
                        </button>
                    </div>
                </div>

                {viewMode === 'LOANS' && (
                    <div className="flex gap-2 bg-slate-800/50 p-1 rounded-lg border border-white/5">
                        {['ALL', 'RESERVED', 'BORROWED', 'OVERDUE', 'RETURNED'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition",
                                    filter === f
                                        ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/50"
                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {viewMode === 'ANALYTICS' ? (
                <StatsDashboard />
            ) : (
                /* LOANS TABLE VIEW */
                loading && loans.length === 0 ? (
                    <div className="flex h-64 items-center justify-center text-white"><Loader2 className="animate-spin" /></div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/50 backdrop-blur-sm">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-slate-800/80 text-xs uppercase text-slate-300">
                                <tr>
                                    <th onClick={() => handleSort('book.title')} className="px-6 py-4 cursor-pointer hover:text-white transition select-none">Ref / Book <SortIcon column="book.title" /></th>
                                    <th onClick={() => handleSort('status')} className="px-6 py-4 cursor-pointer hover:text-white transition select-none">Status <SortIcon column="status" /></th>
                                    <th onClick={() => handleSort('member.fullName')} className="px-6 py-4 cursor-pointer hover:text-white transition select-none">Member <SortIcon column="member.fullName" /></th>
                                    <th onClick={() => handleSort('borrowedAt')} className="px-6 py-4 cursor-pointer hover:text-white transition select-none">Timing <SortIcon column="borrowedAt" /></th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredLoans.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-white/30">No loans found.</td>
                                    </tr>
                                ) : filteredLoans.map((loan) => (
                                    <tr key={loan.id} className="hover:bg-white/5 transition">
                                        <td className="px-6 py-4">
                                            <div className="font-mono text-xs text-slate-500 mb-1">{loan.id.slice(-6)}</div>
                                            <div className="font-medium text-white">{loan.book.title}</div>
                                            <div className="text-xs">{loan.itemType}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(loan)}`}>
                                                {isLoanOverdue(loan) ? 'OVERDUE' : loan.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-white">{loan.member.fullName}</div>
                                            <div className="text-xs">{loan.member.email}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {loan.status === 'RESERVED' && (
                                                <div className="text-yellow-500/80">
                                                    Pickup: {new Date(loan.pickupAppointment).toLocaleString()}
                                                </div>
                                            )}
                                            {(loan.status === 'BORROWED' || loan.status === 'ACTIVE') && (
                                                <>
                                                    <div>Due: {new Date(loan.dueDate).toLocaleDateString()}</div>
                                                    {loan.returnAppointment && (
                                                        <div className="text-cyan-400 mt-1 text-xs">
                                                            Return Appt: {new Date(loan.returnAppointment).toLocaleString()}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            {loan.status === 'RETURNED' && (
                                                <div className="text-slate-500">
                                                    Returned: {new Date(loan.returnedAt).toLocaleDateString()}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {loan.status === 'RESERVED' && (
                                                    <button
                                                        onClick={() => handleCheckout(loan.id)}
                                                        className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20 hover:bg-emerald-500/20 transition"
                                                    >
                                                        <CheckCircle className="h-4 w-4" /> Checkout
                                                    </button>
                                                )}
                                                {(loan.status === 'BORROWED' || loan.status === 'OVERDUE') && loan.itemType === 'PHYSICAL' && (
                                                    <button
                                                        onClick={() => handleReturnClick(loan)}
                                                        className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-400 ring-1 ring-inset ring-purple-500/20 hover:bg-purple-500/20 transition"
                                                    >
                                                        <RotateCcw className="h-4 w-4" /> Return
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}

            {showReturnModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Confirm Book Return</h3>
                        <p className="text-slate-400 mb-6">
                            Please check the physical condition of <strong>{selectedLoan?.book.title}</strong>.
                        </p>

                        <div className="space-y-3 mb-6">
                            <label className="block text-sm font-medium text-slate-300">Condition</label>
                            <select
                                value={returnCondition}
                                onChange={(e) => setReturnCondition(e.target.value)}
                                className="w-full bg-slate-800 border-white/10 rounded-lg text-white px-4 py-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                            >
                                <option value="GOOD">Good (Normal Return)</option>
                                <option value="DAMAGED">Damaged (+50,000 VND)</option>
                                <option value="LOST">Lost (+Book Price)</option>
                            </select>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowReturnModal(false)}
                                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmReturn}
                                className="px-4 py-2 rounded-lg bg-cyan-600 text-white font-medium hover:bg-cyan-500 transition shadow-lg shadow-cyan-500/20"
                            >
                                Confirm Return
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

