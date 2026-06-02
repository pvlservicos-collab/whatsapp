'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { PipelineStage } from '@/lib/types'

/**
 * Given a lead's current stage_id, resolves which pipeline it belongs to
 * and fetches ALL stages in that pipeline for the FunnelMiniMap.
 * Caches the pipeline_id to avoid re-fetching when moving within the same pipeline.
 */
export function useLeadPipelineStages(stageId: string | undefined | null) {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(false)
  const cachedPipelineId = useRef<string | null>(null)

  useEffect(() => {
    if (!stageId) {
      setStages([])
      cachedPipelineId.current = null
      return
    }

    // If the new stage already exists in our cached stages, no need to refetch
    if (stages.length > 0 && stages.some(s => s.id === stageId)) {
      return
    }

    async function fetchStages() {
      setLoading(true)
      try {
        // Step 1: Get the pipeline_id from the current stage
        const { data: stageRow, error: stageErr } = await supabase
          .from('pipeline_stages')
          .select('pipeline_id')
          .eq('id', stageId)
          .single()

        if (stageErr || !stageRow?.pipeline_id) {
          console.warn('[useLeadPipelineStages] Could not resolve pipeline from stage:', stageId, stageErr?.message)
          setStages([])
          return
        }

        // If same pipeline, no need to refetch stages
        if (stageRow.pipeline_id === cachedPipelineId.current && stages.length > 0) {
          setLoading(false)
          return
        }

        cachedPipelineId.current = stageRow.pipeline_id

        // Step 2: Fetch all stages in that pipeline
        const { data, error } = await supabase
          .from('pipeline_stages')
          .select('*')
          .eq('pipeline_id', stageRow.pipeline_id)
          .is('deleted_at', null)
          .order('rank', { ascending: true })

        if (error) throw error
        setStages(data || [])
      } catch (err) {
        console.error('Failed to fetch lead pipeline stages:', err)
        setStages([])
      } finally {
        setLoading(false)
      }
    }

    fetchStages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageId])

  return { stages, loading }
}
