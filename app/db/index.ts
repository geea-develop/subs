import * as path from 'node:path'
import Database from 'better-sqlite3'
import type { Subscription } from '~/store/subscriptionStore'
import { defaultSubscriptions } from '~/store/subscriptionStore'

const DB_PATH = path.join(process.cwd(), 'data', 'subs.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL,
      domain TEXT NOT NULL,
      icon TEXT,
      billing_cycle TEXT,
      next_payment_date TEXT,
      show_next_payment INTEGER DEFAULT 0,
      category TEXT,
      source TEXT,
      source_email_id TEXT,
      imported_at TEXT,
      trial_end_date TEXT,
      cancellation_url TEXT,
      account_email TEXT,
      notes TEXT,
      contract_end_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)

  // Seed with defaults if the table is empty
  const count = database.prepare('SELECT COUNT(*) as count FROM subscriptions').get() as { count: number }
  if (count.count === 0) {
    const insert = database.prepare(`
      INSERT INTO subscriptions (id, name, price, currency, domain)
      VALUES (@id, @name, @price, @currency, @domain)
    `)
    const seedMany = database.transaction((subs: Subscription[]) => {
      for (const sub of subs) {
        insert.run(sub)
      }
    })
    seedMany(defaultSubscriptions)
  }
}

// -- Query helpers --

function rowToSubscription(row: Record<string, unknown>): Subscription {
  const sub: Subscription = {
    id: row.id as string,
    name: row.name as string,
    price: row.price as number,
    currency: row.currency as string,
    domain: row.domain as string,
  }
  if (row.icon) sub.icon = row.icon as string
  if (row.billing_cycle) sub.billingCycle = row.billing_cycle as Subscription['billingCycle']
  if (row.next_payment_date) sub.nextPaymentDate = row.next_payment_date as string
  if (row.show_next_payment) sub.showNextPayment = row.show_next_payment === 1
  if (row.category) sub.category = row.category as Subscription['category']
  if (row.source) sub.source = row.source as Subscription['source']
  if (row.source_email_id) sub.sourceEmailId = row.source_email_id as string
  if (row.imported_at) sub.importedAt = row.imported_at as string
  if (row.trial_end_date) sub.trialEndDate = row.trial_end_date as string
  if (row.cancellation_url) sub.cancellationUrl = row.cancellation_url as string
  if (row.account_email) sub.accountEmail = row.account_email as string
  if (row.notes) sub.notes = row.notes as string
  if (row.contract_end_date) sub.contractEndDate = row.contract_end_date as string
  return sub
}

export function getAllSubscriptions(): Subscription[] {
  const rows = getDb().prepare('SELECT * FROM subscriptions ORDER BY created_at ASC').all()
  return rows.map((row) => rowToSubscription(row as Record<string, unknown>))
}

export function getSubscription(id: string): Subscription | null {
  const row = getDb().prepare('SELECT * FROM subscriptions WHERE id = ?').get(id)
  if (!row) return null
  return rowToSubscription(row as Record<string, unknown>)
}

export function createSubscription(sub: Omit<Subscription, 'id'>): Subscription {
  const id = crypto.randomUUID()
  const db = getDb()
  db.prepare(`
    INSERT INTO subscriptions (
      id, name, price, currency, domain, icon, billing_cycle, next_payment_date,
      show_next_payment, category, source, source_email_id, imported_at,
      trial_end_date, cancellation_url, account_email, notes, contract_end_date
    ) VALUES (
      @id, @name, @price, @currency, @domain, @icon, @billingCycle, @nextPaymentDate,
      @showNextPayment, @category, @source, @sourceEmailId, @importedAt,
      @trialEndDate, @cancellationUrl, @accountEmail, @notes, @contractEndDate
    )
  `).run({
    id,
    name: sub.name,
    price: sub.price,
    currency: sub.currency,
    domain: sub.domain,
    icon: sub.icon ?? null,
    billingCycle: sub.billingCycle ?? null,
    nextPaymentDate: sub.nextPaymentDate ?? null,
    showNextPayment: sub.showNextPayment ? 1 : 0,
    category: sub.category ?? null,
    source: sub.source ?? null,
    sourceEmailId: sub.sourceEmailId ?? null,
    importedAt: sub.importedAt ?? null,
    trialEndDate: sub.trialEndDate ?? null,
    cancellationUrl: sub.cancellationUrl ?? null,
    accountEmail: sub.accountEmail ?? null,
    notes: sub.notes ?? null,
    contractEndDate: sub.contractEndDate ?? null,
  })
  return { id, ...sub }
}

