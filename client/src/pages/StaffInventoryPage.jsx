import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Package, Plus, Minus, Loader2, Book } from 'lucide-react';

export default function StaffInventoryPage() {
    const { user } = useAuth();
    const [inventory, setInventory] = useState([]);
    const [books, setBooks] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Fetch inventory and basic book info
            // In a real app we might want a more optimized query
            const [invRes, booksRes] = await Promise.all([
                api.get('/staff/inventory'),
                api.get('/books?limit=1000') // Simplification for demo
            ]);

            setInventory(invRes.data);

            // Map books by ID for easy lookup
            const bookMap = {};
            if (booksRes.data.data) {
                booksRes.data.data.forEach(b => {
                    bookMap[b.id] = b;
                });
            }
            setBooks(bookMap);
        } catch (error) {
            console.error('Failed to fetch inventory', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateQuantity = async (bookId, action, quantity) => {
        try {
            await api.put(`/staff/inventory/${bookId}`, {
                action,
                quantity: Number(quantity)
            });
            fetchData(); // Refresh to ensure sync
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to update inventory');
        }
    };

    const filteredInventory = inventory.filter(inv => {
        const book = books[inv.bookId];
        return book?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            book?.isbn.toLowerCase().includes(searchTerm.toLowerCase());
    });

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
                        <Package className="h-8 w-8 text-cyan-600" />
                        Branch Inventory: {{ 'HN': 'Hanoi', 'HP': 'Haiphong', 'DN': 'Danang' }[user?.branchId] || user?.branchId}
                    </h1>
                    <p className="text-slate-600 mt-1">Manage physical book copies at your branch</p>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <input
                    type="text"
                    placeholder="Search by book title or ISBN..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
            </div>

            {/* Inventory List */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Book</th>
                            <th className="px-6 py-4">ISBN</th>
                            <th className="px-6 py-4 text-center">Total Copies</th>
                            <th className="px-6 py-4 text-center">Available</th>
                            <th className="px-6 py-4 text-right">Update Stock</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredInventory.map((inv) => {
                            const book = books[inv.bookId];
                            if (!book) return null; // Skip if book not found (deleted?)

                            return (
                                <tr key={inv.id} className="hover:bg-slate-50 transition">
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-slate-900">{book.title}</div>
                                        <div className="text-xs text-slate-500">{book.authors?.join(', ')}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-mono text-xs text-slate-600">{book.isbn}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="font-bold text-slate-900 text-lg">{inv.totalCopies}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`font-semibold ${inv.availableCopies > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {inv.availableCopies}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <QuantityUpdater
                                                onUpdate={(action, qty) => handleUpdateQuantity(inv.bookId, action, qty)}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredInventory.length === 0 && (
                            <tr>
                                <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                                    No inventory found matching your search.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Book className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                    <h4 className="font-semibold text-blue-900 text-sm">Inventory Note</h4>
                    <p className="text-xs text-blue-700 mt-1">
                        You can only update "Total Copies". Available copies will adjust automatically based on loans.
                        To add new books to the system, please contact an Administrator.
                    </p>
                </div>
            </div>
        </div>
    );
}

function QuantityUpdater({ onUpdate }) {
    const [quantity, setQuantity] = useState(1);

    return (
        <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
                onClick={() => onUpdate('remove', quantity)}
                className="p-1 hover:bg-white rounded-md text-red-600 transition shadow-sm"
                title="Remove copies"
            >
                <Minus className="h-4 w-4" />
            </button>
            <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-12 text-center bg-transparent text-sm font-semibold focus:outline-none"
            />
            <button
                onClick={() => onUpdate('add', quantity)}
                className="p-1 hover:bg-white rounded-md text-emerald-600 transition shadow-sm"
                title="Add copies"
            >
                <Plus className="h-4 w-4" />
            </button>
        </div>
    );
}
