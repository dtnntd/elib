import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Loader2, Wallet, PlusCircle, History, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export default function WalletPage() {
    const { user, refreshUser } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDepositing, setIsDepositing] = useState(false);

    const fetchData = async () => {
        try {
            const [historyRes] = await Promise.all([
                api.get('/wallet/history'),
                refreshUser() // Sync global user state (header)
            ]);
            setTransactions(historyRes.data || []);
        } catch (error) {
            console.error("Failed to fetch wallet data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDeposit = async () => {
        setIsDepositing(true);
        try {
            const amount = 50000; // Fixed deposit amount for now, or use prompt
            await api.post('/wallet/topup', { amount });
            alert(`Successfully deposited ${amount.toLocaleString()} VND`);
            fetchData(); // Refresh history and global user balance
        } catch (error) {
            alert("Deposit failed");
        } finally {
            setIsDepositing(false);
        }
    };

    if (loading) return <div className="flex h-64 items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Wallet className="text-cyan-500" /> My Wallet
            </h2>

            {/* Balance Card */}
            <div className="bg-slate-800/50 border border-white/5 p-6 rounded-2xl flex items-center justify-between">
                <div>
                    <h3 className="text-slate-400 text-sm uppercase tracking-wide">Current Balance</h3>
                    <div className={cn("text-4xl font-mono font-bold mt-2",
                        (user?.walletBalance || 0) < 0 ? "text-red-400" : "text-emerald-400"
                    )}>
                        {(user?.walletBalance || 0).toLocaleString()} VND
                    </div>
                </div>
                <button
                    onClick={handleDeposit}
                    disabled={isDepositing}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-bold transition disabled:opacity-50"
                >
                    {isDepositing ? <Loader2 className="animate-spin h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
                    Deposit Funds
                </button>
            </div>

            {/* Transactions */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-300 uppercase tracking-wide text-xs flex items-center gap-2">
                    <History className="h-4 w-4" /> Transaction History
                </h3>

                <div className="grid gap-2">
                    {transactions.length === 0 ? (
                        <div className="text-slate-500 text-center py-8">No transactions yet.</div>
                    ) : (
                        transactions.map(tx => (
                            <div key={tx.id} className="bg-slate-800/30 border border-white/5 p-4 rounded-xl flex items-center justify-between hover:border-white/10 transition">
                                <div className="flex items-center gap-4">
                                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center",
                                        tx.type === 'DEPOSIT' ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                                    )}>
                                        {tx.type === 'DEPOSIT' ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <div className="text-white font-medium">{tx.description}</div>
                                        <div className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString()}</div>
                                    </div>
                                </div>
                                <div className={cn("font-mono font-bold",
                                    tx.amount > 0 ? "text-emerald-400" : "text-red-400"
                                )}>
                                    {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()} VND
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
