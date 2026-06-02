'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Pipeline, PipelineStage } from '@/lib/types'

const EMPTY_ARRAY: PipelineStage[] = []

export function usePipeline(organizationId: string) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [stages, setStages] = useState<Record<string, PipelineStage[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return

    async function fetchPipelines() {
      try {
        setLoading(true)
        setError(null)

        // Fetch pipelines
        const { data: pipelinesData, error: pipelinesError } = await supabase
          .from('pipelines')
          .select('*')
          .eq('organization_id', organizationId)
          .is('deleted_at', null)
          .order('created_at', { ascending: true })

        if (pipelinesError) {
          console.error('[usePipeline] Query error:', pipelinesError)
          throw pipelinesError
        }

        console.log('[usePipeline] Fetched pipelines:', pipelinesData?.length, 'for org:', organizationId)
        setPipelines(pipelinesData || [])

        if (pipelinesData && pipelinesData.length > 0) {
          const defaultPipeline = pipelinesData[0]
          setSelectedPipelineId(defaultPipeline.id)

          // Fetch stages for all pipelines concurrently so we have them in memory
          await Promise.all(pipelinesData.map(p => fetchStages(p.id)))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch pipelines')
      } finally {
        setLoading(false)
      }
    }

    fetchPipelines()
  }, [organizationId])

  async function fetchStages(pipelineId: string) {
    try {
      const { data, error: err } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .order('rank', { ascending: true })

      if (err) throw err

      setStages((prev) => ({
        ...prev,
        [pipelineId]: data || [],
      }))
    } catch (err) {
      console.error('Failed to fetch stages:', err)
    }
  }

  async function selectPipeline(pipelineId: string) {
    setSelectedPipelineId(pipelineId)
    if (!stages[pipelineId]) {
      await fetchStages(pipelineId)
    }
  }

  // ==== MUTATIONS ==== //

  async function createPipeline(name: string) {
    try {
      const { data, error: err } = await supabase
        .from('pipelines')
        .insert([{ organization_id: organizationId, name }])
        .select()
        .single()

      if (err) throw err

      setPipelines((prev) => [...prev, data])
      setSelectedPipelineId(data.id)
      setStages((prev) => ({ ...prev, [data.id]: [] }))
      return data
    } catch (err) {
      console.error('Failed to create pipeline:', err)
      throw err
    }
  }

  async function updatePipelineSettings(pipelineId: string, settings: any) {
    try {
      const { data, error: err } = await supabase
        .from('pipelines')
        .update({ settings })
        .eq('id', pipelineId)
        .select()
        .single()

      if (err) throw err

      setPipelines((prev) => prev.map((p) => (p.id === pipelineId ? data : p)))
      return data
    } catch (err) {
      console.error('Failed to update pipeline settings:', err)
      throw err
    }
  }

  async function updatePipeline(pipelineId: string, updates: Partial<Pipeline>) {
    try {
      const { data, error: err } = await supabase
        .from('pipelines')
        .update(updates)
        .eq('id', pipelineId)
        .select()
        .single()

      if (err) throw err

      setPipelines((prev) => prev.map((p) => (p.id === pipelineId ? data : p)))
      return data
    } catch (err) {
      console.error('Failed to update pipeline:', err)
      throw err
    }
  }

  async function deletePipeline(pipelineId: string) {
    try {
      // First check if there are any leads in any stages of this pipeline
      const { count, error: countErr } = await supabase
        .from('leads')
        .select('id, pipeline_stages!inner(pipeline_id)', { count: 'exact', head: true })
        .eq('pipeline_stages.pipeline_id', pipelineId)
        .is('deleted_at', null)

      if (countErr) throw countErr

      if (count && count > 0) {
        throw new Error('Não é possível excluir um pipeline que contém leads ativos.')
      }

      // Soft delete
      const { error: err } = await supabase
        .from('pipelines')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', pipelineId)

      if (err) throw err

      setPipelines((prev) => prev.filter((p) => p.id !== pipelineId))
      if (selectedPipelineId === pipelineId) {
        setSelectedPipelineId(null)
      }
    } catch (err) {
      console.error('Failed to delete pipeline:', err)
      throw err
    }
  }

  async function createStage(pipelineId: string, name: string) {
    try {
      const currentStages = stages[pipelineId] || []
      const rank = currentStages.length > 0 ? Math.max(...currentStages.map((s) => s.rank)) + 10 : 0

      const { data, error: err } = await supabase
        .from('pipeline_stages')
        .insert([{ organization_id: organizationId, pipeline_id: pipelineId, name, rank }])
        .select()
        .single()

      if (err) throw err

      setStages((prev) => ({
        ...prev,
        [pipelineId]: [...(prev[pipelineId] || []), data],
      }))
      return data
    } catch (err) {
      console.error('Failed to create stage:', err)
      throw err
    }
  }

  async function updateStage(stageId: string, pipelineId: string, updates: Partial<PipelineStage>) {
    try {
      const { data, error: err } = await supabase
        .from('pipeline_stages')
        .update(updates)
        .eq('id', stageId)
        .select()
        .single()

      if (err) throw err

      setStages((prev) => ({
        ...prev,
        [pipelineId]: prev[pipelineId]?.map((s) => (s.id === stageId ? data : s)) || [],
      }))
      return data
    } catch (err) {
      console.error('Failed to update stage:', err)
      throw err
    }
  }

  async function deleteStage(stageId: string, pipelineId: string) {
    try {
      // First check if there are any leads
      const { count, error: countErr } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('stage_id', stageId)

      if (countErr) throw countErr

      if (count && count > 0) {
        throw new Error('Não é possível excluir uma etapa que contém leads.')
      }

      const { error: err } = await supabase
        .from('pipeline_stages')
        .delete()
        .eq('id', stageId)

      if (err) throw err

      setStages((prev) => ({
        ...prev,
        [pipelineId]: prev[pipelineId]?.filter((s) => s.id !== stageId) || [],
      }))
    } catch (err) {
      console.error('Failed to delete stage:', err)
      throw err
    }
  }

  async function reorderStages(pipelineId: string, newStages: PipelineStage[]) {
    try {
      // Optimistic update
      setStages((prev) => ({
        ...prev,
        [pipelineId]: newStages,
      }))

      // Prepare bulk update via upsert
      const updates = newStages.map((stage) => ({
        id: stage.id,
        organization_id: stage.organization_id,
        pipeline_id: stage.pipeline_id,
        name: stage.name,
        color: stage.color,
        rank: stage.rank,
        target_volume: stage.target_volume,
        created_at: stage.created_at
      }))

      const { error: err } = await supabase
        .from('pipeline_stages')
        .upsert(updates)

      if (err) throw err
    } catch (err) {
      console.error('Failed to reorder stages:', err)
      // Revert on error by refetching
      await fetchStages(pipelineId)
      throw err
    }
  }

  return {
    pipelines,
    stages: selectedPipelineId ? stages[selectedPipelineId] || EMPTY_ARRAY : EMPTY_ARRAY,
    stagesMap: stages,
    selectedPipelineId,
    selectPipeline,
    createPipeline,
    updatePipeline,
    deletePipeline,
    updatePipelineSettings,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
    fetchPipelines: async () => { }, // placeholder for reload if ever needed
    loading,
    error,
  }
}
