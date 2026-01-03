import { useState, useEffect } from 'react';
import api from '../api/axios';
import { BookCard } from '../components/BookCard';
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Catalog() {
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Filters
    // Removed author state as it is integrated into main search
    const [language, setLanguage] = useState('');
    const [year, setYear] = useState('');
    const [subject, setSubject] = useState('');

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchBooks = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page,
                limit: 12,
                q: debouncedSearch,
                language,
                year,
                subject
            });
            const res = await api.get(`/books?${params.toString()}`);
            const booksData = res.data.data || [];
            // Filter out any null/undefined items to prevent crashes
            setBooks(booksData.filter(item => item && typeof item === 'object'));
            setTotalPages(res.data?.meta?.totalPages || 0);
        } catch (error) {
            console.error("Failed to fetch books", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBooks();
    }, [page, debouncedSearch, language, year, subject]);

    return (
        <div className="space-y-6">
            {/* Search & Filter Bar */}
            <div className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search for books..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                        className="w-full rounded-xl border border-white/10 bg-slate-800/50 py-4 pl-12 pr-4 text-white placeholder-slate-400 backdrop-blur-sm transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                </div>

                {/* Advanced Filters */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <select
                        value={language}
                        onChange={e => setLanguage(e.target.value)}
                        className="bg-slate-800/50 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                        <option value="">All Languages</option>
                        <option value="Vietnamese">Vietnamese</option>
                        <option value="English">English</option>
                    </select>
                    <input
                        type="number"
                        placeholder="Year"
                        value={year}
                        onChange={e => setYear(e.target.value)}
                        className="bg-slate-800/50 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                    <input
                        placeholder="Subject"
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        className="bg-slate-800/50 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                </div>

                {/* Quick Subject Tags */}
                <div className="flex flex-wrap gap-2">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-widest py-1">Popular Topics:</span>
                    {['Computer Science', 'Mathematics', 'Physics', 'History', 'Literature', 'Fiction', 'Business'].map(tag => (
                        <button
                            key={tag}
                            onClick={() => setSubject(subject === tag ? '' : tag)}
                            className={cn(
                                "text-xs px-3 py-1 rounded-full border transition",
                                subject === tag
                                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm shadow-cyan-500/20"
                                    : "bg-slate-800/50 border-white/10 text-slate-400 hover:border-white/30 hover:text-slate-300"
                            )}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
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
