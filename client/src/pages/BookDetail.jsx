import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { Loader2, ArrowLeft, BookOpen, MapPin, CheckCircle, XCircle } from 'lucide-react';

export default function BookDetail() {
    const { id } = useParams();
    const [book, setBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pickupTime, setPickupTime] = useState('');

    useEffect(() => {
        const fetchBook = async () => {
            try {
                const res = await api.get(`/books/${id}`);
                setBook(res.data);
            } catch (error) {
                console.error("Failed to fetch book detail", error);
            } finally {
                setLoading(false);
            }
        };
        fetchBook();
    }, [id]);

    const handleBorrow = async (type) => {
        try {
            const payload = {
                bookId: book.id,
                type: type
            };

            if (type === 'PHYSICAL') {
                if (!pickupTime) {
                    alert("Please select a pickup appointment time.");
                    return;
                }
                payload.pickupAppointment = new Date(pickupTime).toISOString();
            }

            const res = await api.post('/loans/borrow', payload);
            alert(`Success: ${res.data.message}`);
            // Refresh book data to show updated stock
            const updatedBook = await api.get(`/books/${id}`);
            setBook(updatedBook.data);
            setPickupTime(''); // Reset time
        } catch (err) {
            alert(`Error: ${err.response?.data?.error || "Borrow failed"}`);
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;
    if (!book) return <div className="text-center text-white">Book not found</div>;

    return (
        <div className="mx-auto max-w-5xl space-y-8">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
                <ArrowLeft className="h-4 w-4" /> Back to Catalog
            </Link>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-800/50 shadow-2xl backdrop-blur-xl">
                <div className="grid md:grid-cols-3">
                    {/* Cover Placeholder - Could be actual image if we had URLs */}
                    <div className="flex aspect-[2/3] items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 md:aspect-auto">
                        <BookOpen className="h-32 w-32 text-white/20" />
                    </div>

                    <div className="p-8 md:col-span-2 md:p-10">
                        <div className="mb-4 flex items-start justify-between">
                            <div>
                                <span className="inline-block rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400 mb-2">
                                    {book.subjects?.[0] || 'General'}
                                </span>
                                <h1 className="text-3xl font-bold text-white sm:text-4xl">{book.title}</h1>
                                <p className="mt-2 text-lg text-slate-400">by {book.authors?.join(', ') || 'Unknown Author'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-emerald-400">{book.price?.toLocaleString()} đ</p>
                                <p className="text-xs text-slate-500">Replacement Cost</p>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-4 border-b border-white/10 pb-6">
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <span className="font-semibold text-white">Publisher:</span> {book.publisher} ({book.publishedYear})
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <span className="font-semibold text-white">LCC:</span> {book.lccCode}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <span className="font-semibold text-white">Language:</span> {book.lang}
                            </div>
                        </div>

                        <div className="py-6">
                            <h3 className="tex-sm font-semibold uppercase tracking-wider text-slate-500">Description</h3>
                            <p className="mt-3 leading-relaxed text-slate-300">
                                {book.description || "No description available for this book."}
                            </p>
                        </div>

                        {/* Actions / Availability */}
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            {/* Physical Status */}
                            <div className="rounded-xl bg-slate-900/50 p-4 ring-1 ring-white/10">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-white flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-cyan-400" /> Physical Copy
                                    </h4>
                                    <span className={book.availableCopies > 0 ? "text-emerald-400 text-sm font-bold" : "text-red-400 text-sm font-bold"}>
                                        {book.availableCopies > 0 ? "In Stock" : "Out of Stock"}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-400 mb-4">
                                    {book.availableCopies} available out of {book.totalCopies} copies across branches.
                                </p>

                                <div className="mb-3">
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Pickup Appointment</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                                        value={pickupTime}
                                        onChange={(e) => setPickupTime(e.target.value)}
                                        min={new Date().toISOString().slice(0, 16)}
                                    />
                                </div>

                                <button
                                    onClick={() => handleBorrow("PHYSICAL")}
                                    disabled={book.availableCopies === 0}
                                    className="w-full rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {book.availableCopies > 0 ? "Reserve Physical Copy" : "Unavailable"}
                                </button>
                            </div>

                            {/* Digital Status */}
                            <div className="rounded-xl bg-slate-900/50 p-4 ring-1 ring-white/10">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-white flex items-center gap-2">
                                        <BookOpen className="h-4 w-4 text-purple-400" /> E-Book
                                    </h4>
                                    <span className={book.hasEbook ? "text-emerald-400 text-sm font-bold" : "text-slate-500 text-sm font-bold"}>
                                        {book.hasEbook ? "Available" : "Not Licensed"}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-400 mb-4">
                                    {book.hasEbook ? "Read instantly on your device." : "Digital version not available."}
                                </p>
                                <button
                                    onClick={() => handleBorrow("DIGITAL")}
                                    disabled={!book.hasEbook}
                                    className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {book.hasEbook ? "Borrow E-Book" : "Not Available"}
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
