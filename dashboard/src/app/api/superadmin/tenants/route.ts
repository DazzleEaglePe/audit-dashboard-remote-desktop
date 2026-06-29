import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcryptjs from 'bcryptjs';
import { getDrizzleDb } from '@/lib/db';
import { 
  tenants as tenantsTable, 
  users as usersTable, 
  tenant_settings as settingsTable, 
  notifications as notificationsTable,
  servers as serversTable,
  sessions as sessionsTable,
  session_logs as logsTable,
  server_metrics as metricsTable,
  alerts as alertsTable,
  screenshot_metadata as screenshotTable,
  admin_audit_logs as auditTable,
  api_keys as apiKeysTable
} from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getAuthenticatedSession } from '@/lib/api-middleware';

// Helper to validate tenant slugs
function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && slug.length >= 3 && slug.length <= 30;
}

// GET /api/superadmin/tenants — List all tenants with statistics
export async function GET(request: NextRequest) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session || session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const db = getDrizzleDb();
    
    // Fetch all tenants
    const allTenants = await db.select().from(tenantsTable);

    // Map stats (user count, server count)
    const tenantsWithStats = await Promise.all(allTenants.map(async (tenant) => {
      // Avoid querying stats if we are dealing with the system operator tenant directly
      const usersCountResultList = await db.select({ count: sql<number>`count(*)` })
        .from(usersTable)
        .where(eq(usersTable.tenant_id, tenant.id));
      const usersCountResult = usersCountResultList[0];
        
      const serversCountResultList = await db.select({ count: sql<number>`count(*)` })
        .from(serversTable)
        .where(eq(serversTable.tenant_id, tenant.id));
      const serversCountResult = serversCountResultList[0];

      return {
        ...tenant,
        usersCount: Number(usersCountResult?.count || 0),
        serversCount: Number(serversCountResult?.count || 0),
      };
    }));

    return NextResponse.json(tenantsWithStats);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/superadmin/tenants — Create a new tenant with primary admin user and onboarding activation token
