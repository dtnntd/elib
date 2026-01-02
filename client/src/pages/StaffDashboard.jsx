import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Loader2, CheckCircle, RotateCcw, Monitor } from 'lucide-react';

export default function StaffDashboard() {
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL'); // ALL, RESERVED, BORROWED, OVERDUE, RETURNED

    const fetchLoans = async () => {
        setLoading(true);
        try {
            const res = await api.get('/loans/all');
            setLoans(res.data);
        } catch (error) {
            console.error("Failed to fetch loans", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLoans();
        // Poll every 30s to keep updated
        const interval = setInterval(fetchLoans, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleCheckout = async (loanId) => {
        if (!confirm("Confirm book pickup for this reservation?")) return;
        try {
            await api.put(`/loans/checkout/${loanId}`);
            alert("Pickup confirmed!");
            fetchLoans();
        } catch (error) {
            alert("Failed to confirm pickup: " + (error.response?.data?.error || "Unknown error"));
        }
    };

    const handleReturn = async (loanId) => {
        if (!confirm("Confirm book return?")) return;
        try {
            await api.put(`/loans/return/${loanId}`);
            alert("Return confirmed!");
            fetchLoans();
        } catch (error) {
            alert("Failed to confirm return: " + (error.response?.data?.error || "Unknown error"));
        }
    };

    const filteredLoans = loans.filter(l => {
        if (filter === 'ALL') return true;
        if (filter === 'BORROWED') return l.status === 'BORROWED' || l.status === 'ACTIVE';
        return l.status === filter;
    });

    const getStatusColor = (status) => {
        switch (status) {
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
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Monitor className="text-cyan-500" /> Staff Dashboard
                </h1>
                <div className="flex gap-2">
                    {['ALL', 'RESERVED', 'BORROWED', 'OVERDUE', 'RETURNED'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filter === f
                                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {loading && loans.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-white"><Loader2 className="animate-spin" /></div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/50 backdrop-blur-sm">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-800/80 text-xs uppercase text-slate-300">
                            <tr>
                                <th className="px-6 py-4">Ref / Book</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Member</th>
                                <th className="px-6 py-4">Timing</th>
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
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(loan.status)}`}>
                                            {loan.status}
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
                                                    onClick={() => handleReturn(loan.id)}
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
            )}
        </div>
    );
}
