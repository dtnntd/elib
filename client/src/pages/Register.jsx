import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Loader2 } from 'lucide-react';

export default function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);

    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setPending(true);

        // Auto-login logic could be added here, but for now just redirect to login
        const res = await register(email, password, fullName);
        setPending(false);

        if (res.success) {
            navigate('/login');
        } else {
            setError(res.error);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8 rounded-2xl bg-white/5 p-8 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 sm:p-10">

                <div className="text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-pink-600 shadow-lg shadow-purple-500/20">
                        <UserPlus className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="mt-6 text-3xl font-bold tracking-tight text-white">
                        Create account
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                        Join the library community today
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500 ring-1 ring-red-500/20">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="fullName" className="sr-only">Full Name</label>
                            <input
                                id="fullName"
                                name="fullName"
                                type="text"
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full rounded-lg border-0 bg-slate-800/50 p-3 text-white placeholder-slate-400 ring-1 ring-white/10 transition focus:bg-slate-800 focus:ring-2 focus:ring-purple-500 sm:text-sm"
                                placeholder="Full Name"
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="sr-only">Email address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-lg border-0 bg-slate-800/50 p-3 text-white placeholder-slate-400 ring-1 ring-white/10 transition focus:bg-slate-800 focus:ring-2 focus:ring-purple-500 sm:text-sm"
                                placeholder="Email address"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-lg border-0 bg-slate-800/50 p-3 text-white placeholder-slate-400 ring-1 ring-white/10 transition focus:bg-slate-800 focus:ring-2 focus:ring-purple-500 sm:text-sm"
                                placeholder="Password"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={pending}
                        className="group relative flex w-full justify-center rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition-all hover:scale-[1.02] hover:shadow-purple-500/30 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {pending ? (
                            <Loader2 className="animate-spin h-5 w-5" />
                        ) : (
                            "Create account"
                        )}
                    </button>
                </form>

                <p className="text-center text-sm text-slate-400">
                    Already have an account?{' '}
                    <Link to="/login" className="font-medium text-purple-400 hover:text-purple-300">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
