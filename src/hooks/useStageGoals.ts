'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { StageGoal } from '@/lib/types'

export function useStageGoals(organizationId: string) {
  const [goals, setGoals] = useState<Record<string, StageGoal>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) {
      setLoading(false)
      return
    }

    async function fetchGoals() {
      try {
        setLoading(true)
        setError(null)

        const { data, error: err } = await supabase
          .from('stage_goals')
          .select('*')
          .eq('organization_id', organizationId)

        if (err) {
          // If table doesn't exist or permission error, silently fail with empty goals
          console.warn('[useStageGoals] Could not fetch goals (table may not exist yet):', err.message)
          setGoals({})
          setError(null) // Don't treat as error
          setLoading(false)
          return
        }

        // Convert to map for quick lookup by stage_id
        const goalsMap: Record<string, StageGoal> = {}
        data?.forEach((goal) => {
          goalsMap[goal.stage_id] = goal
        })

        setGoals(goalsMap)
      } catch (err) {
        console.warn('[useStageGoals] Fetch failed:', err)
        setGoals({})
        setError(null) // Don't treat as critical error
      } finally {
        setLoading(false)
      }
    }

    fetchGoals()
  }, [organizationId])

  return {
    goals,
    loading,
    error,
  }
}
