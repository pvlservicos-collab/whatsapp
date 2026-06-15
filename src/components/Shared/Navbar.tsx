'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ChartBar,
  Kanban,
  ChatCircleDots,
  Users,
  MagnifyingGlass,
  Plus,
  CaretDown,
  Gear, // Changed from GearSix
  SignOut, // Added
  Buildings,
  ListBullets,
  FlowArrow,
} from '@phosphor-icons/react'
import { useAuth, usePipeline } from '@/hooks' // Kept usePipeline from '@/hooks'
import { signOut } from 'next-auth/react'
import FilterButton from '@/components/Shared/FilterButton'
import GlobalSearch from '@/components/Shared/GlobalSearch'
import NotificationDropdown from '@/components/Shared/NotificationDropdown'
import { usePipelineFilters } from '@/contexts/FilterContext'

const NAV_ITEMS = [
  // { label: 'Dashboard', href: '/', icon: ChartBar }, // Temporariamente desativado
  { label: 'Pipeline', href: '/pipeline', icon: Kanban },
  { label: 'Chat', href: '/chat', icon: ChatCircleDots },
  // { label: 'Leads', href: '/leads', icon: Users }, // Temporariamente desativado
  { label: 'Funil de Mensagens', href: '/funnels', icon: FlowArrow },
  { label: 'Logs', href: '/logs', icon: ListBullets },
  { label: 'Métricas', href: '/metrics', icon: ChartBar },
  { label: 'Configurações', href: '/settings/organization', icon: Gear },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { organizationId, permissions, isMaster, roleName, user, profileName, loading: authLoading } = useAuth() // Added user, profileName, authLoading
  const searchParams = useSearchParams()
  const pipelineIdParam = searchParams.get('pipelineId')
  const { pipelines, selectedPipelineId } = usePipeline(organizationId || '')
  const activePipelineId = pipelineIdParam || selectedPipelineId

  const { setFilters } = usePipelineFilters()
  const [showPipelineDropdown, setShowPipelineDropdown] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false) // Added

  const userDropdownRef = useRef<HTMLDivElement>(null) // Added

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Assuming there's a ref for pipeline dropdown if needed, but the original code uses onMouseEnter/onMouseLeave
      // For user dropdown:
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login', redirect: false })
    router.push('/login')
  }

  // Get user name or email for display
  const displayName = profileName || user?.name || user?.email || 'Usuário'

  // Create initials for avatar (e.g. "Mariana Silva" -> "MS")
  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  const initials = getInitials(displayName)
  const avatarUrl = user?.image

  const isItemVisible = (label: string): boolean => {
    // Superadmins and org Admins see everything
    if (isMaster || roleName?.toLowerCase() === 'administrador' || roleName?.toLowerCase() === 'owner') return true

    // If permissions aren't loaded yet, default to false (except Dashboard maybe, but safer to hide until loaded)
    if (!permissions) return false

    // Evaluate based on the JSON settings
    switch (label) {
      case 'Dashboard': return !!permissions.settings?.view_dashboard
      case 'Leads': return !!permissions.settings?.view_leads
      case 'Pipeline': return !!permissions.settings?.view_pipeline
      case 'Chat': return !!permissions.settings?.view_chat
      case 'Funil de Mensagens': return !!permissions.settings?.view_settings
      case 'Logs': return !!permissions.settings?.view_settings
      case 'Métricas': return !!permissions.settings?.view_settings
      case 'Configurações': return !!permissions.settings?.view_settings
      default: return false
    }
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between sticky top-0 z-50">
      {/* Left: Logo + Nav */}
      <div className="flex items-center gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <img src="/logos/Atlas.svg" alt="Atlas Eye Logo" className="h-6 w-auto object-contain" />
          <span className="font-display font-bold text-gray-900">Atlas Eye</span>
        </Link>

        {/* Nav Tabs */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.filter(item => isItemVisible(item.label)).map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))
            const Icon = item.icon

            // Special handling for Pipeline with multiple pipelines
            if (item.label === 'Pipeline' && pipelines.length > 1) {
              return (
                <div
                  key={item.href}
                  className="relative"
                  onMouseEnter={() => setShowPipelineDropdown(true)}
                  onMouseLeave={() => setShowPipelineDropdown(false)}
                >
                  <Link
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                  >
                    <Icon size={16} weight={isActive ? 'fill' : 'regular'} />
                    {item.label}
                    <CaretDown size={12} className="ml-1" />
                  </Link>

                  {/* Dropdown */}
                  {showPipelineDropdown && (
                    <div className="absolute top-full left-0 pt-2 w-48 z-50">
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                        {pipelines.map((pipeline) => (
                          <button
                            key={pipeline.id}
                            onClick={() => {
                              router.push(`/pipeline?pipelineId=${pipeline.id}`)
                              setShowPipelineDropdown(false)
                            }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${activePipelineId === pipeline.id
                              ? 'bg-blue-50 text-blue-600 font-semibold'
                              : 'text-gray-700'
                              }`}
                          >
                            {pipeline.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            }

            // Default rendering for other nav items
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <Icon size={16} weight={isActive ? 'fill' : 'regular'} />
                {item.label}
              </Link>
            )
          })}

          {/* Conditional Filter Button for Pipeline */}
          {pathname.startsWith('/pipeline') && organizationId && (
            <>
              <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
              <FilterButton organizationId={organizationId} onFilterChange={setFilters} />
            </>
          )}
        </div>
      </div>

      {/* Right: Search + Notifications + User + Button */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <GlobalSearch />

        {/* Notifications */}
        <NotificationDropdown />

        {/* User Dropdown */}
        <div className="relative" ref={userDropdownRef}>
          <div
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
          >
            {avatarUrl ? (
              <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border border-gray-200">
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 text-xs font-bold">{initials}</span>
              </div>
            )}
            <span className="text-sm font-medium text-gray-700 truncate max-w-[120px]">{displayName}</span>
            <CaretDown size={14} className={`text-gray-400 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
          </div>

          {/* User Menu Popup */}
          {showUserDropdown && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg shadow-gray-200/50 py-1 z-50 animate-in fade-in slide-in-from-top-2">
              <Link
                href="/workspaces"
                onClick={() => setShowUserDropdown(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors w-full text-left"
              >
                <Buildings size={16} />
                <span>Organizações</span>
              </Link>
              <Link
                href="/settings/profile"
                onClick={() => setShowUserDropdown(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors w-full text-left"
              >
                <Gear size={16} />
                <span>Configurações do Perfil</span>
              </Link>
              <div className="h-px bg-gray-100 my-1 mx-2"></div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors w-full text-left"
              >
                <SignOut size={16} />
                <span>Sair da conta</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
