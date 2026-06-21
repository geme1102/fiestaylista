import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(url, { max: 1, connect_timeout: 10 });

try {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/activate-pro.mjs <email>');
    process.exit(1);
  }

  const [user] = await sql`
    SELECT id, email, name, tier FROM users WHERE email = ${email}
  `;

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  console.log(`Found user: ${user.name} (${user.email}) - Tier: ${user.tier}`);

  // 1. Create pro_payments table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS "pro_payments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "mp_payment_id" text NOT NULL UNIQUE,
      "amount" integer NOT NULL,
      "interval" text DEFAULT 'month' NOT NULL,
      "status" text DEFAULT 'completed' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `;
  console.log('✓ pro_payments table ready');

  // 2. Create index if not exists
  await sql`
    CREATE INDEX IF NOT EXISTS pro_payments_user_id_idx ON pro_payments (user_id)
  `;

  // 3. Create or update subscription
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO subscriptions (user_id, status, tier, current_period_start, current_period_end, updated_at)
    VALUES (${user.id}, 'active', 'pro', ${now}, ${end}, ${now})
    ON CONFLICT (user_id)
    DO UPDATE SET
      status = 'active',
      tier = 'pro',
      current_period_start = ${now},
      current_period_end = ${end},
      updated_at = ${now}
  `;
  console.log('✓ Subscription created/updated');

  // 4. Update user tier
  await sql`
    UPDATE users SET tier = 'pro' WHERE id = ${user.id}
  `;
  console.log('✓ User tier updated to pro');

  console.log(`\n✅ PRO activated for ${user.name} (${user.email})`);
  console.log(`   Period: ${now.toISOString()} → ${end.toISOString()}`);

  await sql.end();
} catch (err) {
  console.error('Error:', err.message);
  await sql.end({ timeout: 2 });
  process.exit(1);
}
