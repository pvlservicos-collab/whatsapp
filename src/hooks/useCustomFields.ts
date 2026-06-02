import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSession } from 'next-auth/react'
import { CustomFieldDefinition, CustomFieldIndexValue } from '@/lib/types'

export interface CustomFieldCategory {
    id: string
    organization_id: string
    name: string
    rank: number
}

export function useCustomFields(organizationId: string | null | undefined, leadId: string | null | undefined) {
    const { currentOrganization } = useAuth()
    const [categories, setCategories] = useState<CustomFieldCategory[]>([])
    const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([])
    const [values, setValues] = useState<CustomFieldIndexValue[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        if (!organizationId) {
            setCategories([])
            setDefinitions([])
            setValues([])
            return
        }

        async function fetchCustomFields() {
            setLoading(true)
            try {
                // Fetch categories
                const { data: catData, error: catError } = await supabase
                    .from('custom_field_categories')
                    .select('*')
                    .eq('organization_id', organizationId)
                    .order('rank', { ascending: true })

                if (catError) throw catError
                setCategories(catData || [])

                // Fetch definitions
                const { data: defsData, error: defsError } = await supabase
                    .from('custom_field_definitions')
                    .select('*')
                    .eq('organization_id', organizationId)
                    .is('deleted_at', null)
                    .order('rank', { ascending: true })

                if (defsError) throw defsError
                setDefinitions(defsData || [])

                // If a lead is specified, fetch its values
                if (leadId) {
                    const { data: valsData, error: valsError } = await supabase
                        .from('custom_field_index_values')
                        .select(`
              *,
              field_definition:custom_field_definitions(*)
            `)
                        .eq('organization_id', organizationId)
                        .eq('lead_id', leadId)

                    if (valsError) throw valsError
                    setValues(valsData || [])
                } else {
                    setValues([])
                }
            } catch (err: any) {
                console.error('Error fetching custom fields:', err)
                setError(err)
            } finally {
                setLoading(false)
            }
        }

        fetchCustomFields()
    }, [organizationId, leadId])

    const updateFieldValue = async (fieldId: string, valueType: string, newValue: any) => {
        if (!organizationId || !leadId) return

        try {
            const payload: any = {
                organization_id: organizationId,
                lead_id: leadId,
                field_id: fieldId,
                value_text: null,
                value_number: null,
                value_date: null,
                value_bool: null,
                value_json: null,
                updated_at: new Date().toISOString(),
            }

            if (valueType === 'text') payload.value_text = newValue
            else if (valueType === 'number') payload.value_number = newValue
            else if (valueType === 'date') payload.value_date = newValue
            else if (valueType === 'datetime') {
                // Store full datetime in value_text (value_date is DATE-only, discards time)
                payload.value_text = newValue
                payload.value_date = typeof newValue === 'string' ? newValue.slice(0, 10) : newValue
            }
            else if (valueType === 'bool') payload.value_bool = newValue
            else if (valueType === 'json' || valueType === 'select' || valueType === 'multi_select') {
                payload.value_json = newValue
            }

            // Optimistic UI Update
            setValues(prev => {
                const exists = prev.find(v => v.field_id === fieldId)
                if (exists) {
                    return prev.map(v => v.field_id === fieldId ? { ...v, ...payload } : v)
                } else {
                    return [...prev, { ...payload, id: 'temp-' + Date.now() }]
                }
            })

            // Use upsert to handle both insert and update in one call,
            // leveraging the unique constraint on (lead_id, field_id)
            const { error } = await supabase
                .from('custom_field_index_values')
                .upsert(payload, { onConflict: 'lead_id,field_id' })

            if (error) throw new Error(error.message || JSON.stringify(error))

            // Log update to lead_activities
            const fieldDef = definitions.find(d => d.id === fieldId)
            let displayVal = newValue
            if (valueType === 'json' || valueType === 'select' || valueType === 'multi_select') {
                displayVal = typeof newValue === 'object' ? (newValue.selected || JSON.stringify(newValue)) : newValue
            }

            await supabase.from('lead_activities').insert({
                organization_id: organizationId,
                lead_id: leadId,
                actor_member_id: currentOrganization?.id || null, // Log user who made change
                type: 'system',
                metadata: { source: 'custom_field' },
                content: `Campo "${fieldDef?.name || 'Customizado'}" alterado para "${displayVal}"`
            })

        } catch (err: any) {
            console.error('Error updating custom field value:', err?.message || err)
            setError(err)
        }
    }

    return { categories, definitions, values, loading, error, updateFieldValue }
}
