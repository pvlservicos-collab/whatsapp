import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Tag } from '@/lib/types'

export interface TagWithStats extends Tag {
    activeLeadsCount: number
}

export function useTagsSettings(organizationId: string | null | undefined) {
    const [tags, setTags] = useState<TagWithStats[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchTags = useCallback(async () => {
        if (!organizationId) {
            setTags([])
            setLoading(false)
            return
        }

        setLoading(true)
        try {
            // Fetch all tags for the organization
            const { data: tagsData, error: tagsErr } = await supabase
                .from('tags')
                .select('*')
                .eq('organization_id', organizationId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })

            if (tagsErr) throw tagsErr

            // Fetch lead counts directly from lead_tags joined with leads to ensure they are active (not deleted and not in won/lost stages - assuming active means in pipeline)
            // For simplicity in this CRM, we'll just count total occurrences in lead_tags where lead is not deleted
            const { data: countsData, error: countsErr } = await supabase
                .from('lead_tags')
                .select('tag_id, leads!inner(id, deleted_at)')
                .eq('organization_id', organizationId)
                .is('leads.deleted_at', null)

            if (countsErr) throw countsErr

            // Calculate counts
            const countsMap = new Map<string, number>()
            if (countsData) {
                countsData.forEach(item => {
                    const count = countsMap.get(item.tag_id) || 0
                    countsMap.set(item.tag_id, count + 1)
                })
            }

            const formattedTags: TagWithStats[] = (tagsData || []).map(tag => ({
                ...tag,
                activeLeadsCount: countsMap.get(tag.id) || 0
            }))

            setTags(formattedTags)
        } catch (err: any) {
            console.error('Error fetching tags settings:', err)
            setError(err)
        } finally {
            setLoading(false)
        }
    }, [organizationId])

    useEffect(() => {
        fetchTags()
    }, [fetchTags])

    const createTag = async (data: { name: string; color: string }) => {
        if (!organizationId) throw new Error('No organization selected')

        try {
            const { data: newTag, error } = await supabase
                .from('tags')
                .insert([{ ...data, organization_id: organizationId }])
                .select()
                .single()

            if (error) throw error

            setTags(prev => [{ ...newTag, activeLeadsCount: 0 }, ...prev])
            return newTag
        } catch (err: any) {
            console.error('Error creating tag:', err)
            throw err
        }
    }

    const updateTag = async (id: string, data: { name: string; color: string }) => {
        if (!organizationId) throw new Error('No organization selected')

        try {
            const { data: updatedTag, error } = await supabase
                .from('tags')
                .update(data)
                .match({ id, organization_id: organizationId })
                .select()
                .single()

            if (error) throw error

            setTags(prev => prev.map(tag => tag.id === id ? { ...tag, ...updatedTag } : tag))
            return updatedTag
        } catch (err: any) {
            console.error('Error updating tag:', err)
            throw err
        }
    }

    const deleteTag = async (id: string) => {
        if (!organizationId) throw new Error('No organization selected')

        try {
            // First, remove tag associations in lead_tags
            const { error: assocError } = await supabase
                .from('lead_tags')
                .delete()
                .match({ tag_id: id, organization_id: organizationId })

            if (assocError) throw assocError

            // Then delete the tag itself (or soft delete)
            const { error: tagError } = await supabase
                .from('tags')
                .update({ deleted_at: new Date().toISOString() })
                .match({ id, organization_id: organizationId })

            if (tagError) throw tagError

            setTags(prev => prev.filter(tag => tag.id !== id))
        } catch (err: any) {
            console.error('Error deleting tag:', err)
            throw err
        }
    }

    return {
        tags,
        loading,
        error,
        createTag,
        updateTag,
        deleteTag,
        refreshTags: fetchTags
    }
}
