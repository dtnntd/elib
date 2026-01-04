import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Loader2 } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setPending(true);

        const res = await login(email, password);
        setPending(false);

        if (res.success) {
            navigate('/');
        } else {
            setError(res.error);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-slate-200 sm:p-10">

                {/* Header */}
                <div className="text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20">
                        <BookOpen className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
                        Welcome back
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                        Sign in to access your digital library
                    </p>
                </div>

                {/* Form */}
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
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
                                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-500 transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none sm:text-sm"
                                placeholder="Email address"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-500 transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none sm:text-sm"
                                placeholder="Password"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                name="remember-me"
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                            />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-700">
                                Remember me
                            </label>
                        </div>
                        <div className="text-sm">
                            <a href="#" className="font-medium text-cyan-600 hover:text-cyan-500">
                                Forgot password?
                            </a>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={pending}
                        className="group relative flex w-full justify-center rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition-all hover:scale-[1.02] hover:shadow-cyan-500/40 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {pending ? (
                            <Loader2 className="animate-spin h-5 w-5" />
                        ) : (
                            "Sign in"
                        )}
                    </button>
                </form>

                <p className="text-center text-sm text-slate-600">
                    Don't have an account?{' '}
                    <Link to="/register" className="font-medium text-cyan-600 hover:text-cyan-500">
                        Sign up for free
                    </Link>
                </p>
            </div>
        </div>
    );
}
