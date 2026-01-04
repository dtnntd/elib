import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { BookOpen, Plus, Edit, Trash2, Package, Loader2, Barcode, Filter, ChevronLeft, ChevronRight, Save, X } from 'lucide-react';

export default function BookManagementPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';
    const isStaff = user?.role === 'ADMIN' || user?.role === 'STAFF';

    // Data State
    const [books, setBooks] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [totalBooks, setTotalBooks] = useState(0);
    const [loading, setLoading] = useState(true);

    // Filter & Pagination State
    const [params, setParams] = useState({
        page: 1,
        limit: 20,
        q: '',
        language: '',
        subject: ''
    });

    // Modal State
    const [showBookModal, setShowBookModal] = useState(false);
    const [showCopiesModal, setShowCopiesModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedBook, setSelectedBook] = useState(null);

    useEffect(() => {
        fetchData();
    }, [params]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Build query string
            const query = new URLSearchParams({
                page: params.page,
                limit: params.limit,
                q: params.q,
                language: params.language,
                subject: params.subject
            }).toString();

            const [booksRes, invRes] = await Promise.all([
                api.get(`/books?${query}`),
                api.get('/admin/inventory') // Fetch all inventory for mapping
            ]);

            setBooks(booksRes.data.data || []);
            setTotalBooks(booksRes.data.meta?.total || 0);
            setInventory(invRes.data || []);
        } catch (error) {
            console.error('Failed to fetch data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveBook = async (bookData, inventoryData) => {
        try {
            let bookId = selectedBook?.id;
            if (isEditing) {
                await api.put(`/admin/books/${bookId}`, bookData);
            } else {
                const res = await api.post('/admin/books', bookData);
                bookId = res.data.bookId;
            }

            if (inventoryData) {
                const promises = Object.entries(inventoryData).map(([branchId, totalCopies]) => {
                    return api.post('/admin/inventory', {
                        bookId: bookId,
                        branchId: branchId,
                        totalCopies: parseInt(totalCopies)
                    });
                });
                await Promise.all(promises);
            }

            alert(isEditing ? 'Book updated successfully' : 'Book added successfully');
            setShowBookModal(false);
            fetchData();
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.error || 'Failed to save book');
        }
    };

    const handleEditBook = async (book) => {
        setSelectedBook(book);
        setIsEditing(true);
        setShowBookModal(true);
    };

    const handleCreateBook = () => {
        setSelectedBook(null);
        setIsEditing(false);
        setShowBookModal(true);
    };

    const handleDeleteBook = async (bookId) => {
        if (!confirm('Delete this book? This will also remove all inventory records.')) return;
        try {
            await api.delete(`/admin/books/${bookId}`);
            alert('Book deleted successfully');
            fetchData();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to delete book');
        }
    };

    const getInventoryForBook = (bookId) => {
        return (inventory || []).filter(inv => inv.bookId === bookId);
    };

    const totalPages = Math.ceil(totalBooks / params.limit);

    if (loading && books.length === 0) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-cyan-600" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                        <BookOpen className="h-8 w-8 text-cyan-600" />
                        Book Management
                    </h1>
                    <p className="text-slate-600 mt-1">Manage books, inventory, and view detailed copy status</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={handleCreateBook}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition shadow-sm"
                    >
                        <Plus className="h-5 w-5" /> Add New Book
                    </button>
                )}
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        placeholder="Search by title, author, ISBN..."
                        value={params.q}
                        onChange={(e) => setParams({ ...params, q: e.target.value, page: 1 })}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    />
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
                <select
                    value={params.language}
                    onChange={(e) => setParams({ ...params, language: e.target.value, page: 1 })}
                    className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                >
                    <option value="">All Languages</option>
                    <option value="en">English</option>
                    <option value="vi">Vietnamese</option>
                </select>
                <input
                    type="text"
                    placeholder="Subject..."
                    value={params.subject}
                    onChange={(e) => setParams({ ...params, subject: e.target.value, page: 1 })}
                    className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
                <button
                    onClick={() => setParams({ page: 1, limit: 20, q: '', language: '', subject: '' })}
                    className="px-4 py-2 text-slate-500 hover:text-slate-700 font-semibold"
                >
                    Reset
                </button>
            </div>

            {/* Books List */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Book</th>
                                <th className="px-6 py-4">ISBN</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Inventory</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {books.map((book) => {
                                const bookInv = getInventoryForBook(book.id);
                                return (
                                    <tr key={book.id} className="hover:bg-slate-50 transition">
                                        <td className="px-6 py-4 max-w-xs">
                                            <div className="font-semibold text-slate-900 truncate" title={book.title}>{book.title}</div>
                                            <div className="text-xs text-slate-500 truncate">{book.authors?.join(', ')}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-xs text-slate-600">{book.isbn}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {book.hasDigital ? (
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${book.accessModel === 'UNLIMITED'
                                                    ? 'bg-purple-100 text-purple-800'
                                                    : 'bg-orange-100 text-orange-800'
                                                    }`}>
                                                    {book.accessModel === 'UNLIMITED' ? 'Unlimited E-book' : 'Digital (OCOU)'}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                                    Physical Only
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="text-xs font-bold text-emerald-700 pb-1 border-b border-emerald-100 mb-1">
                                                    Total: {bookInv.reduce((sum, i) => sum + i.availableCopies, 0)}/{bookInv.reduce((sum, i) => sum + i.totalCopies, 0)}
                                                </div>
                                                {bookInv.length === 0 ? (
                                                    <span className="text-xs text-slate-400">No inventory</span>
                                                ) : (
                                                    bookInv.map(inv => (
                                                        <div key={inv.id} className="text-xs text-slate-600">
                                                            <span className="font-semibold text-slate-700">{inv.branchId}:</span> {inv.availableCopies}/{inv.totalCopies}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedBook(book);
                                                        setShowCopiesModal(true);
                                                    }}
                                                    className="p-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
                                                    title="View Physical Copies & Barcodes"
                                                >
                                                    <Barcode className="h-4 w-4" />
                                                </button>
                                                {isAdmin && (
                                                    <>
                                                        <button
                                                            onClick={() => handleEditBook(book)}
                                                            className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                                                            title="Edit Book Details"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteBook(book.id)}
                                                            className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                                                            title="Delete Book"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span>Show</span>
                        <select
                            value={params.limit}
                            onChange={(e) => setParams({ ...params, limit: Number(e.target.value), page: 1 })}
                            className="border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        <span>per page</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-600">
                            Page <strong>{params.page}</strong> of <strong>{totalPages || 1}</strong>
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setParams({ ...params, page: Math.max(1, params.page - 1) })}
                                disabled={params.page === 1}
                                className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setParams({ ...params, page: Math.min(totalPages, params.page + 1) })}
                                disabled={params.page >= totalPages}
                                className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add/Edit Book Modal */}
            {showBookModal && (
                <BookModal
                    book={isEditing ? selectedBook : null}
                    existingInventory={isEditing && selectedBook ? getInventoryForBook(selectedBook.id) : []}
                    onClose={() => setShowBookModal(false)}
                    onSubmit={handleSaveBook}
                />
            )}

            {showCopiesModal && selectedBook && (
                <PhysicalCopiesModal
                    book={selectedBook}
                    onClose={() => setShowCopiesModal(false)}
                />
            )}
        </div>
    );
}

// Add/Edit Book Modal Component
function BookModal({ book, existingInventory, onClose, onSubmit }) {
    const [formData, setFormData] = useState({
        isbn: book?.isbn || '',
        title: book?.title || '',
        authors: book?.authors?.join(', ') || '',
        publisher: book?.publisher || '',
        publishedYear: book?.publishedYear || new Date().getFullYear(),
        price: book?.price || 0,
        lang: book?.lang || 'en',
        description: book?.description || '',
        subjects: book?.subjects?.join(', ') || '',
        // Digital Rights
        hasDigital: false,
        accessModel: 'UNLIMITED',
        concurrentLimit: 1
    });

    // Inventory State
    const [inventory, setInventory] = useState({
        HN: 0,
        HP: 0,
        DN: 0
    });

    // Initialize Inventory from existing data
    useEffect(() => {
        if (existingInventory && existingInventory.length > 0) {
            const newInv = { HN: 0, HP: 0, DN: 0 };
            existingInventory.forEach(inv => {
                if (newInv[inv.branchId] !== undefined) {
                    newInv[inv.branchId] = inv.totalCopies;
                }
            });
            setInventory(newInv);
        }
    }, [existingInventory]);

    // Fetch license info if editing
    useEffect(() => {
        if (book && book.id) {
            api.get(`/admin/books/${book.id}/license`)
                .then(res => {
                    const data = res.data;
                    if (data.hasDigital) {
                        setFormData(prev => ({
                            ...prev,
                            hasDigital: true,
                            accessModel: data.accessModel || 'UNLIMITED',
                            concurrentLimit: data.concurrentLimit || 1
                        }));
                    }
                })
                .catch(err => console.log('No license found or error', err));
        }
    }, [book]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            ...formData,
            authors: formData.authors.split(',').map(a => a.trim()),
            subjects: formData.subjects.split(',').map(s => s.trim()).filter(Boolean),
            concurrentLimit: parseInt(formData.concurrentLimit || 1)
        }, inventory);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">{book ? 'Edit Book' : 'Add New Book'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">ISBN *</label>
                            <input
                                type="text"
                                required
                                value={formData.isbn}
                                onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Language</label>
                            <select
                                value={formData.lang}
                                onChange={(e) => setFormData({ ...formData, lang: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                            >
                                <option value="en">English</option>
                                <option value="vi">Vietnamese</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Title *</label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Authors * (comma-separated)</label>
                        <input
                            type="text"
                            required
                            value={formData.authors}
                            onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                            placeholder="Author 1, Author 2"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Publisher</label>
                            <input
                                type="text"
                                value={formData.publisher}
                                onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Year</label>
                            <input
                                type="number"
                                value={formData.publishedYear}
                                onChange={(e) => setFormData({ ...formData, publishedYear: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Price (VND)</label>
                        <input
                            type="number"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Subjects (comma-separated)</label>
                        <input
                            type="text"
                            value={formData.subjects}
                            onChange={(e) => setFormData({ ...formData, subjects: e.target.value })}
                            placeholder="Fiction, Science, History"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-2 mb-3">
                            <input
                                type="checkbox"
                                id="hasDigital"
                                checked={formData.hasDigital}
                                onChange={(e) => setFormData({ ...formData, hasDigital: e.target.checked })}
                                className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
                            />
                            <label htmlFor="hasDigital" className="text-sm font-bold text-slate-800">
                                Enable Digital Access (E-book)
                            </label>
                        </div>

                        {formData.hasDigital && (
                            <div className="grid md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">License Type</label>
                                    <select
                                        value={formData.accessModel}
                                        onChange={(e) => setFormData({ ...formData, accessModel: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                                    >
                                        <option value="UNLIMITED">Unlimited Access</option>
                                        <option value="OCOU">Limited (One Copy One User)</option>
                                    </select>
                                </div>
                                {formData.accessModel === 'OCOU' && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Concurrent Limit</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.concurrentLimit}
                                            onChange={(e) => setFormData({ ...formData, concurrentLimit: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Inventory Section */}
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                        <h3 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
                            Physical Inventory (Total Copies)
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            {['HN', 'HP', 'DN'].map(branch => (
                                <div key={branch}>
                                    <label className="block text-xs font-semibold text-emerald-700 mb-1">
                                        {branch === 'HN' ? 'Hanoi' : branch === 'HP' ? 'Haiphong' : 'Danang'}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={inventory[branch]}
                                        onChange={(e) => setInventory({ ...inventory, [branch]: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 text-sm border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            className="flex-1 py-2 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition"
                        >
                            {book ? 'Save Changes' : 'Add Book'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}

// Physical Copies Modal
function PhysicalCopiesModal({ book, onClose }) {
    const { user } = useAuth();
    const [copies, setCopies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterBranch, setFilterBranch] = useState('ALL');
    const [editingCopy, setEditingCopy] = useState(null); // ID of copy being edited
    const [editForm, setEditForm] = useState({ status: '', condition: '' });

    useEffect(() => {
        fetchCopies();
    }, [book]);

    const fetchCopies = () => {
        setLoading(true);
        api.get(`/admin/books/${book.id}/physical-copies`)
            .then(res => setCopies(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    };

    const handleEditClick = (copy) => {
        setEditingCopy(copy.id);
        setEditForm({ status: copy.status, condition: copy.condition });
    };

    const handleSaveCopy = async (copyId) => {
        try {
            await api.put(`/admin/physical-copies/${copyId}`, editForm);
            setEditingCopy(null);
            fetchCopies(); // Refresh
        } catch (error) {
            alert(error.response?.data?.error || "Failed to update copy");
        }
    };

    const handleCancelEdit = () => {
        setEditingCopy(null);
    };

    const filteredCopies = filterBranch === 'ALL'
        ? copies
        : copies.filter(c => c.branchId === filterBranch);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[80vh] flex flex-col shadow-2xl">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Barcode className="h-5 w-5 text-cyan-600" /> Physical Copies
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">{book.title} <span className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded border border-slate-200 ml-1">{book.isbn}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-4 border-b border-slate-100 flex gap-4 items-center bg-white">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Filter className="h-4 w-4" /> Filter Branch:
                    </div>
                    <select
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        value={filterBranch}
                        onChange={(e) => setFilterBranch(e.target.value)}
                    >
                        <option value="ALL">All Branches</option>
                        <option value="HN">Hanoi</option>
                        <option value="HP">Haiphong</option>
                        <option value="DN">Danang</option>
                    </select>
                    <div className="ml-auto text-sm text-slate-500">
                        Showing <strong>{filteredCopies.length}</strong> copies
                    </div>
                </div>

                <div className="overflow-y-auto p-0 flex-1 bg-slate-50/30">
                    {loading ? (
                        <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-cyan-600" /></div>
                    ) : filteredCopies.length === 0 ? (
                        <div className="text-center p-12 text-slate-500">No physical copies found for this selection.</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 top-0 sticky z-10 shadow-sm text-xs uppercase text-slate-500 font-semibold">
                                <tr>
                                    <th className="px-6 py-3">Barcode</th>
                                    <th className="px-6 py-3">Branch</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Condition</th>
                                    <th className="px-6 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {filteredCopies.map(copy => {
                                    const isEditing = editingCopy === copy.id;
                                    const canEdit = user.role === 'ADMIN' || (user.role === 'STAFF' && user.branchId === copy.branchId);

                                    return (
                                        <tr key={copy.id} className="hover:bg-slate-50 group transition">
                                            <td className="px-6 py-3 font-mono font-medium text-slate-700">{copy.barcode}</td>
                                            <td className="px-6 py-3">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                                                    {copy.branchId}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3">
                                                {isEditing ? (
                                                    <select
                                                        value={editForm.status}
                                                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                                        className="w-full text-xs p-1 border rounded"
                                                    >
                                                        <option value="AVAILABLE">AVAILABLE</option>
                                                        <option value="BORROWED">BORROWED</option>
                                                        <option value="RESERVED">RESERVED</option>
                                                        <option value="LOST">LOST</option>
                                                        <option value="DAMAGED">DAMAGED</option>
                                                    </select>
                                                ) : (
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ring-1 ring-inset ${copy.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' :
                                                        copy.status === 'BORROWED' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' :
                                                            copy.status === 'RESERVED' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' :
                                                                'bg-red-50 text-red-700 ring-red-600/20'
                                                        }`}>
                                                        {copy.status}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-slate-600">
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={editForm.condition}
                                                        onChange={(e) => setEditForm({ ...editForm, condition: e.target.value })}
                                                        className="w-full text-xs p-1 border rounded"
                                                    />
                                                ) : (
                                                    copy.condition
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                {isEditing ? (
                                                    <div className="flex justify-end gap-1">
                                                        <button onClick={() => handleSaveCopy(copy.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Save className="h-4 w-4" /></button>
                                                        <button onClick={handleCancelEdit} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="h-4 w-4" /></button>
                                                    </div>
                                                ) : (
                                                    canEdit && (
                                                        <button
                                                            onClick={() => handleEditClick(copy)}
                                                            className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded opacity-0 group-hover:opacity-100 transition"
                                                            title="Edit Status"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                    )
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
