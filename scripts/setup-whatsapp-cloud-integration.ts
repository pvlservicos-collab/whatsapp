import { createClient } from '@supabase/supabase-js';

const ORG_ID = 'd17ec329-e074-46a0-b5a4-f3617e161cca';
const WABA_ID = '876161085193833';
const STAGE_FOLLOWUP = 'd3d3031f-bc4b-44df-bd83-b1f07d7fbf85';
const STAGE_ABOUT_TO_PAY = '0a58795e-31c1-4cdd-9cfa-408412d5ce7a';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const systemToken = process.env.WHATSAPP_CLOUD_SYSTEM_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;

  if (!systemToken) throw new Error('WHATSAPP_CLOUD_SYSTEM_TOKEN env var required');
  if (!phoneNumberId) throw new Error('WHATSAPP_CLOUD_PHONE_NUMBER_ID env var required');

  const s = createClient(url, serviceKey);

  const config = {
    waba_id: WABA_ID,
    phone_number_id: phoneNumberId,
    graph_api_version: 'v21.0',
    templates: {
      [STAGE_FOLLOWUP]: 'follow_up_avaliacao',
      [STAGE_ABOUT_TO_PAY]: 'followup_comprovante',
    },
  };

  const { data: existing } = await s
    .from('integrations')
    .select('id')
    .eq('organization_id', ORG_ID)
    .eq('type', 'whatsapp_cloud_official')
    .maybeSingle();

  let integrationId: string;
  if (existing) {
    integrationId = existing.id;
    const { error } = await s
      .from('integrations')
      .update({ config, status: 'active' })
      .eq('id', integrationId);
    if (error) throw error;
    console.log('Updated integration', integrationId);
  } else {
    const { data, error } = await s
      .from('integrations')
      .insert({
        organization_id: ORG_ID,
        name: 'WhatsApp Cloud (Oficial)',
        type: 'whatsapp_cloud_official',
        status: 'active',
        config,
      })
      .select('id')
      .single();
    if (error) throw error;
    integrationId = data.id;
    console.log('Created integration', integrationId);
  }

  // upsert_integration_secret_service: service-role variant that skips has_permission()
  // (caller is a trusted setup script). See database/027_whatsapp_cloud_followup.sql.
  const { error: secretErr } = await s.rpc('upsert_integration_secret_service', {
    p_integration_id: integrationId,
    p_org_id: ORG_ID,
    p_secret: { system_token: systemToken },
  });
  if (secretErr) throw secretErr;

  console.log('Token stored in Vault. Integration ready:', integrationId);
}

main().catch((e) => { console.error(e); process.exit(1); });
