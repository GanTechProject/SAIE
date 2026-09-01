import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Lock, User, AlertCircle, Loader2 } from 'lucide-react'

interface LoginPageProps {
  onLogin: (user: { name: string; role: string; email: string }) => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid credentials')
        setLoading(false)
        return
      }
      localStorage.setItem('saie_session', JSON.stringify(data.user))
      onLogin(data.user)
    } catch {
      setError('Unable to connect to server. Ensure the backend is running.')
      setLoading(false)
    }
  }

  const inputStyle = (field: string) => ({
    width: '100%' as const,
    height: 52,
    padding: '0 16px 0 48px',
    fontSize: 15,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontWeight: 400 as const,
    background: focused === field ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.8)',
    color: '#f1f5f9',
    border: `1.5px solid ${focused === field ? '#3b82f6' : 'rgba(30, 41, 59, 0.8)'}`,
    borderRadius: 10,
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'all 200ms ease',
    letterSpacing: field === 'password' ? '0.5px' : '0',
  })

  const iconStyle = (field: string) => ({
    position: 'absolute' as const,
    left: 16,
    top: '50%',
    transform: 'translateY(-50%)',
    color: focused === field ? '#3b82f6' : '#475569',
    transition: 'color 200ms ease',
  })

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card" style={{ padding: '40px 36px 36px' }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
              boxShadow: '0 0 40px rgba(59, 130, 246, 0.25), 0 0 80px rgba(59, 130, 246, 0.1)',
            }}>
              <Lock size={28} color="#fff" strokeWidth={1.5} />
            </div>
            <h1 style={{
              fontSize: 20, fontWeight: 600, color: '#f1f5f9',
              margin: '0 0 8px', letterSpacing: '-0.3px',
            }}>
              SAP Automation Intelligence
            </h1>
            <p style={{
              fontSize: 13, color: '#64748b', margin: 0,
              letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 500,
            }}>
              Enterprise Platform
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)',
              marginBottom: 20, fontSize: 13, color: '#fca5a5', fontWeight: 500,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 16, position: 'relative' }}>
              <User size={18} style={iconStyle('email')} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                required
                autoFocus
                style={inputStyle('email')}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 28, position: 'relative' }}>
              <Lock size={18} style={iconStyle('password')} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                placeholder="Password"
                required
                style={inputStyle('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 14, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 6, color: focused === 'password' ? '#64748b' : '#334155',
                  display: 'flex', transition: 'color 200ms ease',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* LOGIN Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 52,
                fontSize: 15, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                letterSpacing: '1.5px', textTransform: 'uppercase' as const,
                color: '#fff',
                background: loading
                  ? 'linear-gradient(135deg, #1e40af, #1e3a8a)'
                  : 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)',
                border: 'none', borderRadius: 10,
                cursor: loading ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'all 200ms ease',
                boxShadow: '0 4px 24px rgba(37, 99, 235, 0.3), 0 0 0 0 rgba(37, 99, 235, 0)',
                transform: 'none',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = '0 6px 32px rgba(37, 99, 235, 0.45), 0 0 0 0 rgba(37, 99, 235, 0)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={e => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = '0 4px 24px rgba(37, 99, 235, 0.3), 0 0 0 0 rgba(37, 99, 235, 0)'
                  e.currentTarget.style.transform = 'none'
                }
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  Signing in...
                </>
              ) : (
                'LOGIN'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
