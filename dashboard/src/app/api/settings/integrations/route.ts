import { NextRequest, NextResponse } from 'next/server';
import { getDrizzleDb } from '@/lib/db';
import { tenant_settings as settingsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthenticatedSession } from '@/lib/api-middleware';
import { encrypt } from '@/lib/encryption';

// GET /api/settings/integrations — Retrieve settings
export async function GET(request: NextRequest) {
  const auth = getAuthenticatedSession(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (auth.role !== 'admin' && auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = getDrizzleDb();
    
    // Attempt to select settings
    let settingsList = await db.select()
      .from(settingsTable)
      .where(eq(settingsTable.tenant_id, auth.tenantId));
    let settings = settingsList[0];

    // If no settings exist yet, create a default blank settings row
    if (!settings) {
      await db.insert(settingsTable)
        .values({
          tenant_id: auth.tenantId,
          alert_emails: '',
          slack_webhook_url: '',
          teams_webhook_url: '',
          custom_smtp_host: '',
          custom_smtp_port: 587,
          custom_smtp_user: '',
          custom_smtp_pass: '',
          custom_smtp_from: '',
        });

      settingsList = await db.select()
        .from(settingsTable)
        .where(eq(settingsTable.tenant_id, auth.tenantId));
      settings = settingsList[0];
    }

    // Mask password before returning
    if (settings && settings.custom_smtp_pass) {
      settings.custom_smtp_pass = '••••••••';
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching integrations settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/settings/integrations — Update settings
export async function PUT(request: NextRequest) {
  const auth = getAuthenticatedSession(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (auth.role !== 'admin' && auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const db = getDrizzleDb();

    // Load existing settings first to check custom SMTP password masking
    const currentSettingsList = await db.select()
      .from(settingsTable)
      .where(eq(settingsTable.tenant_id, auth.tenantId));
    const currentSettings = currentSettingsList[0];

    const updates: Partial<typeof settingsTable.$inferInsert> = {
      alert_emails: body.alert_emails ?? '',
      slack_webhook_url: body.slack_webhook_url ?? '',
      teams_webhook_url: body.teams_webhook_url ?? '',
      custom_smtp_host: body.custom_smtp_host ?? '',
      custom_smtp_port: body.custom_smtp_port ? parseInt(body.custom_smtp_port, 10) : 587,
      custom_smtp_user: body.custom_smtp_user ?? '',
      custom_smtp_from: body.custom_smtp_from ?? '',
    };

    // Only update password if it changed from masked value
    if (body.custom_smtp_pass && body.custom_smtp_pass !== '••••••••') {
      updates.custom_smtp_pass = encrypt(body.custom_smtp_pass);
    } else if (currentSettings) {
      updates.custom_smtp_pass = currentSettings.custom_smtp_pass;
    }

    await db.update(settingsTable)
      .set(updates)
      .where(eq(settingsTable.tenant_id, auth.tenantId));

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error updating integrations settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
