'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useAuth } from '@/hooks/useAuth'
import AuthGuard from '@/components/Auth/AuthGuard'

export default function WelcomePage() {
  const router = useRouter()
  const { user, organizationId } = useAuth()
  const [orgName, setOrgName] = useState<string>('Seu Workspace')
  const [loadingOrg, setLoadingOrg] = useState(true)

  useEffect(() => {
    async function fetchOrgName() {
      if (!organizationId) { setLoadingOrg(false); return }
      try {
        const res = await fetch('/api/workspaces')
        if (res.ok) {
          const { data } = await res.json()
          const org = data?.[0]?.organization
          if (org?.name) setOrgName(org.name)
        }
      } catch { }
      setLoadingOrg(false)
    }
    if (organizationId) fetchOrgName()
  }, [organizationId])

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#f8fafc] flex flex-col relative overflow-hidden font-sans">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-gray-200/50 opacity-50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-gray-200/40 opacity-50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full border border-gray-200/30 opacity-50" />

        <div className="w-full flex justify-center py-10 relative z-10">
          <div className="flex items-center gap-2">
            <img src="/logos/Atlas.svg" alt="Atlas Eye Logo" className="h-6 w-auto object-contain drop-shadow-md" />
            <span className="text-xl font-bold tracking-tight text-gray-900">ATLAS <span className="text-cyan-500">EYE</span></span>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4 -mt-20">
          <div className="text-center mb-10">
            <p className="text-cyan-500 font-bold text-xs tracking-widest uppercase mb-3">Bem-vindo!</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#1e293b] tracking-tight mb-3">Sua conta foi vinculada</h1>
            <p className="text-gray-500 font-medium">Esse é o seu workspace.</p>
          </div>

          <div className="flex items-center justify-center gap-6 md:gap-8 mb-12">
            <div className="w-24 h-24 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex gap-1 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-200 animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" style={{ animationDelay: '200ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" style={{ animationDelay: '400ms' }} />
              </div>
              <span className="text-[10px] font-bold text-cyan-500 tracking-wider">VINCULADO</span>
            </div>
            <div className="w-24 h-24 bg-white rounded-2xl shadow-md shadow-cyan-500/10 border-2 border-cyan-400 flex flex-col items-center justify-center relative pt-2">
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#10b981] rounded-full flex items-center justify-center border-2 border-white text-white">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div className="text-cyan-500 mb-2">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M19 7h-3V6a4 4 0 00-8 0v1H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2z" /></svg>
              </div>
              <span className="text-[9px] font-extrabold text-gray-800 uppercase tracking-wide px-2 truncate max-w-full">
                {loadingOrg ? '...' : orgName}
              </span>
            </div>
          </div>

          <button onClick={() => window.location.href = '/pipeline'} className="group relative flex items-center justify-center gap-2 px-8 py-3.5 bg-[#06b6d4] hover:bg-[#0891b2] text-white font-bold rounded-xl shadow-lg shadow-cyan-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] w-full max-w-[320px] mb-4">
            Acessar Workspace
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </button>
          <p className="text-xs text-gray-400 font-medium">Você será redirecionado para o dashboard da <span className="font-bold text-gray-600">{loadingOrg ? '...' : orgName}</span>.</p>
        </div>

        <div className="w-full flex flex-col items-center pb-8 relative z-10 gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-gray-500">Logado como <span className="font-bold text-gray-800">{user?.email || '...'}</span></span>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-gray-500">
            <button onClick={handleLogout} className="flex items-center gap-1.5 hover:text-red-600 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              Sair da sessão
            </button>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
