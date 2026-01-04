import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Crown, Star, Zap, Calendar, Loader2, Check } from 'lucide-react';

export default function VIPPage() {
    const { user } = useAuth();
    const [packages, setPackages] = useState([]);
    const [vipStatus, setVIPStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [packagesRes, statusRes] = await Promise.all([
                api.get('/vip/packages'),
                api.get('/vip/status')
            ]);
            setPackages(packagesRes.data.packages);
            setVIPStatus(statusRes.data);
        } catch (error) {
            console.error('Failed to fetch VIP data', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async (packageId) => {
        if (!confirm('Confirm VIP purchase? Your wallet will be charged.')) return;

        setPurchasing(true);
        try {
            const res = await api.post('/vip/purchase', { packageId });
            alert(res.data.message);
            fetchData(); // Refresh data
        } catch (error) {
            alert(error.response?.data?.error || 'Purchase failed');
        } finally {
            setPurchasing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-cyan-600" />
            </div>
        );
    }

    const isPermanentVIP = vipStatus?.permanent;
    const isActiveVIP = vipStatus?.isVip;
    const daysRemaining = vipStatus?.daysRemaining || 0;

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-sm mb-4">
                    <Crown className="h-5 w-5" />
                    VIP MEMBERSHIP
                </div>
                <h1 className="text-4xl font-bold text-slate-900">Upgrade to VIP</h1>
                <p className="text-slate-600 mt-2">Unlock premium features and exclusive benefits</p>
            </div>

            {/* Current Status */}
            {isActiveVIP && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-purple-100 rounded-xl">
                                <Star className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">Current VIP Status</h3>
                                <p className="text-sm text-slate-600">
                                    {isPermanentVIP ? (
                                        <span className="text-purple-600 font-semibold">Permanent VIP ({vipStatus.vipType})</span>
                                    ) : (
                                        <span>Expires in <span className="font-semibold text-purple-600">{daysRemaining} days</span></span>
                                    )}
                                </p>
                            </div>
                        </div>
                        {!isPermanentVIP && (
                            <div className="text-right">
                                <p className="text-xs text-slate-500">Expiration Date</p>
                                <p className="font-semibold text-slate-900">
                                    {new Date(vipStatus.vipExpiresAt).toLocaleDateString()}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* VIP Benefits */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">VIP Benefits</h2>
                <div className="grid md:grid-cols-2 gap-4">
                    {[
                        { icon: Zap, title: 'Priority Reservations', desc: 'Skip the queue and reserve books first' },
                        { icon: Calendar, title: 'Extended Borrowing', desc: '30 days instead of 14 days' },
                        { icon: Check, title: 'No Late Fees (3 days)', desc: 'Grace period for overdue returns' },
                        { icon: Star, title: 'Premium E-Books', desc: 'Access exclusive digital content' },
                    ].map((benefit, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <benefit.icon className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-slate-900">{benefit.title}</h4>
                                <p className="text-sm text-slate-600">{benefit.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Pricing Packages */}
            {!isPermanentVIP && (
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-6">Choose Your Plan</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {packages.map((pkg) => (
                            <div
                                key={pkg.id}
                                className="bg-white border-2 border-slate-200 rounded-2xl p-6 hover:border-purple-500 hover:shadow-lg transition"
                            >
                                {pkg.discount > 0 && (
                                    <div className="inline-block px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full mb-3">
                                        SAVE {pkg.discount}%
                                    </div>
                                )}
                                <h3 className="text-xl font-bold text-slate-900">{pkg.name}</h3>
                                <div className="mt-4 mb-6">
                                    <span className="text-3xl font-black text-purple-600">
                                        {pkg.price.toLocaleString()}đ
                                    </span>
                                    <span className="text-slate-500 text-sm ml-1">/ {pkg.duration} days</span>
                                </div>
                                <button
                                    onClick={() => handlePurchase(pkg.id)}
                                    disabled={purchasing}
                                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:scale-105 transition disabled:opacity-50"
                                >
                                    {purchasing ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : 'Purchase'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
