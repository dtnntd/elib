import { Link } from 'react-router-dom';
import { Book as BookIcon } from 'lucide-react';
import { cn } from '../lib/utils';

export function BookCard({ book }) {
    if (!book) return null;

    // Generate a predictable gradient based on ID for visual variety
    const gradients = [
        'from-pink-500 to-rose-500',
        'from-cyan-500 to-blue-500',
        'from-emerald-500 to-teal-500',
        'from-amber-500 to-orange-500',
        'from-violet-500 to-purple-500'
    ];
    const gradientIndex = (book?.id?.length || 0) > 0
        ? book.id.charCodeAt(book.id.length - 1) % gradients.length
        : 0;
    const gradient = gradients[gradientIndex];

    return (
        <Link
            to={`/books/${book.id}`}
            className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-cyan-500 hover:shadow-cyan-500/20"
        >
            <div className={cn("aspect-[2/3] w-full bg-gradient-to-br p-6 flex items-center justify-center", gradient)}>
                <BookIcon className="h-16 w-16 text-white/80 transition-transform group-hover:scale-110" />
            </div>

            <div className="flex-1 p-4">
                <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {book.publishedYear}
                    </span>
                    <span className="inline-flex rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {book.lccCode}
                    </span>
                    {book.hasDigital && (
                        <span className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-xs font-bold shadow-sm",
                            book.accessModel === 'UNLIMITED'
                                ? "bg-purple-50 border-purple-200 text-purple-700"
                                : "bg-orange-50 border-orange-200 text-orange-700"
                        )}>
                            {book.accessModel === 'UNLIMITED' ? 'Unlimited' : 'Digital'}
                        </span>
                    )}
                </div>
                <h3 className="line-clamp-2 text-lg font-bold text-slate-900 group-hover:text-cyan-600">
                    {book.title}
                </h3>
                <p className="mt-1 line-clamp-1 text-sm text-slate-500">
                    by {book.authors?.join(', ') || 'Unknown Author'}
                </p>
            </div>
        </Link>
    );
}
