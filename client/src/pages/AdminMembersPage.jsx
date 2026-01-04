import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Users, Crown, Shield, Star, Loader2, Search } from 'lucide-react';

export default function AdminMembersPage() {
    const { user } = useAuth();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [processing, setProcessing] = useState(null);

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        try {
            const res = await api.get('/admin/members');
            setMembers(res.data);
        } catch (error) {
            console.error('Failed to fetch members', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGrantVIP = async (memberId, duration = 30) => {
        if (!confirm(`Grant ${duration} days VIP to this user?`)) return;

        setProcessing(memberId);
        try {
            await api.post(`/admin/grant-vip/${memberId}`, { duration });
            alert('VIP granted successfully');
            fetchMembers();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to grant VIP');
        } finally {
            setProcessing(null);
        }
    };

    const handlePromoteRole = async (memberId, role) => {
        if (!confirm(`Promote user to ${role}? This will grant permanent VIP.`)) return;

        setProcessing(memberId);
        try {
            await api.post(`/admin/promote-role/${memberId}`, { role });
            alert(`User promoted to ${role} successfully`);
            fetchMembers();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to promote user');
        } finally {
            setProcessing(null);
        }
    };

    const handleRevokeVIP = async (memberId) => {
        if (!confirm('Revoke VIP from this user?')) return;

        setProcessing(memberId);
        try {
            await api.delete(`/admin/revoke-vip/${memberId}`);
            alert('VIP revoked successfully');
            fetchMembers();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to revoke VIP');
        } finally {
            setProcessing(null);
        }
    };

    const handleDowngradeRole = async (memberId) => {
        if (!confirm('Downgrade this user\'s role?')) return;

        setProcessing(memberId);
        try {
            await api.post(`/admin/downgrade-role/${memberId}`);
            alert('User downgraded successfully');
            fetchMembers();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to downgrade user');
        } finally {
            setProcessing(null);
        }
    };

    const filteredMembers = members.filter(m =>
        m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRoleBadge = (role) => {
        switch (role) {
            case 'ADMIN':
                return <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full border border-yellow-200"><Crown className="h-3 w-3" /> ADMIN</span>;
            case 'STAFF':
                return <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full border border-blue-200"><Shield className="h-3 w-3" /> STAFF</span>;
            default:
                return <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">USER</span>;
        }
    };

    const getVIPBadge = (member) => {
        if (!member.isVip) return null;

        const isPermanent = !member.vipExpiresAt;
        const isExpired = member.vipExpiresAt && new Date(member.vipExpiresAt) < new Date();

        if (isExpired) return null;

        return (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full border border-purple-200">
                <Star className="h-3 w-3" /> VIP {isPermanent && '(∞)'}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-cyan-600" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                        <Users className="h-8 w-8 text-cyan-600" />
                        Member Management
                    </h1>
                    <p className="text-slate-600 mt-1">Manage user roles and VIP memberships</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
            </div>

            {/* Members Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Member</th>
                            <th className="px-6 py-4">Branch</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">VIP Status</th>
                            <th className="px-6 py-4">Wallet</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredMembers.map((member) => (
                            <tr key={member.id} className="hover:bg-slate-50 transition">
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-slate-900">{member.fullName}</div>
                                    <div className="text-xs text-slate-500">{member.email}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded">
                                        {{ 'HN': 'Hanoi', 'HP': 'Haiphong', 'DN': 'Danang' }[member.branchId] || member.branchId}
                                    </span>
                                </td>
                                <td className="px-6 py-4">{getRoleBadge(member.role)}</td>
                                <td className="px-6 py-4">
                                    {getVIPBadge(member) || <span className="text-slate-400 text-xs">No VIP</span>}
                                    {member.vipExpiresAt && !member.vipExpiresAt.includes('0001') && (
                                        <div className="text-xs text-slate-500 mt-1">
                                            Expires: {new Date(member.vipExpiresAt).toLocaleDateString()}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="font-mono text-slate-700">{member.walletBalance.toLocaleString()}đ</span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex justify-end gap-2">
                                        {/* Grant VIP (Admin/Staff) */}
                                        {member.role === 'MEMBER' && (
                                            <button
                                                onClick={() => handleGrantVIP(member.id)}
                                                disabled={processing === member.id}
                                                className="px-3 py-1.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg hover:bg-purple-200 transition disabled:opacity-50"
                                            >
                                                Grant VIP
                                            </button>
                                        )}

                                        {/* Promote to Staff (Admin only) */}
                                        {user?.role === 'ADMIN' && member.role === 'MEMBER' && (
                                            <button
                                                onClick={() => handlePromoteRole(member.id, 'STAFF')}
                                                disabled={processing === member.id}
                                                className="px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-200 transition disabled:opacity-50"
                                            >
                                                → Staff
                                            </button>
                                        )}

                                        {/* Promote to Admin (Admin only) */}
                                        {user?.role === 'ADMIN' && (member.role === 'MEMBER' || member.role === 'STAFF') && (
                                            <button
                                                onClick={() => handlePromoteRole(member.id, 'ADMIN')}
                                                disabled={processing === member.id}
                                                className="px-3 py-1.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-lg hover:bg-yellow-200 transition disabled:opacity-50"
                                            >
                                                → Admin
                                            </button>
                                        )}

                                        {/* Revoke VIP (Admin/Staff) */}
                                        {member.isVip && member.role === 'MEMBER' && (
                                            <button
                                                onClick={() => handleRevokeVIP(member.id)}
                                                disabled={processing === member.id}
                                                className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-200 transition disabled:opacity-50"
                                            >
                                                Revoke VIP
                                            </button>
                                        )}

                                        {/* Downgrade Role (Admin only) */}
                                        {user?.role === 'ADMIN' && (member.role === 'STAFF' || member.role === 'ADMIN') && (
                                            <button
                                                onClick={() => handleDowngradeRole(member.id)}
                                                disabled={processing === member.id}
                                                className="px-3 py-1.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-lg hover:bg-orange-200 transition disabled:opacity-50"
                                            >
                                                ↓ Downgrade
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
