'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth, useStageHistory, useLeadPipelineStages, usePipeline } from '@/hooks'
import { useLeadsContext } from '@/contexts/LeadsContext'
import { LeadList, ChatWindow, LeadDetailsSidebar } from '@/components/Chat'
import { LeadWithOwner } from '@/lib/types'
import NotAuthorized from '@/components/Shared/NotAuthorized'
import LoadingSpinner from '@/components/Shared/LoadingSpinner'

export default function ChatPage() {
  const { organizationId, loading, permissions, isMaster, roleName, currentOrganization, user, profileName } = useAuth()

  const { leads: globalLeads, loading: leadsLoading, moveLeadToStage, setLeads } = useLeadsContext()

  const searchParams = useSearchParams()
  const leadIdFromUrl = searchParams.get('leadId')

  // Apply local filtering purely on the frontend memory
  const allLeads = globalLeads.filter(l => {
    if (permissions?.leads?.view_own_only && currentOrganization?.id) {
      if (l.owner_member_id !== currentOrganization.id) return false;
    }
    return true;
  })

  const [selectedLead, setSelectedLead] = useState<LeadWithOwner | null>(null)

  // Sync `?leadId=` from URL (pushed by GlobalSearch and notification links)
  // into selectedLead. Handles leads that are NOT in the in-memory 1000-row
  // cap by fetching them directly from Supabase with the same joins
  // LeadsContext uses, so downstream consumers (ChatWindow, sidebar) render
  // with full data.
  useEffect(() => {
    if (!leadIdFromUrl) return
    if (selectedLead?.id === leadIdFromUrl) return

    const fromMemory = globalLeads.find(l => l.id === leadIdFromUrl)
    if (fromMemory) {
      setSelectedLead(fromMemory)
      return
    }

    let cancelled = false
    ;(async () => {
      const res = await fetch(`/api/leads/${leadIdFromUrl}`)
      if (res.ok) {
        const { data } = await res.json()
        if (!cancelled && data) setSelectedLead(data as LeadWithOwner)
      }
    })()
    return () => { cancelled = true }
  }, [leadIdFromUrl, globalLeads, selectedLead?.id])

  // Resolve the displayed lead: prefer the freshest version from context; fall back
  // to the clicked `selectedLead` when the lead isn't in memory (search hits can
  // point at leads outside the 1000-row Supabase cap loaded by LeadsContext).
  const displayedLeadId = selectedLead?.id || (allLeads.length > 0 ? allLeads[0].id : null)
  const displayedLead = allLeads.find(l => l.id === displayedLeadId) || selectedLead
  // Pass the lead's stage_id directly — the hook resolves the pipeline internally
  const { stages: leadStages, loading: stagesLoading } = useLeadPipelineStages(displayedLead?.stage_id)
  const { history: stageHistory, loading: historyLoading } = useStageHistory(displayedLead?.id || '')
  const { pipelines, stagesMap, loading: pipelinesLoading } = usePipeline(organizationId || '')

  // Derive the current pipeline id from the lead's stage
  const currentPipelineId = leadStages.length > 0 ? leadStages[0]?.pipeline_id : undefined

  const handleStageChange = useCallback(async (newStageId: string) => {
    if (!displayedLead) return
    const oldStageId = displayedLead.stage_id
    // Optimistic UI update for the selected lead
    if (selectedLead) {
      setSelectedLead({ ...selectedLead, stage_id: newStageId })
    }
    try {
      await moveLeadToStage(displayedLead.id, newStageId, oldStageId)
    } catch {
      // Revert on error
      if (selectedLead) {
        setSelectedLead({ ...selectedLead, stage_id: oldStageId })
      }
    }
  }, [displayedLead, selectedLead, moveLeadToStage])

  const handlePipelineChange = useCallback(async (newPipelineId: string) => {
    if (!displayedLead || !organizationId) return
    try {
      let firstStageId: string | undefined;

      // Optimistic Check: Do we already have the stages for this pipeline in memory?
      // usePipeline's stages map might have it if it was ever loaded or is the default.
      const cachedStages = stagesMap ? stagesMap[newPipelineId] : undefined;
      if (cachedStages && cachedStages.length > 0) {
        firstStageId = cachedStages[0].id;
      }

      // Fallback: Fetch from database if we don't have it in memory
      if (!firstStageId) {
        const stagesRes = await fetch(`/api/pipelines/${newPipelineId}/stages`)
        if (!stagesRes.ok) { console.error('Failed to fetch stages'); return }
        const { data: newStages } = await stagesRes.json()
        if (!newStages || newStages.length === 0) return
        firstStageId = newStages[0].id
      }

      if (!firstStageId) {
        console.error('Could not find first stage for pipeline', newPipelineId);
        return;
      }

      await handleStageChange(firstStageId)
    } catch (err) {
      console.error('Failed to change pipeline:', err)
    }
  }, [displayedLead, organizationId, handleStageChange, stagesMap])

  const handleTagsChange = useCallback((targetLeadId: string, tagId: string, action: 'add' | 'remove', tagObj?: any) => {
    setLeads((prevLeads) => prevLeads.map((l) => {
      if (l.id !== targetLeadId) return l

      let newTags = [...(l.lead_tags || [])]
      if (action === 'add') {
        if (!newTags.find((t) => t.tag_id === tagId)) {
          newTags.push({ tag_id: tagId, tag: tagObj })
        }
      } else {
        newTags = newTags.filter((t) => t.tag_id !== tagId)
      }
      return { ...l, lead_tags: newTags }
    }))

    // Note: selectedLead doesn't strictly need manual matching if it falls back to displayedLead reading from allLeads, but we'll update it just in case
    if (selectedLead?.id === targetLeadId) {
      setSelectedLead((prev) => {
        if (!prev) return prev
        let newTags = [...(prev.lead_tags || [])]
        if (action === 'add') {
          if (!newTags.find((t) => t.tag_id === tagId)) {
            newTags.push({ tag_id: tagId, tag: tagObj })
          }
        } else {
          newTags = newTags.filter((t) => t.tag_id !== tagId)
        }
        return { ...prev, lead_tags: newTags }
      })
    }
  }, [setLeads, selectedLead])

  const handleChatMessageSent = useCallback((content: string) => {
    const memberId = currentOrganization?.id || ''
    const fullName = profileName || user?.name || user?.email || ''
    setLeads(prev => prev.map(l => {
      if (l.id === displayedLead?.id) {
        return {
          ...l,
          last_message_content: content,
          last_message_sender_type: 'human' as const,
          last_activity_at: new Date().toISOString(),
          owner_member_id: memberId || l.owner_member_id,
          owner: memberId ? { id: memberId, profiles: { full_name: fullName, avatar_url: user?.image || undefined } } : l.owner
        }
      }
      return l
    }))
    // Also update selectedLead so the sidebar refreshes immediately
    if (selectedLead && selectedLead.id === displayedLead?.id) {
      setSelectedLead(prev => prev ? {
        ...prev,
        last_message_content: content,
        last_message_sender_type: 'human' as const,
        last_activity_at: new Date().toISOString(),
        owner_member_id: memberId || prev.owner_member_id,
        owner: memberId ? { id: memberId, profiles: { full_name: fullName, avatar_url: user?.image || undefined } } : prev.owner
      } : prev)
    }
  }, [displayedLead, selectedLead, setLeads, currentOrganization, user])

  const handleUpdateLead = useCallback((leadId: string, updates: Partial<LeadWithOwner>) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l))
  }, [setLeads])

  const isAdmin = isMaster || roleName?.toLowerCase() === 'administrador' || roleName?.toLowerCase() === 'owner'
  if (!loading && !isAdmin && permissions && !permissions.settings?.view_chat) {
    return <NotAuthorized />
  }

  if (loading || leadsLoading || (!isAdmin && !permissions)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner text="Carregando..." size="lg" />
      </div>
    )
  }

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Nenhuma organização encontrada. Execute o seed.sql no Supabase.</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-56px)] gap-0">
      {/* Left — Lead List */}
      <div className="w-[340px] border-r border-[#2f3b44] flex-shrink-0">
        <LeadList
          leads={allLeads}
          selectedLeadId={displayedLead?.id}
          onSelectLead={setSelectedLead}
          onUpdateLead={handleUpdateLead}
          loading={false}
        />
      </div>

      {/* Center — Chat */}
      <div className="flex-1 min-w-0">
        {displayedLead ? (
          <ChatWindow
            lead={displayedLead}
            organizationId={organizationId}
            onMessageSent={handleChatMessageSent}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-[#0b141a] text-[#8696a0]">
            Integre alguma fonte de conversas
          </div>
        )}
      </div>

      {/* Right — Lead Details Sidebar */}
      {displayedLead && (
        <LeadDetailsSidebar
          lead={displayedLead}
          stages={leadStages}
          stageHistory={stageHistory}
          stageHistoryLoading={historyLoading || stagesLoading}
          onStageChange={handleStageChange}
          onTagsChange={handleTagsChange}
          onUpdateLead={handleUpdateLead}
          pipelines={pipelines}
          currentPipelineId={currentPipelineId}
          onPipelineChange={handlePipelineChange}
        />
      )}
    </div>
  )
}

