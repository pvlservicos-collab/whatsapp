import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { CustomFieldCategory, CustomFieldDefinition } from '@/lib/types'

export function useCustomFieldSettings() {
    const { organizationId } = useAuth()
    const [categories, setCategories] = useState<CustomFieldCategory[]>([])
    const [fields, setFields] = useState<CustomFieldDefinition[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const fetchData = useCallback(async () => {
        if (!organizationId) return

        setLoading(true)
        setError(null)
        try {
            // Fetch categories
            const { data: catData, error: catError } = await supabase
                .from('custom_field_categories')
                .select('*')
                .eq('organization_id', organizationId)
                .order('rank', { ascending: true })
                .order('created_at', { ascending: true })

            if (catError) throw catError
            setCategories(catData || [])

            // Fetch fields
            const { data: fieldData, error: fieldError } = await supabase
                .from('custom_field_definitions')
                .select('*')
                .eq('organization_id', organizationId)
                .is('deleted_at', null)
                .order('rank', { ascending: true })
                .order('created_at', { ascending: true })

            if (fieldError) throw fieldError
            setFields(fieldData || [])
        } catch (err: any) {
            console.error('Error fetching custom fields settings:', err)
            setError(err)
        } finally {
            setLoading(false)
        }
    }, [organizationId])

    // --- Categories ---
    const createCategory = async (name: string) => {
        if (!organizationId) return

        try {
            const { data, error } = await supabase
                .from('custom_field_categories')
                .insert([{
                    organization_id: organizationId,
                    name,
                    rank: categories.length // Put at the end
                }])
                .select()
                .single()

            if (error) throw error
            setCategories(prev => [...prev, data])
            return data
        } catch (err: any) {
            console.error('Error creating category:', err)
            throw err
        }
    }

    const updateCategory = async (id: string, updates: Partial<CustomFieldCategory>) => {
        try {
            const { error } = await supabase
                .from('custom_field_categories')
                .update(updates)
                .eq('id', id)

            if (error) throw error
            setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
        } catch (err: any) {
            console.error('Error updating category:', err)
            throw err
        }
    }

    const deleteCategory = async (id: string) => {
        try {
            // The fields have ON DELETE SET NULL for category_id, so deleting a category just unlinks fields.
            const { error } = await supabase
                .from('custom_field_categories')
                .delete()
                .eq('id', id)

            if (error) throw error
            setCategories(prev => prev.filter(c => c.id !== id))
            // Update local fields state to reflect SET NULL (we use undefined in the type)
            setFields(prev => prev.map(f => f.category_id === id ? { ...f, category_id: undefined } as CustomFieldDefinition : f))
        } catch (err: any) {
            console.error('Error deleting category:', err)
            throw err
        }
    }

    // --- Fields ---
    const createField = async (payload: { name: string, field_type: string, category_id?: string | null, required?: boolean, description?: string, options?: any[] }) => {
        if (!organizationId) return

        // Generate a unique key based on name and timestamp to avoid collisions
        const slug = payload.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
        const uniqueKey = `${slug}_${Date.now()}`

        try {
            const insertPayload = {
                organization_id: organizationId,
                key: uniqueKey,
                name: payload.name,
                field_type: payload.field_type,
                category_id: payload.category_id || null,
                rank: fields.length * 1000 + Date.now() % 1000, // Safe default at the end
                schema: {
                    required: !!payload.required,
                    description: payload.description || '',
                    options: payload.options || []
                }
            }

            const { data, error } = await supabase
                .from('custom_field_definitions')
                .insert([insertPayload])
                .select()
                .single()

            if (error) throw error
            setFields(prev => [...prev, data])
            return data
        } catch (err: any) {
            console.error('Error creating field:', err)
            throw err
        }
    }

    const updateFieldRanks = async (updates: { id: string, rank: number }[]) => {
        try {
            // Optimistic update locally
            setFields(prev => {
                const map = new Map(updates.map(u => [u.id, u.rank]))
                const updated = prev.map(f => map.has(f.id) ? { ...f, rank: map.get(f.id)! } : f)
                return updated.sort((a, b) => a.rank - b.rank)
            })

            // Supabase bulk UPSERT via inserting an array of objects
            // Important: to safely update fields with RLS, we should ideally call an RPC
            // Or loop through and update. For small sizes, `Promise.all` is fine.
            const promises = updates.map(u =>
                supabase
                    .from('custom_field_definitions')
                    .update({ rank: u.rank })
                    .eq('id', u.id)
            )
            await Promise.all(promises)
        } catch (err: any) {
            console.error('Error updating field ranks:', err)
            throw err
        }
    }

    const updateField = async (id: string, payload: { name: string, field_type: string, category_id?: string | null, required?: boolean, description?: string, options?: any[] }) => {
        try {
            const updates = {
                name: payload.name,
                field_type: payload.field_type,
                category_id: payload.category_id || null,
                schema: {
                    required: !!payload.required,
                    description: payload.description || '',
                    options: payload.options || []
                }
            }

            const { data, error } = await supabase
                .from('custom_field_definitions')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            setFields(prev => prev.map(f => f.id === id ? data : f))
            return data
        } catch (err: any) {
            console.error('Error updating field:', err)
            throw err
        }
    }

    const deleteField = async (id: string) => {
        try {
            // Soft delete
            const { error } = await supabase
                .from('custom_field_definitions')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id)

            if (error) throw error
            setFields(prev => prev.filter(f => f.id !== id))
        } catch (err: any) {
            console.error('Error deleting field:', err)
            throw err
        }
    }

    return {
        categories,
        fields,
        loading,
        error,
        fetchData,
        createCategory,
        updateCategory,
        deleteCategory,
        createField,
        updateField,
        updateFieldRanks,
        deleteField
    }
}