export async function POST(request: NextRequest) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session || session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      id, 
      name, 
      plan, 
      max_servers, 
      expires_at, 
      domain,
      adminUsername,
      adminEmail,
      adminFullName 
    } = body;

    // Validation
    if (!id || !name || !adminUsername || !adminEmail || !adminFullName) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail.trim())) {
      return NextResponse.json({ error: 'El formato de correo electrónico es inválido' }, { status: 400 });
    }

    // Validate max_servers
    let maxServersVal = max_servers ? parseInt(max_servers, 10) : 5;
    if (isNaN(maxServersVal) || maxServersVal < 1 || maxServersVal > 1000) {
      return NextResponse.json({ error: 'El límite de servidores debe ser un número entre 1 y 1000' }, { status: 400 });
    }

    const tenantId = id.trim().toLowerCase();
    if (!isValidSlug(tenantId)) {
      return NextResponse.json({ 
        error: 'El identificador (ID) debe tener entre 3 y 30 caracteres y contener solo letras minúsculas, números y guiones.' 
      }, { status: 400 });
    }

    if (tenantId === 'default' || tenantId === 'system') {
      return NextResponse.json({ error: 'Este identificador está reservado por el sistema.' }, { status: 400 });
    }

    const db = getDrizzleDb();

    // Check if tenant already exists
    const existingTenantList = await db.select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));
    const existingTenant = existingTenantList[0];

    if (existingTenant) {
      return NextResponse.json({ error: 'Ya existe un cliente con este identificador (ID).' }, { status: 409 });
    }

    // Check if username already exists globally
    const existingUserList = await db.select()
      .from(usersTable)
      .where(eq(usersTable.username, adminUsername.trim()));
    const existingUser = existingUserList[0];

    if (existingUser) {
      return NextResponse.json({ error: 'El nombre de usuario del administrador ya está en uso.' }, { status: 409 });
    }

    // Create Tenant
    await db.insert(tenantsTable)
      .values({
        id: tenantId,
        name: name.trim(),
        plan: plan || 'basic',
        max_servers: maxServersVal,
        expires_at: expires_at || null,
        domain: domain ? domain.trim().toLowerCase() : null,
        status: 'active',
      });

    // Create default Settings row for tenant
    await db.insert(settingsTable)
      .values({
        tenant_id: tenantId,
        alert_emails: adminEmail.trim(),
        slack_webhook_url: '',
        teams_webhook_url: '',
        custom_smtp_host: '',
        custom_smtp_port: 587,
        custom_smtp_user: '',
        custom_smtp_pass: '',
        custom_smtp_from: '',
      });

    // Generate Activation Token (expires in 24 hours)
    const activationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Hash a secure temporary password (unused, will be reset by user)
    const tempPasswordHash = bcryptjs.hashSync(crypto.randomBytes(16).toString('hex'), 10);

    // Create Admin User
    await db.insert(usersTable)
      .values({
        tenant_id: tenantId,
        username: adminUsername.trim(),
        password_hash: tempPasswordHash,
        full_name: adminFullName.trim(),
        email: adminEmail.trim(),
        role: 'admin',
        activation_token: activationToken,
        activation_token_expires_at: tokenExpiry,
        password_change_required: 1, // Require password set on first login
      });

    // Get origin of the request for activation link
    const origin = request.nextUrl.origin;
    const activationLink = `${origin}/activate?token=${activationToken}`;

    // Queue system notification (which triggers SMTP dispatch in background worker)
    await db.insert(notificationsTable)
      .values({
        tenant_id: tenantId,
        title: 'Activa tu cuenta de Auditoría ECA',
        message: `Hola ${adminFullName},\n\nSe ha creado tu cuenta para la plataforma de auditoría RDP de ECA (Cliente: ${name}).\n\nPor favor, activa tu cuenta y configura tu contraseña en el siguiente enlace:\n${activationLink}\n\nEste enlace de activación expira en 24 horas.\n\nAtentamente,\nEl Equipo de Auditoría ECA`,
        type: 'system',
        email_sent: 0, // Pending SMTP dispatch
        recipient_email: adminEmail.trim(),
      });

    return NextResponse.json({ 
      status: 'ok', 
      tenantId, 
      activationLink 
    });
  } catch (error) {
    console.error('Error creating tenant:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT /api/superadmin/tenants — Update tenant details or suspension status
export async function PUT(request: NextRequest) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session || session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, plan, max_servers, expires_at, domain, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'El ID del inquilino es obligatorio' }, { status: 400 });
    }

    const db = getDrizzleDb();

    // Verify tenant exists
    const tenantList = await db.select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, id));
    const tenant = tenantList[0];

    if (!tenant) {
      return NextResponse.json({ error: 'Inquilino no encontrado' }, { status: 404 });
    }

    if (id === 'system' && status && status !== 'active') {
      return NextResponse.json({ error: 'No se puede suspender el inquilino operador del sistema.' }, { status: 400 });
    }

    // Perform update
    await db.update(tenantsTable)
      .set({
        name: name ? name.trim() : tenant.name,
        plan: plan ?? tenant.plan,
        max_servers: max_servers !== undefined ? parseInt(max_servers, 10) : tenant.max_servers,
        expires_at: expires_at !== undefined ? expires_at : tenant.expires_at,
        domain: domain !== undefined ? (domain ? domain.trim().toLowerCase() : null) : tenant.domain,
        status: status ?? tenant.status,
      })
      .where(eq(tenantsTable.id, id));

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error updating tenant:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/superadmin/tenants — Delete a tenant (Cascades to all tables)
export async function DELETE(request: NextRequest) {
  try {
    const session = getAuthenticatedSession(request);
    if (!session || session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'El ID del inquilino es obligatorio' }, { status: 400 });
    }

    if (id === 'default' || id === 'system') {
      return NextResponse.json({ error: 'No se pueden eliminar los inquilinos del sistema principal.' }, { status: 400 });
    }

    const db = getDrizzleDb();

    // Verify tenant exists
    const tenantList = await db.select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, id));
    const tenant = tenantList[0];

    if (!tenant) {
      return NextResponse.json({ error: 'Inquilino no encontrado' }, { status: 404 });
    }

    // Perform explicit deletes inside a transaction for tables where tenant_id might have been added via ALTER TABLE.
    // SQLite does not properly enforce ON DELETE CASCADE for columns added dynamically via ALTER TABLE.
    await db.transaction(async (tx) => {
      await tx.delete(sessionsTable).where(eq(sessionsTable.tenant_id, id));
      await tx.delete(logsTable).where(eq(logsTable.tenant_id, id));
      await tx.delete(metricsTable).where(eq(metricsTable.tenant_id, id));
      await tx.delete(alertsTable).where(eq(alertsTable.tenant_id, id));
      await tx.delete(screenshotTable).where(eq(screenshotTable.tenant_id, id));
      await tx.delete(auditTable).where(eq(auditTable.tenant_id, id));
      await tx.delete(notificationsTable).where(eq(notificationsTable.tenant_id, id));
      await tx.delete(apiKeysTable).where(eq(apiKeysTable.tenant_id, id));
      await tx.delete(settingsTable).where(eq(settingsTable.tenant_id, id));
      await tx.delete(usersTable).where(eq(usersTable.tenant_id, id));
      await tx.delete(serversTable).where(eq(serversTable.tenant_id, id));

      // Delete tenant itself
      await tx.delete(tenantsTable)
        .where(eq(tenantsTable.id, id));
    });

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
