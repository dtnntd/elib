import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Loader2, CheckCircle, RotateCcw, Monitor, BarChart3, List, ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react';
import StatsDashboard from './StatsDashboard';
import { cn } from '../lib/utils';

export default function StaffDashboard() {
    const [viewMode, setViewMode] = useState('LOANS'); // 'LOANS' or 'ANALYTICS'
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL'); // ALL, RESERVED, BORROWED, OVERDUE, RETURNED

    const [sortConfig, setSortConfig] = useState({ key: 'borrowedAt', direction: 'desc' });
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchLoans = async (statusOverride, silent = false) => {
        // Only fetch loans if in LOANS view
        if (viewMode !== 'LOANS') return;

        if (!silent) setLoading(true);
        try {
            const params = {
                sortBy: sortConfig.key,
                order: sortConfig.direction
            };
            if (statusOverride) params.status = statusOverride;

            const res = await api.get('/loans/all', { params });
            if (Array.isArray(res.data)) {
                setLoans(res.data);
            } else {
                console.error("API returned non-array:", res.data);
                // Only alert if not silent, to avoid spam
                if (!silent) alert("Unexpected data received from server");
                setLoans([]); // Safely reset or keep previous? Reset safe.
            }
        } catch (error) {
            console.error("Failed to fetch loans", error);
            if (!silent) alert("Failed to fetch data: " + (error.response?.data?.error || error.message));
            setLoans([]); // Prevent crash
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        const status = filter === 'ALL' ? undefined : filter;
        fetchLoans(status);

        const interval = setInterval(() => {
            fetchLoans(status, true); // Silent refresh
        }, 30000);
        return () => clearInterval(interval);
    }, [filter, sortConfig, viewMode]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filter, viewMode, itemsPerPage]);

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
        // Optimistic UI: Remove item immediately
        setLoans(current => current.filter(l => l.id !== loanId));

        try {
            await api.put(`/loans/checkout/${loanId}`);
            // Background refresh to sync true state
            fetchLoans(filter === 'ALL' ? undefined : filter, true);
        } catch (error) {
            alert("Failed to confirm pickup: " + (error.response?.data?.error || "Unknown error"));
            // Rollback on error (refresh)
            fetchLoans(filter === 'ALL' ? undefined : filter);
        }
    };

    const handleReturnClick = (loan) => {
        setSelectedLoan(loan);
        setReturnCondition('GOOD');
        setShowReturnModal(true);
    };

    const confirmReturn = async () => {
        if (!selectedLoan) return;
        const loanId = selectedLoan.id;

        // Optimistic UI: Remove item immediately
        setLoans(current => current.filter(l => l.id !== loanId));
        setShowReturnModal(false);

        try {
            const res = await api.put(`/loans/return/${loanId}`, { condition: returnCondition });
            const fine = res.data.fine;
            if (fine > 0) {
                alert(`Return confirmed!\n\n⚠️ PLEASE COLLECT FINE: ${fine.toLocaleString()} VND`);
            }

            fetchLoans(filter === 'ALL' ? undefined : filter, true);
        } catch (error) {
            alert("Failed to confirm return: " + (error.response?.data?.error || "Unknown error"));
            fetchLoans(filter === 'ALL' ? undefined : filter); // Rollback
        }
    };

    const isLoanOverdue = (loan) => {
        return loan.status === 'OVERDUE' || ((loan.status === 'BORROWED' || loan.status === 'ACTIVE') && new Date(loan.dueDate) < new Date());
    };

    const filteredLoans = loans.filter(loan => {
        if (filter === 'ALL') return true;
        if (filter === 'RESERVED') return loan.status === 'RESERVED';
        if (filter === 'BORROWED') return (loan.status === 'BORROWED' || loan.status === 'ACTIVE') && !isLoanOverdue(loan);
        // Fix: Show ALL scheduled returns, even if overdue
        if (filter === 'RETURNS') return loan.returnAppointment && loan.status !== 'RETURNED';
        if (filter === 'OVERDUE') return isLoanOverdue(loan);
        if (filter === 'RETURNED') return loan.status === 'RETURNED';
        return true;
    });

    const getStatusColor = (loan) => {
        if (isLoanOverdue(loan)) return 'text-red-600 bg-red-100 border border-red-200'; // Dynamic Overdue
        switch (loan.status) {
            case 'RESERVED': return 'text-amber-600 bg-amber-100 border border-amber-200';
            case 'BORROWED': return 'text-cyan-700 bg-cyan-100 border border-cyan-200';
            case 'ACTIVE': return 'text-purple-600 bg-purple-100 border border-purple-200';
            case 'OVERDUE': return 'text-red-600 bg-red-100 border border-red-200';
            case 'RETURNED': return 'text-slate-600 bg-slate-100 border border-slate-200';
            default: return 'text-slate-900';
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Monitor className="text-cyan-600" /> Staff Dashboard
                    </h1>

                    {/* View Toggle */}
                    <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                        <button
                            onClick={() => setViewMode('LOANS')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition",
                                viewMode === 'LOANS' ? "bg-cyan-100 text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            )}
                        >
                            <List className="h-4 w-4" /> Loans
                        </button>
                        <button
                            onClick={() => setViewMode('ANALYTICS')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition",
                                viewMode === 'ANALYTICS' ? "bg-cyan-100 text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            )}
                        >
                            <BarChart3 className="h-4 w-4" /> Analytics
                        </button>
                    </div>
                </div>

                {viewMode === 'LOANS' && (
                    <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                        {['ALL', 'RESERVED', 'CURRENT', 'SCHEDULED', 'OVERDUE', 'RETURNED'].map(f => (
                            <button
                                key={f}
                                onClick={() => {
                                    setFilter(f);
                                    if (f === 'RETURNED') {
                                        setSortConfig({ key: 'returnedAt', direction: 'desc' });
                                    } else if (f === 'SCHEDULED') {
                                        setSortConfig({ key: 'returnAppointment', direction: 'asc' });
                                    } else if (f === 'RESERVED') {
                                        setSortConfig({ key: 'pickupAppointment', direction: 'asc' });
                                    } else {
                                        setSortConfig({ key: 'borrowedAt', direction: 'desc' });
                                    }
                                    setCurrentPage(1);
                                }}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition",
                                    filter === f
                                        ? "bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200"
                                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                )}
                            >
                                {f === 'SCHEDULED' ? 'RETURNS' : f === 'CURRENT' ? 'BORROWED' : f}
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
                    <div className="flex h-64 items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                                <tr>
                                    <th onClick={() => handleSort('book.title')} className="px-6 py-4 cursor-pointer hover:text-slate-800 transition select-none">Ref / Book <SortIcon column="book.title" /></th>
                                    <th onClick={() => handleSort('status')} className="px-6 py-4 cursor-pointer hover:text-slate-800 transition select-none">Status <SortIcon column="status" /></th>
                                    <th onClick={() => handleSort('member.fullName')} className="px-6 py-4 cursor-pointer hover:text-slate-800 transition select-none">Member <SortIcon column="member.fullName" /></th>
                                    <th onClick={() => handleSort('borrowedAt')} className="px-6 py-4 cursor-pointer hover:text-slate-800 transition select-none">Timing <SortIcon column="borrowedAt" /></th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredLoans.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-slate-400">No loans found.</td>
                                    </tr>
                                ) : filteredLoans.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((loan) => (
                                    <tr key={loan.id} className="hover:bg-slate-50 transition">
                                        <td className="px-6 py-4">
                                            <div className="font-mono text-xs text-slate-400 mb-1">{loan.id.slice(-6)}</div>
                                            <div className="font-bold text-slate-900">{loan.book?.title || "Unknown Book"}</div>
                                            <div className="text-xs text-slate-500">{loan.itemType}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-bold ${getStatusColor(loan)}`}>
                                                {isLoanOverdue(loan) ? 'OVERDUE' : loan.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-slate-900 font-medium">{loan.member?.fullName || "Unknown Member"}</div>
                                            <div className="text-xs text-slate-500">{loan.member?.email || "No Email"}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {loan.status === 'RESERVED' && (
                                                <div className="text-amber-600 font-medium">
                                                    Pickup: {new Date(loan.pickupAppointment).toLocaleString()}
                                                </div>
                                            )}
                                            {['BORROWED', 'ACTIVE', 'OVERDUE'].includes(loan.status) && (
                                                <>
                                                    <div className={cn("font-medium", isLoanOverdue(loan) ? "text-red-600 font-bold" : "text-slate-700")}>
                                                        Due: {new Date(loan.dueDate).toLocaleDateString()}
                                                    </div>
                                                    {loan.returnAppointment && !loan.returnAppointment.startsWith("0001") && (
                                                        <div className="text-emerald-600 mt-1 text-xs font-bold bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100 inline-block">
                                                            📅 Returns: {new Date(loan.returnAppointment).toLocaleString()}
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
                                                        className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-200 transition"
                                                    >
                                                        <CheckCircle className="h-4 w-4" /> Checkout
                                                    </button>
                                                )}
                                                {(loan.status === 'BORROWED' || loan.status === 'OVERDUE' || loan.status === 'ACTIVE') && (
                                                    <>
                                                        <button
                                                            onClick={async () => {
                                                                const bookTitle = loan.book?.title || "Book";
                                                                if (!confirm(`Renew due date for book "${bookTitle}"? \nExtends 14 days from NOW.`)) return;

                                                                // Optimistic Update
                                                                const newDate = new Date();
                                                                newDate.setDate(newDate.getDate() + 14);
                                                                setLoans(current => current.map(l =>
                                                                    l.id === loan.id ? { ...l, dueDate: newDate.toISOString() } : l
                                                                ));

                                                                try {
                                                                    await api.put(`/loans/renew/${loan.id}`);
                                                                    // Silent refresh with CORRECT filter
                                                                    fetchLoans(filter === 'ALL' ? undefined : filter, true);
                                                                } catch (err) {
                                                                    alert("Failed to renew: " + (err.response?.data?.error || err.message));
                                                                    fetchLoans(filter === 'ALL' ? undefined : filter); // Rollback
                                                                }
                                                            }}
                                                            className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-200 hover:bg-blue-200 transition"
                                                        >
                                                            <CalendarClock className="h-4 w-4" /> Renew
                                                        </button>
                                                        <button
                                                            onClick={() => handleReturnClick(loan)}
                                                            className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-3 py-1.5 text-xs font-bold text-purple-700 ring-1 ring-inset ring-purple-200 hover:bg-purple-200 transition"
                                                        >
                                                            <RotateCcw className="h-4 w-4" /> Return
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}

            {
                !loading && filteredLoans.length > 0 && viewMode === 'LOANS' && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 border-t border-slate-200 bg-white rounded-xl border p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span>Rows per page:</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                className="bg-slate-50 border border-slate-200 rounded-md text-slate-700 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none py-1 px-2"
                            >
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span className="hidden sm:inline">| Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredLoans.length)} of {filteredLoans.length}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <span className="text-sm font-medium text-slate-700">
                                Page {currentPage} of {Math.ceil(filteredLoans.length / itemsPerPage)}
                            </span>
                            <button
                                onClick={() => setCurrentPage(currentPage + 1)}
                                disabled={currentPage === Math.ceil(filteredLoans.length / itemsPerPage)}
                                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                )
            }

            {
                showReturnModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                            <h3 className="text-xl font-bold text-slate-900 mb-4">Confirm Book Return</h3>
                            <p className="text-slate-600 mb-6">
                                Please check the physical condition of <strong>{selectedLoan?.book.title}</strong>.
                            </p>

                            <div className="space-y-3 mb-6">
                                <label className="block text-sm font-medium text-slate-700">Condition</label>
                                <select
                                    value={returnCondition}
                                    onChange={(e) => setReturnCondition(e.target.value)}
                                    className="w-full bg-slate-50 border-slate-200 rounded-lg text-slate-900 px-4 py-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none border"
                                >
                                    <option value="GOOD">Good (Normal Return)</option>
                                    <option value="DAMAGED">Damaged (+50,000 VND)</option>
                                    <option value="LOST">Lost (+Book Price)</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowReturnModal(false)}
                                    className="px-4 py-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmReturn}
                                    className="px-4 py-2 rounded-lg bg-cyan-600 text-white font-medium hover:bg-cyan-700 transition shadow-lg shadow-cyan-500/20"
                                >
                                    Confirm Return
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

