import { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { Loader2, TrendingUp, Users, BookOpen, DollarSign } from 'lucide-react';
import api from '../api/axios';
import { cn } from '../lib/utils';

export default function StatsDashboard() {
    const [stats, setStats] = useState(null);
    const [trends, setTrends] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, trendsRes] = await Promise.all([
                    api.get('/stats/dashboard'),
                    api.get('/stats/trends')
                ]);
                setStats(statsRes.data);

                // Format trends for chart
                const formattedTrends = (trendsRes.data || []).map(item => ({
                    name: `${item._id.month}/${item._id.year}`,
                    loans: item.count
                }));
                setTrends(formattedTrends);
            } catch (error) {
                console.error("Failed to fetch analytics", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-cyan-500" /></div>;
    if (!stats) return <div className="text-white text-center">Failed to load statistics</div>;

    const COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b'];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Books"
                    value={stats.totalBooks}
                    icon={<BookOpen className="h-5 w-5 text-cyan-400" />}
                    color="bg-cyan-500/10 border-cyan-500/20"
                />
                <StatCard
                    title="Total Members"
                    value={stats.totalMembers}
                    icon={<Users className="h-5 w-5 text-purple-400" />}
                    color="bg-purple-500/10 border-purple-500/20"
                />
                <StatCard
                    title="Active Loans"
                    value={stats.activeLoans}
                    icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
                    color="bg-emerald-500/10 border-emerald-500/20"
                />
                <StatCard
                    title="Total Revenue"
                    value={`${stats.totalRevenue.toLocaleString()} đ`}
                    icon={<DollarSign className="h-5 w-5 text-amber-400" />}
                    color="bg-amber-500/10 border-amber-500/20"
                />
            </div>

            {/* Charts Section */}
            <div className="grid md:grid-cols-3 gap-6">
                {/* Monthly Trends - Bar Chart */}
                <div className="md:col-span-2 bg-slate-800/50 border border-white/10 rounded-xl p-6 shadow-xl backdrop-blur-sm">
                    <h3 className="text-lg font-semibold text-white mb-6">Monthly Borrowing Trends</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trends}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                    itemStyle={{ color: '#22d3ee' }}
                                    cursor={{ fill: '#ffffff05' }}
                                />
                                <Bar dataKey="loans" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Distribution - Pie Chart (Simulated Data for now as we didn't add Categorization API yet) */}
                <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6 shadow-xl backdrop-blur-sm">
                    <h3 className="text-lg font-semibold text-white mb-6">Loan Distribution</h3>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Physical', value: stats.activeLoans > 0 ? stats.activeLoans : 10 },
                                        { name: 'E-Book', value: 5 } // Placeholder
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
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color }) {
    return (
        <div className={cn("rounded-xl border p-6 bg-slate-800/30 backdrop-blur-sm flex items-center justify-between", color)}>
            <div>
                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">{title}</p>
                <p className="text-2xl font-bold text-white mt-1">{value}</p>
            </div>
            <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                {icon}
            </div>
        </div>
    );
}
