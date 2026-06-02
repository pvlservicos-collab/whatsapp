import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Tag } from '@/lib/types'

export function useTags(organizationId: string | null | undefined, leadId?: string | null) {
    const [allTags, setAllTags] = useState<Tag[]>([])
    const [leadTags, setLeadTags] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        if (!organizationId) {
            setAllTags([])
            setLeadTags([])
            setLoading(false)
            return
        }

        async function fetchTags() {
            setLoading(true)
            try {
                const { data: tagsData, error: tagsErr } = await supabase
                    .from('tags')
                    .select('*')
                    .eq('organization_id', organizationId)
                    .is('deleted_at', null)

                if (tagsErr) throw tagsErr
                setAllTags(tagsData || [])

                if (leadId) {
                    const { data: ltData, error: ltErr } = await supabase
                        .from('lead_tags')
                        .select('tag_id, tag:tags(*)')
                        .eq('organization_id', organizationId)
                        .eq('lead_id', leadId)

                    if (ltErr) throw ltErr
                    setLeadTags(ltData || [])
                } else {
                    setLeadTags([])
                }
            } catch (err: any) {
                console.error('Error fetching tags:', err)
                setError(err)
            } finally {
                setLoading(false)
            }
        }

        fetchTags()
    }, [organizationId, leadId])

    const addTagToLead = async (tagId: string) => {
        if (!organizationId || !leadId) return
        // Optimistic update FIRST — no loading toggle
        const tag = allTags.find(t => t.id === tagId)
        if (tag && !leadTags.find(lt => lt.tag_id === tagId)) {
            setLeadTags(prev => [...prev, { tag_id: tagId, tag }])
        }

        try {
            const { error } = await supabase
                .from('lead_tags')
                .insert([{ organization_id: organizationId, lead_id: leadId, tag_id: tagId }])

            if (error && error.code !== '23505') {
                // Revert on real error
                setLeadTags(prev => prev.filter(lt => lt.tag_id !== tagId))
                throw error
            }
        } catch (err: any) {
            console.error('Error adding tag:', err)
            setError(err)
        }
    }

    const removeTagFromLead = async (tagId: string) => {
        if (!organizationId || !leadId) return
        // Optimistic removal FIRST — no loading toggle
        const removed = leadTags.find(lt => lt.tag_id === tagId)
        setLeadTags(prev => prev.filter(lt => lt.tag_id !== tagId))

        try {
            const { error } = await supabase
                .from('lead_tags')
                .delete()
                .match({ organization_id: organizationId, lead_id: leadId, tag_id: tagId })

            if (error) {
                // Revert on error
                if (removed) setLeadTags(prev => [...prev, removed])
                throw error
            }
        } catch (err: any) {
            console.error('Error removing tag:', err)
            setError(err)
        }
    }

    return { allTags, leadTags, addTagToLead, removeTagFromLead, loading, error }
}
