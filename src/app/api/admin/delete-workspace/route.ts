import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { profiles, organizations, organizationMembers, pipelines, pipelineStages, leads, leadActivities, leadTags, leadStageHistory, integrations, integrationSecrets, tags, notifications, apiTokens, organizationRoles, customFieldDefinitions, customFieldCategories } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [profile] = await db.select({ isSuperadmin: profiles.isSuperadmin }).from(profiles).where(eq(profiles.id, session.user.id)).limit(1)
    if (!profile?.isSuperadmin) return NextResponse.json({ error: 'Permissão negada. Apenas Superadmins podem deletar workspaces.' }, { status: 403 })

    const { id: workspaceId } = await request.json()
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID é obrigatório' }, { status: 400 })

    // Cascade delete in order
    await db.delete(notifications).where(eq(notifications.organizationId, workspaceId))
    await db.delete(apiTokens).where(eq(apiTokens.organizationId, workspaceId))
    const members = await db.select({ id: organizationMembers.id }).from(organizationMembers).where(eq(organizationMembers.organizationId, workspaceId))
    const memberIds = members.map(m => m.id)
    const orgLeads = await db.select({ id: leads.id }).from(leads).where(eq(leads.organizationId, workspaceId))
    for (const lead of orgLeads) {
      await db.delete(leadTags).where(eq(leadTags.leadId, lead.id))
      await db.delete(leadActivities).where(eq(leadActivities.leadId, lead.id))
      await db.delete(leadStageHistory).where(eq(leadStageHistory.leadId, lead.id))
    }
    await db.delete(leads).where(eq(leads.organizationId, workspaceId))
    const orgIntegrations = await db.select({ id: integrations.id }).from(integrations).where(eq(integrations.organizationId, workspaceId))
    for (const integration of orgIntegrations) {
      await db.delete(integrationSecrets).where(eq(integrationSecrets.integrationId, integration.id))
    }
    await db.delete(integrations).where(eq(integrations.organizationId, workspaceId))
    await db.delete(tags).where(eq(tags.organizationId, workspaceId))
    await db.delete(customFieldDefinitions).where(eq(customFieldDefinitions.organizationId, workspaceId))
    await db.delete(customFieldCategories).where(eq(customFieldCategories.organizationId, workspaceId))
    const orgPipelines = await db.select({ id: pipelines.id }).from(pipelines).where(eq(pipelines.organizationId, workspaceId))
    for (const pipeline of orgPipelines) {
      await db.delete(pipelineStages).where(eq(pipelineStages.pipelineId, pipeline.id))
    }
    await db.delete(pipelines).where(eq(pipelines.organizationId, workspaceId))
    await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, workspaceId))
    await db.delete(organizationRoles).where(eq(organizationRoles.organizationId, workspaceId))
    await db.delete(organizations).where(eq(organizations.id, workspaceId))

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[delete-workspace] Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
