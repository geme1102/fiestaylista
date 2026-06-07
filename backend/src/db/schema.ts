import { pgTable, uuid, text, boolean, timestamp, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  tier: text('tier').notNull().default('free'),

  /** @deprecated No longer used in code — kept for migration compatibility */
  lastSequenceCheck: timestamp('last_sequence_check', { mode: 'date' }),
  emailVerified: boolean('email_verified').notNull().default(false),
  verificationToken: text('verification_token'),
  verificationTokenExpires: timestamp('verification_token_expires', { mode: 'date' }),
  resetToken: text('reset_token'),
  resetTokenExpires: timestamp('reset_token_expires', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  verificationTokenIdx: index('users_verification_token_idx').on(table.verificationToken),
  resetTokenIdx: index('users_reset_token_idx').on(table.resetToken),
}));

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  eventType: text('event_type').notNull().default('BABY_SHOWER'),
  hostPhone: text('host_phone'),
  slug: text('slug').notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  boostedUntil: timestamp('boosted_until', { mode: 'date' }),
  deletedAt: timestamp('deleted_at', { mode: 'date' }),
  viewCount: integer('view_count').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('events_user_id_idx').on(table.userId),
  userIdDeletedAtIdx: index('events_user_id_deleted_at_idx').on(table.userId, table.deletedAt),
}));

export const gifts = pgTable('gifts', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isClaimed: boolean('is_claimed').notNull().default(false),
  claimedBy: text('claimed_by'),
  deletedAt: timestamp('deleted_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  eventIdIdx: index('gifts_event_id_idx').on(table.eventId),
  eventIdDeletedAtIdx: index('gifts_event_id_deleted_at_idx').on(table.eventId, table.deletedAt),
  eventIdUnclaimedIdx: index('gifts_event_id_unclaimed_idx').on(table.eventId).where(sql`${table.isClaimed} = false`),
}));

export const photos = pgTable('photos', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  caption: text('caption'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  eventIdIdx: index('photos_event_id_idx').on(table.eventId),
}));

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  mpSubscriptionId: text('mp_subscription_id'),
  status: text('status').notNull().default('incomplete'),
  tier: text('tier').notNull().default('free'),
  currentPeriodStart: timestamp('current_period_start', { mode: 'date' }),
  currentPeriodEnd: timestamp('current_period_end', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const cashFunds = pgTable('cash_funds', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().unique().references(() => events.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('Lluvia de sobres'),
  description: text('description'),
  targetAmount: integer('target_amount'),
  collectedAmount: integer('collected_amount').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const cashContributions = pgTable('cash_contributions', {
  id: uuid('id').defaultRandom().primaryKey(),
  cashFundId: uuid('cash_fund_id').notNull().references(() => cashFunds.id, { onDelete: 'cascade' }),
  contributorName: text('contributor_name').notNull(),
  message: text('message'),
  amount: integer('amount').notNull(),
  feeAmount: integer('fee_amount').notNull().default(0),
  netAmount: integer('net_amount').notNull().default(0),
  mpPaymentId: text('mp_payment_id'),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  cashFundIdIdx: index('cash_contributions_cash_fund_id_idx').on(table.cashFundId),
  statusCreatedAtIdx: index('cash_contributions_status_created_at_idx').on(table.status, table.createdAt),
}));

export const boostPayments = pgTable('boost_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  mpPaymentId: text('mp_payment_id').notNull().unique(),
  amount: integer('amount').notNull(),
  status: text('status').notNull().default('completed'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const failedWebhooks = pgTable('failed_webhooks', {
  id: uuid('id').defaultRandom().primaryKey(),
  topic: text('topic').notNull(),
  resourceId: text('resource_id').notNull(),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  lastAttemptAt: timestamp('last_attempt_at', { mode: 'date' }),
  nextRetryAt: timestamp('next_retry_at', { mode: 'date' }),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('failed_webhooks_status_idx').on(table.status),
}));

export const platformFees = pgTable('platform_fees', {
  id: uuid('id').defaultRandom().primaryKey(),
  contributionId: uuid('contribution_id').notNull().references(() => cashContributions.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  feeAmount: integer('fee_amount').notNull(),
  netAmount: integer('net_amount').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  contributionIdIdx: index('platform_fees_contribution_id_idx').on(table.contributionId),
}));

export const emailTracking = pgTable('email_tracking', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  sentAt: timestamp('sent_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userIdTypeIdx: uniqueIndex('email_tracking_user_id_type_unique_idx').on(table.userId, table.type),
  sentAtIdx: index('email_tracking_sent_at_idx').on(table.sentAt),
}));

export const eventViews = pgTable('event_views', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  referrer: text('referrer'),
  userAgent: text('user_agent'),
  viewedAt: timestamp('viewed_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  eventIdIdx: index('event_views_event_id_idx').on(table.eventId),
  eventIdViewedAtIdx: index('event_views_event_id_viewed_at_idx').on(table.eventId, table.viewedAt),
}));

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  revoked: boolean('revoked').notNull().default(false),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  tokenHashIdx: index('refresh_tokens_token_hash_idx').on(table.tokenHash),
  userIdIdx: index('refresh_tokens_user_id_idx').on(table.userId),
}));

export const consentRecords = pgTable('consent_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  version: text('version').notNull().default('1.0'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  granted: boolean('granted').notNull().default(true),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('consent_records_user_id_idx').on(table.userId),
}));

export const arcoRequests = pgTable('arco_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  requestType: text('request_type').notNull(),
  details: text('details'),
  status: text('status').notNull().default('pending'),
  completedAt: timestamp('completed_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('arco_requests_user_id_idx').on(table.userId),
}));

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id'),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  resourceId: text('resource_id'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  events: many(events),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),

  emailTracking: many(emailTracking),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  user: one(users, {
    fields: [events.userId],
    references: [users.id],
  }),
  gifts: many(gifts),
  photos: many(photos),
  cashFund: one(cashFunds, {
    fields: [events.id],
    references: [cashFunds.eventId],
  }),
  boostPayments: many(boostPayments),
  views: many(eventViews),
}));

export const giftsRelations = relations(gifts, ({ one }) => ({
  event: one(events, {
    fields: [gifts.eventId],
    references: [events.id],
  }),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  event: one(events, {
    fields: [photos.eventId],
    references: [events.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const cashFundsRelations = relations(cashFunds, ({ one, many }) => ({
  event: one(events, {
    fields: [cashFunds.eventId],
    references: [events.id],
  }),
  contributions: many(cashContributions),
}));

export const cashContributionsRelations = relations(cashContributions, ({ one }) => ({
  cashFund: one(cashFunds, {
    fields: [cashContributions.cashFundId],
    references: [cashFunds.id],
  }),
}));

export const boostPaymentsRelations = relations(boostPayments, ({ one }) => ({
  event: one(events, {
    fields: [boostPayments.eventId],
    references: [events.id],
  }),
}));

export const emailTrackingRelations = relations(emailTracking, ({ one }) => ({
  user: one(users, {
    fields: [emailTracking.userId],
    references: [users.id],
  }),
}));

export const eventViewsRelations = relations(eventViews, ({ one }) => ({
  event: one(events, {
    fields: [eventViews.eventId],
    references: [events.id],
  }),
}));

export const consentRecordsRelations = relations(consentRecords, ({ one }) => ({
  user: one(users, {
    fields: [consentRecords.userId],
    references: [users.id],
  }),
}));

export const arcoRequestsRelations = relations(arcoRequests, ({ one }) => ({
  user: one(users, {
    fields: [arcoRequests.userId],
    references: [users.id],
  }),
}));
