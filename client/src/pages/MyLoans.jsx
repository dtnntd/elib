import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Loader2, Book, Calendar, Clock, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';

const BRANCH_NAMES = {
    "HN": "Hà Nội Main Branch",
    "HP": "Hải Phòng Branch",
    "DN": "Đà Nẵng Branch",
    "HCM": "TP.HCM Branch"
};

export default function MyLoans() {
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeScheduleId, setActiveScheduleId] = useState(null);
    const [scheduleTime, setScheduleTime] = useState('');

    useEffect(() => {
        const fetchLoans = async () => {
            try {
                const res = await api.get('/loans/my-loans');
                setLoans(res.data);
            } catch (error) {
                console.error("Failed to fetch loans", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLoans();
    }, []);

    if (loading) return <div className="flex h-64 items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

    const handleReturn = async (loanId) => {
        if (!confirm("Are you sure you want to return this book?")) return;
        try {
            await api.put(`/loans/return/${loanId}`);
            // Refresh list
            const res = await api.get('/loans/my-loans');
            setLoans(res.data);
        } catch (error) {
            alert("Failed to return book");
            console.error(error);
        }
    };

    const handleScheduleReturn = async (loanId) => {
        if (!scheduleTime) return alert("Please select a time");
        try {
            await api.put(`/loans/schedule-return/${loanId}`, {
                appointmentTime: new Date(scheduleTime).toISOString()
            });
            alert("Return scheduled successfully!");
            setActiveScheduleId(null);
            // Refresh list
            const res = await api.get('/loans/my-loans');
            setLoans(res.data);
        } catch (error) {
            alert(`Error: ${error.response?.data?.error || "Failed to schedule"}`);
        }
    };

    // Filter Active vs Returned
    const activeLoans = loans.filter(l => l.status === "BORROWED" || l.status === "ACTIVE" || l.status === "OVERDUE");
    const returnedLoans = loans.filter(l => l.status === "RETURNED");

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Book className="text-cyan-600" /> My Bookshelf
            </h2>

            {/* Active Loans */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-700 uppercase tracking-wide text-xs">Active Loans</h3>
                {activeLoans.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl text-slate-500 bg-slate-50">
                        No active loans. Go borrow some books!
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {activeLoans.map(loan => (
                            <div key={loan.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:border-cyan-500 hover:shadow-md transition shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center",
                                        loan.itemType === "PHYSICAL" ? "bg-cyan-100 text-cyan-700" : "bg-purple-100 text-purple-700"
                                    )}>
                                        <Book className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Ref: {loan.id}</span>
                                        </div>
                                        <Link to={`/books/${loan.book.id}`} className="text-slate-900 font-bold hover:text-cyan-700 text-lg transition block">
                                            {loan.book.title}
                                        </Link>
                                        <p className="text-slate-500 text-sm">{loan.book.authors.join(', ')}</p>

                                        <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-slate-600">
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3 text-slate-400" /> Borrowed: <span className="text-slate-700 font-medium">{new Date(loan.borrowedAt).toLocaleDateString()}</span>
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3 text-slate-400" /> Due: <span className="text-slate-900 font-bold">{new Date(loan.dueDate).toLocaleDateString()}</span>
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Book className="h-3 w-3 text-slate-400" /> Type: <span className={loan.itemType === "PHYSICAL" ? "text-cyan-700 font-bold" : "text-purple-700 font-bold"}>{loan.itemType === "PHYSICAL" ? "Physical Copy" : "E-Book"}</span>
                                            </span>
                                            {loan.itemType === "PHYSICAL" && (
                                                <span className="flex items-center gap-1">
                                                    <span className="text-slate-400">📍 Location:</span> <span className="text-slate-700">{BRANCH_NAMES[loan.branchId] || loan.branchId}</span>
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-2 text-right">
                                            {((loan.status === 'BORROWED' || loan.status === 'ACTIVE') && new Date(loan.dueDate) < new Date()) ? (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                                                    OVERDUE
                                                </span>
                                            ) : (
                                                <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold border",
                                                    loan.status === "OVERDUE" ? "bg-red-100 text-red-700 border-red-200" :
                                                        loan.status === "ACTIVE" || loan.status === "BORROWED" ? "bg-cyan-100 text-cyan-700 border-cyan-200" :
                                                            "bg-emerald-100 text-emerald-700 border-emerald-200"
                                                )}>
                                                    {loan.status}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {loan.itemType === "PHYSICAL" && (
                                    <div className="text-right flex flex-col items-end gap-2">
                                        {loan.status === "RESERVED" ? (
                                            <div className="text-right">
                                                <p className="text-xs text-amber-700 font-bold bg-amber-100 px-2 py-1 rounded border border-amber-200">Reserved</p>
                                                {loan.pickupAppointment && (
                                                    <p className="text-xs text-slate-500 mt-1">Pickup: {new Date(loan.pickupAppointment).toLocaleString()}</p>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                {activeScheduleId === loan.id ? (
                                                    <div className="flex flex-col gap-2 items-end bg-slate-50 p-2 rounded-lg border border-slate-200 shadow-sm">
                                                        <input
                                                            type="datetime-local"
                                                            className="text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                                            value={scheduleTime}
                                                            onChange={(e) => setScheduleTime(e.target.value)}
                                                            min={new Date().toISOString().slice(0, 16)}
                                                        />
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setActiveScheduleId(null)}
                                                                className="text-xs text-slate-500 hover:text-slate-700"
                                                            >Cancel</button>
                                                            <button
                                                                onClick={() => handleScheduleReturn(loan.id)}
                                                                className="text-xs bg-cyan-600 text-white px-2 py-1 rounded hover:bg-cyan-700 shadow-sm"
                                                            >Confirm</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-end gap-1">
                                                        {loan.returnAppointment ? (
                                                            <div className="text-xs text-slate-500 font-medium">
                                                                Return scheduled: <br />{new Date(loan.returnAppointment).toLocaleString()}
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => {
                                                                    setActiveScheduleId(loan.id);
                                                                    setScheduleTime('');
                                                                }}
                                                                className="text-xs text-cyan-600 hover:text-cyan-800 font-bold underline decoration-cyan-500/30 hover:decoration-cyan-500"
                                                            >
                                                                Schedule Return
                                                            </button>
                                                        )}
                                                        <p className="text-xs text-emerald-700 font-bold bg-emerald-100 px-2 py-1 rounded border border-emerald-200">Return at Counter</p>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                                {loan.itemType === "DIGITAL" && (
                                    <div className="text-right">
                                        <button
                                            onClick={() => handleReturn(loan.id)}
                                            className="text-xs bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded-lg border border-red-200 transition font-bold"
                                        >
                                            Return E-Book
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* History */}
            <div className="space-y-4 pt-6 border-t border-slate-200">
                <h3 className="text-lg font-bold text-slate-700 uppercase tracking-wide text-xs">History</h3>
                <div className="grid gap-2">
                    {returnedLoans.slice(0, 5).map(loan => ( // Show last 5
                        <div key={loan.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition gap-4 shadow-sm">
                            <div className="flex items-start gap-4">
                                <div className="mt-1">
                                    <RotateCcw className="h-4 w-4 text-slate-400" />
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Ref: {loan.id}</span>
                                    </div>

                                    <Link to={`/books/${loan.book.id}`} className="text-slate-900 font-bold hover:text-cyan-700 transition block">
                                        {loan.book.title}
                                    </Link>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                                        <span>Borrowed: {new Date(loan.borrowedAt).toLocaleDateString()}</span>
                                        <span>Returned: {new Date(loan.returnedAt).toLocaleDateString()}</span>
                                        <span className={loan.itemType === "PHYSICAL" ? "text-cyan-600 font-bold" : "text-purple-600 font-bold"}>
                                            {loan.itemType === "PHYSICAL" ? "Physical" : "E-Book"}
                                        </span>
                                        {loan.itemType === "PHYSICAL" && (
                                            <>
                                                <span>📍 {BRANCH_NAMES[loan.branchId] || loan.branchId}</span>
                                                <span className="text-emerald-600 font-bold">
                                                    ✨ {loan.returnCondition || "Good"}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
