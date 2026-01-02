import { useState, useEffect } from 'react';
import api from '../api/axios';
import { BookCard } from '../components/BookCard';
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Catalog() {
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchBooks = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/books?page=${page}&limit=12&q=${debouncedSearch}`);
            setBooks(res.data.data || []);
            setTotalPages(res.data.meta.totalPages);
        } catch (error) {
            console.error("Failed to fetch books", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBooks();
    }, [page, debouncedSearch]);

    return (
        <div className="space-y-6">
            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search for books, authors..."
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPage(1); // Reset to page 1 on search
                    }}
                    className="w-full rounded-xl border border-white/10 bg-slate-800/50 py-4 pl-12 pr-4 text-white placeholder-slate-400 backdrop-blur-sm transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
                </div>
            ) : (
                <>
                    {books.length > 0 ? (
                        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                            {books.map((book) => (
                                <BookCard key={book.id} book={book} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-slate-400 py-12">
                            No books found matching your search.
                        </div>
                    )}
                </>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-white/10 pt-6">
                <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
                >
                    <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <span className="text-sm text-slate-400">
                    Page <span className="text-white font-bold">{page}</span> of {totalPages}
                </span>
                <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
                >
                    Next <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
