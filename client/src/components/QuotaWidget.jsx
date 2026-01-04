import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Book, Tablet, AlertCircle } from 'lucide-react';

export function QuotaWidget() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchQuota = async () => {
        try {
            const res = await api.get('/loans/my-quota');
            setStats(res.data);
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch quota", error);
        }
    };

    useEffect(() => {
        fetchQuota();
        // Poll every 30 seconds to keep updated
        const interval = setInterval(fetchQuota, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !stats) return null;

    const { usage, policy } = stats;

    const getStatusColor = (current, max) => {
        if (max === -1) return 'text-purple-600'; // Unlimited
        if (current >= max) return 'text-red-600 font-bold';
        if (current >= max * 0.8) return 'text-orange-600 font-bold';
        return 'text-slate-600';
    };

    return (
        <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            {/* Physical */}
            <div className="flex items-center gap-1.5" title={`Physical Books: ${usage.physical} / ${policy.maxPhysical}`}>
                <Book className="h-3.5 w-3.5 text-slate-400" />
                <span className={getStatusColor(usage.physical, policy.maxPhysical)}>
                    {usage.physical}/{policy.maxPhysical}
                </span>
            </div>

            <div className="w-px h-4 bg-slate-200"></div>

            {/* Digital Unlimited */}
            <div className="flex items-center gap-1.5" title={`Unlimited E-books: ${usage.digitalUnlimited} / ${policy.maxDigitalUnlimited === -1 ? '∞' : policy.maxDigitalUnlimited}`}>
                <Tablet className="h-3.5 w-3.5 text-purple-400" />
                <span className={getStatusColor(usage.digitalUnlimited, policy.maxDigitalUnlimited)}>
                    {usage.digitalUnlimited}/{policy.maxDigitalUnlimited === -1 ? '∞' : policy.maxDigitalUnlimited}
                </span>
            </div>

            {/* OCOU (Only show if used or strictly limited) */}
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3" title={`Limited (OCOU) E-books: ${usage.digitalOCOU} / ${policy.maxDigitalOCOU}`}>
                <span className="text-[10px] font-bold text-orange-500">OCOU</span>
                <span className={getStatusColor(usage.digitalOCOU, policy.maxDigitalOCOU)}>
                    {usage.digitalOCOU}/{policy.maxDigitalOCOU}
                </span>
            </div>
        </div>
    );
}
