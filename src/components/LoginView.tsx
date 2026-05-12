import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import logo from '../assets/images/wentix_logo.png';

interface LoginViewProps {
  onLogin: (token: string) => void;
}

export function LoginView({ onLogin }: LoginViewProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('capi_token', data.token);
        onLogin(data.token);
      } else {
        setError(data.error || 'Credenciales incorrectas');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0" style={{
        backgroundImage: 'linear-gradient(rgba(59,130,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/5 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-20 w-56 bg-black/40 border border-blue-500/20 mb-5 px-6">
            <img src={logo} alt="Wentix AI" className="max-h-12 max-w-full object-contain" />
          </div>
          <h1 className="text-4xl font-black italic tracking-tight text-white uppercase">
            CAPI <span className="text-blue-400">CENTER</span>
          </h1>
          <p className="text-slate-500 text-xs mt-2 uppercase tracking-[0.3em] font-bold">
            Orbital Intelligence // Wentix AI
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-950 border border-slate-800 p-6 space-y-5">
          <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
            <Lock className="h-3.5 w-3.5 text-blue-400" />
            Acceso Seguro
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest block mb-2">
                Contraseña de Acceso
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-black/40 border border-slate-800 focus:border-blue-500 px-4 py-3 text-sm font-mono text-white outline-none transition-colors pr-12"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[10px] text-red-400 font-bold uppercase tracking-widest bg-red-500/10 border border-red-500/20 px-3 py-2"
              >
                ✗ {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black uppercase tracking-[0.2em] text-sm py-3 transition-colors shadow-[0_0_20px_rgba(59,130,246,0.3)]"
            >
              {loading ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>

        <p className="text-center text-[9px] text-slate-700 mt-4 font-mono uppercase tracking-widest">
          Powered by Wentix AI · Sistema Seguro
        </p>
      </motion.div>
    </div>
  );
}
