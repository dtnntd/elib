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
            className="group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-800/50 shadow-lg transition-all hover:-translate-y-1 hover:border-cyan-500/50 hover:shadow-cyan-500/10"
        >
            <div className={cn("aspect-[2/3] w-full bg-gradient-to-br p-6 flex items-center justify-center", gradient)}>
                <BookIcon className="h-16 w-16 text-white/80 transition-transform group-hover:scale-110" />
            </div>

            <div className="flex-1 p-4">
                <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex rounded-full bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-300">
                        {book.publishedYear}
                    </span>
                    <span className="inline-flex rounded-full bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-300">
                        {book.lccCode}
                    </span>
                </div>
                <h3 className="line-clamp-2 text-lg font-semibold text-white group-hover:text-cyan-400">
                    {book.title}
                </h3>
                <p className="mt-1 line-clamp-1 text-sm text-slate-400">
                    by {book.authors?.join(', ') || 'Unknown Author'}
                </p>
            </div>
        </Link>
    );
}
