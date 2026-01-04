import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Shield, Users, BookOpen, AlertCircle, Package, Plus, Trash2 } from 'lucide-react';

const PolicyManagementPage = () => {
    const [policy, setPolicy] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        fetchPolicy();
    }, []);

    const fetchPolicy = async () => {
        try {
            const res = await axios.get('http://localhost:8081/api/admin/policy', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPolicy(res.data.value);
            setLoading(false);
        } catch (err) {
            setError('Failed to load policy settings.');
            setLoading(false);
        }
    };

    const handleSavePolicy = async () => {
        try {
            setError('');
            setSuccess('');
            await axios.put('http://localhost:8081/api/admin/policy',
                policy,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSuccess('Policy updated successfully!');
        } catch (err) {
            setError('Failed to update policy.');
        }
    };

    const handleChange = (role, field, value) => {
        setPolicy(prev => ({
            ...prev,
            [role]: {
                ...prev[role],
                [field]: parseInt(value)
            }
        }));
    };

    if (!user.role || user.role !== 'ADMIN') {
        return <div className="p-8 text-red-500">Access Denied</div>;
    }

    if (loading) return <div className="p-8">Loading settings...</div>;

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center mb-8">
                    <Shield className="w-8 h-8 text-indigo-600 mr-3" />
                    <h1 className="text-3xl font-bold text-gray-800">System Configuration</h1>
                </div>

                {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded shadow-sm flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2" />
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded shadow-sm">
                        {success}
                    </div>
                )}

                {/* LOAN POLICY SECTION */}
                <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-indigo-600" />
                        Loan Policy Management
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* BASIC MEMBER CARD */}
                        <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
                            <div className="bg-gray-100 p-4 border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center">
                                    <Users className="w-5 h-5 text-gray-600 mr-2" />
                                    <h3 className="text-xl font-bold text-gray-700">Basic Member</h3>
                                </div>
                                <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs font-semibold">DEFAULT</span>
                            </div>
                            <div className="p-6 space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Physical Books</label>
                                    <input
                                        type="number"
                                        value={policy?.basic?.maxPhysical || 0}
                                        onChange={(e) => handleChange('basic', 'maxPhysical', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Simultaneous physical loans allowed.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max E-books (UNLIMITED)</label>
                                    <input
                                        type="number"
                                        value={policy?.basic?.maxDigitalUnlimited || 0}
                                        onChange={(e) => handleChange('basic', 'maxDigitalUnlimited', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Unlimited license books (Set -1 for infinite).</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max E-books (OCOU)</label>
                                    <input
                                        type="number"
                                        value={policy?.basic?.maxDigitalOCOU || 0}
                                        onChange={(e) => handleChange('basic', 'maxDigitalOCOU', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Restricted license books (One Copy One User).</p>
                                </div>
                            </div>
                        </div>

                        {/* VIP MEMBER CARD */}
                        <div className="bg-white rounded-xl shadow border border-yellow-100 overflow-hidden">
                            <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 p-4 border-b border-yellow-300 flex items-center justify-between">
                                <div className="flex items-center text-white">
                                    <BookOpen className="w-5 h-5 mr-2" />
                                    <h3 className="text-xl font-bold">VIP Member</h3>
                                </div>
                                <span className="bg-white text-yellow-600 px-2 py-1 rounded text-xs font-bold shadow-sm">PREMIUM</span>
                            </div>
                            <div className="p-6 space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Physical Books</label>
                                    <input
                                        type="number"
                                        value={policy?.vip?.maxPhysical || 0}
                                        onChange={(e) => handleChange('vip', 'maxPhysical', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-yellow-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max E-books (UNLIMITED)</label>
                                    <input
                                        type="number"
                                        value={policy?.vip?.maxDigitalUnlimited || 0}
                                        onChange={(e) => handleChange('vip', 'maxDigitalUnlimited', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-yellow-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Use <b>-1</b> for truly unlimited access.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max E-books (OCOU)</label>
                                    <input
                                        type="number"
                                        value={policy?.vip?.maxDigitalOCOU || 0}
                                        onChange={(e) => handleChange('vip', 'maxDigitalOCOU', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-yellow-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={handleSavePolicy}
                            className="flex items-center bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition shadow-lg font-bold"
                        >
                            <Save className="w-5 h-5 mr-2" />
                            Save Loan Policy
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PolicyManagementPage;