export function updateSubscription(id: string, updates: Partial<Omit<Subscription, 'id'>>): Subscription | null {
  const existing = getSubscription(id)
  if (!existing) return null

  const merged = { ...existing, ...updates }
  const db = getDb()
  db.prepare(`
    UPDATE subscriptions SET
      name = @name, price = @price, currency = @currency, domain = @domain,
      icon = @icon, billing_cycle = @billingCycle, next_payment_date = @nextPaymentDate,
      show_next_payment = @showNextPayment, category = @category, source = @source,
      source_email_id = @sourceEmailId, imported_at = @importedAt,
      trial_end_date = @trialEndDate, cancellation_url = @cancellationUrl,
      account_email = @accountEmail, notes = @notes, contract_end_date = @contractEndDate,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id,
    name: merged.name,
    price: merged.price,
    currency: merged.currency,
    domain: merged.domain,
    icon: merged.icon ?? null,
    billingCycle: merged.billingCycle ?? null,
    nextPaymentDate: merged.nextPaymentDate ?? null,
    showNextPayment: merged.showNextPayment ? 1 : 0,
    category: merged.category ?? null,
    source: merged.source ?? null,
    sourceEmailId: merged.sourceEmailId ?? null,
    importedAt: merged.importedAt ?? null,
    trialEndDate: merged.trialEndDate ?? null,
    cancellationUrl: merged.cancellationUrl ?? null,
    accountEmail: merged.accountEmail ?? null,
    notes: merged.notes ?? null,
    contractEndDate: merged.contractEndDate ?? null,
  })
  return merged
}

export function deleteSubscription(id: string): boolean {
  const result = getDb().prepare('DELETE FROM subscriptions WHERE id = ?').run(id)
  return result.changes > 0
}

export function replaceAllSubscriptions(subs: Subscription[]): void {
  const db = getDb()
  const transaction = db.transaction((subscriptions: Subscription[]) => {
    db.prepare('DELETE FROM subscriptions').run()
    const insert = db.prepare(`
      INSERT INTO subscriptions (
        id, name, price, currency, domain, icon, billing_cycle, next_payment_date,
        show_next_payment, category, source, source_email_id, imported_at,
        trial_end_date, cancellation_url, account_email, notes, contract_end_date
      ) VALUES (
        @id, @name, @price, @currency, @domain, @icon, @billingCycle, @nextPaymentDate,
        @showNextPayment, @category, @source, @sourceEmailId, @importedAt,
        @trialEndDate, @cancellationUrl, @accountEmail, @notes, @contractEndDate
      )
    `)
    for (const sub of subscriptions) {
      insert.run({
        id: sub.id,
        name: sub.name,
        price: sub.price,
        currency: sub.currency,
        domain: sub.domain,
        icon: sub.icon ?? null,
        billingCycle: sub.billingCycle ?? null,
        nextPaymentDate: sub.nextPaymentDate ?? null,
        showNextPayment: sub.showNextPayment ? 1 : 0,
        category: sub.category ?? null,
        source: sub.source ?? null,
        sourceEmailId: sub.sourceEmailId ?? null,
        importedAt: sub.importedAt ?? null,
        trialEndDate: sub.trialEndDate ?? null,
        cancellationUrl: sub.cancellationUrl ?? null,
        accountEmail: sub.accountEmail ?? null,
        notes: sub.notes ?? null,
        contractEndDate: sub.contractEndDate ?? null,
      })
    }
  })
  transaction(subs)
}
