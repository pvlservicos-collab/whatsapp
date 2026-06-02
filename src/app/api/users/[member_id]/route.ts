import { NextRequest } from 'next/server'
import { authenticateRequest, apiError, validateRequired, validateSource } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { publishEvent, channels, events } from '@/lib/realtime'
import {
  leads, leadActivities, leadTags, tags, organizationMembers, profiles,
  pipelineStages, pipelines, integrations, organizationRoles,
  customFieldDefinitions, customFieldCategories, notifications, apiTokens,
  organizations, setupTokens, leadStageHistory, integrationSecrets,
} from '@/lib/schema'
import { eq, and, isNull, desc, asc, ilike, or, sql, ne, inArray, notInArray } from 'drizzle-orm'

// Role hierarchy: lower number = higher rank
const ROLE_HIERARCHY: Record<string, number> = {
    'master': 0,
    'administrador': 1,
    'gerente': 2,
    'vendedor': 3,
    'visualizador': 4,
};

async function validateManagePermissions(supabaseAdmin: any, auth: any, action: 'update' | 'delete', targetMemberId: string) {
    const { data: callerMember } = await supabaseAdmin
        .from("organization_members")
        .select("role_id")
        .eq("organization_id", auth.organizationId)
        .eq("user_id", auth.userId)
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle();

    if (!callerMember?.role_id) {
        throw { status: 403, message: "You are not an active member of this organization" };
    }

    const { data: callerRole } = await supabaseAdmin
        .from("organization_roles")
        .select("name, permissions")
        .eq("id", callerMember.role_id)
        .maybeSingle();

    const isFixedAdmin = callerRole?.name?.toLowerCase() === 'administrador' || callerRole?.name?.toLowerCase() === 'master' || auth.isSuperAdmin;
    const canManage = isFixedAdmin || (callerRole?.permissions as any)?.settings?.manage_members === true;

    if (!canManage) {
        throw { status: 403, message: "You do not have permission to manage members" };
    }

    // Get Target Member
    const { data: targetMember } = await supabaseAdmin
        .from("organization_members")
        .select("user_id, role_id")
        .eq("id", targetMemberId)
        .eq("organization_id", auth.organizationId)
        .is("deleted_at", null)
        .single();

    if (!targetMember) {
        throw { status: 404, message: "Member not found" };
    }

    const { data: targetRole } = await supabaseAdmin
        .from("organization_roles")
        .select("name")
        .eq("id", targetMember.role_id)
        .single();

    const targetRoleName = (targetRole?.name || '').toLowerCase();

    // Additional DELETE validations
    if (action === 'delete') {
        if (targetMember.user_id === auth.userId) {
            throw { status: 400, message: "Você não pode remover a si mesmo" };
        }

        const _targetIsSuperAdmin = await supabaseAdmin.from('profiles').select('is_superadmin').eq('id', targetMember.user_id).single().then((res: any) => res.data?.is_superadmin);

        if (_targetIsSuperAdmin) {
            throw { status: 403, message: "Não é possível remover um usuário Master (SuperAdmin)" };
        }

        const callerRoleName = (callerRole?.name || '').toLowerCase();

        // If the caller is not a SuperAdmin globally, enforce hierarchy
        if (!auth.isSuperAdmin) {
            const callerRank = ROLE_HIERARCHY[callerRoleName] ?? 99;
            const targetRank = ROLE_HIERARCHY[targetRoleName] ?? 99;

            // Can only delete roles with a HIGHER rank number (meaning structurally lower rank)
            // Lower number = higher privileges (Master = 0, Admin = 1, etc)
            // Therefore, callerRank must be strictly less than targetRank
            // Exception: Admins can't delete other Admins, so callerRank < targetRank is correct.
            if (callerRank >= targetRank) {
                throw { status: 403, message: "Você só pode remover membros com cargo inferior ao seu" };
            }
        }
    }

    return { targetMember, callerRole };
}

/**
 * PUT /api/users/[member_id]
 * Edita um membro da organização
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ member_id: string }> }) {
    try {
        const auth = await authenticateRequest(req)
        const { member_id } = await params
        const body = await req.json()

        const requiredError = validateRequired(body, ['name', 'email', 'role_id'])
        if (requiredError) return apiError(400, requiredError)

        const { name, email, password, role_id } = body;
        // db is imported globally

        const { targetMember } = await validateManagePermissions(supabaseAdmin, auth, 'update', member_id);

        // Update Auth User credentials
        const authPayload: any = { email, user_metadata: { full_name: name } };
        if (password && password.trim() !== '') {
            authPayload.password = password;
        }

        const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(targetMember.user_id, authPayload);

        if (updateUserError) {
            return apiError(400, `Failed to update user credentials: ${updateUserError.message}`);
        }

        // Update Profile Name and Email
        await supabaseAdmin.from("profiles").update({ full_name: name, email: email }).eq("id", targetMember.user_id);

        // Update Member Role
        const { error: updateMemberError } = await supabaseAdmin
            .from("organization_members")
            .update({ role_id })
            .eq("id", member_id)

        if (updateMemberError) {
            return apiError(500, "Failed to update member role");
        }

        return Response.json({ success: true }, { status: 200 })
    } catch (err: any) {
        console.error("PUT /api/users/[member_id] Error:", err);
        return apiError(err.status || 500, err.message || 'Erro interno.')
    }
}

/**
 * DELETE /api/users/[member_id]
 * Remove (desativa) um membro da organização
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ member_id: string }> }) {
    try {
        const auth = await authenticateRequest(req)
        const { member_id } = await params

        // db is imported globally

        await validateManagePermissions(supabaseAdmin, auth, 'delete', member_id);

        // Soft delete — set status to disabled
        const { error } = await supabaseAdmin
            .from('organization_members')
            .update({ status: 'disabled', deleted_at: new Date().toISOString() })
            .eq('id', member_id)

        if (error) return apiError(500, error.message)

        return new Response(null, { status: 204 })
    } catch (err: any) {
        console.error("DELETE /api/users/[member_id] Error:", err);
        return apiError(err.status || 500, err.message || 'Erro interno.')
    }
}
