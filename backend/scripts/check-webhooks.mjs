import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(url, { max: 1, connect_timeout: 10 });

try {
  const failed = await sql`
    SELECT id, topic, resource_id, status, retry_count,
           error_message, created_at, next_retry_at
    FROM failed_webhooks
    ORDER BY created_at DESC
  `;

  console.log(`\nTotal failed webhooks: ${failed.length}`);
  console.log('─'.repeat(80));

  if (failed.length === 0) {
    console.log('No hay webhooks fallidos pendientes.');
  }

  for (const f of failed) {
    const canRetry = f.retry_count < 5 && f.status === 'pending';
    console.log(`ID:        ${f.id}`);
    console.log(`Topic:     ${f.topic}`);
    console.log(`Resource:  ${f.resource_id}`);
    console.log(`Status:    ${f.status}`);
    console.log(`Retries:   ${f.retry_count}/5`);
    console.log(`Error:     ${f.error_message || 'N/A'}`);
    console.log(`Created:   ${f.created_at}`);
    console.log(`Next retry:${f.next_retry_at || 'N/A'}`);
    console.log(`Can retry: ${canRetry ? 'YES' : 'NO (max retries or completed)'}`);
    console.log('─'.repeat(80));
  }

  // Check users without PRO
  const usersWithoutPro = await sql`
    SELECT id, email, name, tier, created_at
    FROM users
    WHERE tier IS DISTINCT FROM 'pro'
    ORDER BY created_at DESC
    LIMIT 10
  `;

  console.log(`\nRecent non-PRO users (last 10):`);
  console.log('─'.repeat(80));
  for (const u of usersWithoutPro) {
    console.log(`ID:    ${u.id}`);
    console.log(`Email: ${u.email}`);
    console.log(`Name:  ${u.name}`);
    console.log(`Tier:  ${u.tier}`);
    console.log(`Since: ${u.created_at}`);
    console.log('─'.repeat(80));
  }

  // Check for pro_payments without active subscription
  const orphanPayments = await sql`
    SELECT pp.id, pp.user_id, pp.mp_payment_id, pp.amount, pp.interval, pp.created_at,
           u.tier, u.email
    FROM pro_payments pp
    LEFT JOIN users u ON u.id = pp.user_id
    WHERE u.tier IS DISTINCT FROM 'pro' OR u.tier IS NULL
    ORDER BY pp.created_at DESC
  `;

  console.log(`\nPro payments without active subscription: ${orphanPayments.length}`);
  console.log('─'.repeat(80));
  for (const p of orphanPayments) {
    console.log(`User:    ${p.user_id}`);
    console.log(`Email:   ${p.email || 'N/A'}`);
    console.log(`Payment: ${p.mp_payment_id}`);
    console.log(`Amount:  ${p.amount}`);
    console.log(`Plan:    ${p.interval}`);
    console.log(`Tier:    ${p.tier}`);
    console.log(`Date:    ${p.created_at}`);
    console.log('─'.repeat(80));
  }

  await sql.end();
} catch (err) {
  console.error('Error:', err.message);
  await sql.end({ timeout: 2 });
}
