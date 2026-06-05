'use client'

import { useState, useEffect } from 'react'
import { CaretRight, Plus } from '@phosphor-icons/react'

interface Role {
  id: string
  name: string
  organization_id: string
  permissions: any
}

interface RolesSidebarProps {
  organizationId: string
  selectedRoleId: string | null
  onSelectRole: (id: string) => void
}

export default function RolesSidebar({ organizationId, selectedRoleId, onSelectRole }: RolesSidebarProps) {
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!organizationId) return
    async function fetchRoles() {
      try {
        const res = await fetch('/api/roles')
        if (!res.ok) throw new Error('Failed to fetch roles')
        const { data } = await res.json()
        const validRoles = (data || []).filter((r: Role) => r.name.toLowerCase() !== 'master')
        setRoles(validRoles)
        if (!selectedRoleId && validRoles.length > 0) onSelectRole(validRoles[0].id)
      } catch (err) {
        console.error('Error fetching roles:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchRoles()
  }, [organizationId])

  const getRoleDescription = (name: string) => {
    switch (name.toLowerCase()) {
      case 'owner': case 'administrador': return 'Acesso total ao sistema'
      case 'gerente': return 'Visão geral e gestão de equipe'
      case 'vendedor': return 'Gestão de leads e pipeline'
      case 'visualizador': return 'Apenas leitura de dados'
      default: return 'Acesso personalizado'
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900 mb-4 tracking-tight">Cargos</h2>
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-gray-900 mb-1 tracking-tight">Cargos</h2>
      <div className="flex flex-col gap-2">
        {roles.map((role) => {
          const isSelected = selectedRoleId === role.id
          return (
            <button key={role.id} onClick={() => onSelectRole(role.id)}
              className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${isSelected ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/30' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}`}>
              <div>
                <p className={`text-sm font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{role.name}</p>
                <p className="text-xs text-gray-500 mt-1">{getRoleDescription(role.name)}</p>
              </div>
              <CaretRight weight="bold" className={`w-4 h-4 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`} />
            </button>
          )
        })}
      </div>
      <button className="mt-2 flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-semibold hover:border-gray-300 hover:text-gray-700 transition-colors bg-white">
        <Plus weight="bold" /> Criar novo Cargo
      </button>
    </div>
  )
}
