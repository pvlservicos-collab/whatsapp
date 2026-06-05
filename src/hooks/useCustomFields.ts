import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { CustomFieldDefinition } from '@/lib/types'

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
  const [values, setValues] = useState<any[]>([])
  const [customAttributes, setCustomAttributes] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!organizationId) {
      setCategories([])
      setDefinitions([])
      setValues([])
      return
    }
    fetchCustomFields()
  }, [organizationId, leadId])

  async function fetchCustomFields() {
    setLoading(true)
    try {
      const res = await fetch('/api/custom-fields')
      if (!res.ok) throw new Error('Failed to fetch custom fields')
      const json = await res.json()

      setCategories(json.categories || [])
      setDefinitions(json.definitions || json.data || [])

      if (leadId) {
        const leadRes = await fetch(`/api/leads/${leadId}`)
        if (leadRes.ok) {
          const { data: lead } = await leadRes.json()
          const attrs = lead?.custom_attributes || {}
          setCustomAttributes(attrs)
          // Map custom_attributes to values array keyed by field_id
          const vals = Object.entries(attrs).map(([fieldId, val]: any) => ({
            field_id: fieldId,
            ...(typeof val === 'object' && val !== null ? val : { value_text: String(val) }),
          }))
          setValues(vals)
        }
      } else {
        setValues([])
        setCustomAttributes({})
      }
    } catch (err: any) {
      console.error('Error fetching custom fields:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  const updateFieldValue = async (fieldId: string, valueType: string, newValue: any) => {
    if (!organizationId || !leadId) return

    const payload: any = { field_id: fieldId }
    if (valueType === 'text') payload.value_text = newValue
    else if (valueType === 'number') payload.value_number = newValue
    else if (valueType === 'date') payload.value_date = newValue
    else if (valueType === 'datetime') {
      payload.value_text = newValue
      payload.value_date = typeof newValue === 'string' ? newValue.slice(0, 10) : newValue
    }
    else if (valueType === 'bool') payload.value_bool = newValue
    else if (valueType === 'json' || valueType === 'select' || valueType === 'multi_select') {
      payload.value_json = newValue
    }

    // Optimistic UI update
    setValues(prev => {
      const exists = prev.find(v => v.field_id === fieldId)
      if (exists) return prev.map(v => v.field_id === fieldId ? { ...v, ...payload } : v)
      return [...prev, payload]
    })

    try {
      const newAttrs = { ...customAttributes, [fieldId]: payload }
      setCustomAttributes(newAttrs)

      await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_fields: newAttrs }),
      })

      const fieldDef = definitions.find(d => d.id === fieldId)
      let displayVal = newValue
      if (valueType === 'json' || valueType === 'select' || valueType === 'multi_select') {
        displayVal = typeof newValue === 'object' ? (newValue.selected || JSON.stringify(newValue)) : newValue
      }

      if (currentOrganization?.id) {
        await fetch(`/api/leads/${leadId}/activities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'system',
            content: `Campo "${fieldDef?.name || 'Customizado'}" alterado para "${displayVal}"`,
            metadata: { source: 'custom_field' },
          }),
        })
      }
    } catch (err: any) {
      console.error('Error updating custom field value:', err?.message || err)
      setError(err)
    }
  }

  return { categories, definitions, values, loading, error, updateFieldValue }
}
