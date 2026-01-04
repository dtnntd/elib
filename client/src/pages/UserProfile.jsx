import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Building, Save, AlertCircle, CheckCircle } from 'lucide-react';

const UserProfile = () => {
    const { user, updateProfile } = useAuth();
    const [fullName, setFullName] = useState(user?.fullName || '');
    const [branchId, setBranchId] = useState(user?.branchId || 'HN');

    // Password State
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [status, setStatus] = useState({ type: '', msg: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', msg: '' });
        setLoading(true);

        if (newPassword && newPassword !== confirmPassword) {
            setStatus({ type: 'error', msg: 'New passwords do not match' });
            setLoading(false);
            return;
        }

        if (newPassword && !oldPassword) {
            setStatus({ type: 'error', msg: 'Current password is required to set a new one' });
            setLoading(false);
            return;
        }

        const res = await updateProfile(fullName, branchId, newPassword, oldPassword);

        if (res.success) {
            setStatus({ type: 'success', msg: 'Profile updated successfully!' });
            // Clear password fields on success
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } else {
            setStatus({ type: 'error', msg: res.error });
        }
        setLoading(false);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <User className="h-8 w-8 text-cyan-600" /> My Profile
            </h1>

            <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Status Message */}
                    {status.msg && (
                        <div className={`p-4 rounded-lg flex items-center gap-2 ${status.type === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}>
                            {status.type === 'error' ? <AlertCircle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                            {status.msg}
                        </div>
                    )}

                    {/* General Info */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-slate-800 border-b border-slate-200 pb-2">General Information</h2>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full rounded-lg bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Library Branch</label>
                            <div className="relative">
                                <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <select
                                    value={branchId}
                                    onChange={(e) => setBranchId(e.target.value)}
                                    className="w-full rounded-lg bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition appearance-none"
                                >
                                    <option value="HN">Hanoi (HN)</option>
                                    <option value="HP">Haiphong (HP)</option>
                                    <option value="DN">Danang (DN)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Security Section */}
                    <div className="space-y-4 pt-4">
                        <h2 className="text-xl font-semibold text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                            <Lock className="h-5 w-5 text-amber-500" /> Security
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-600 mb-1">Current Password</label>
                                <input
                                    type="password"
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    placeholder="Required to change password"
                                    className="w-full rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition placeholder:text-slate-400"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="New password"
                                    className="w-full rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    className="w-full rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-200 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2.5 px-6 rounded-lg transition active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Saving...' : <><Save className="h-4 w-4" /> Save Changes</>}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default UserProfile;
