import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { toMatchingKey, normalizeUnicode } from './normalizer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.dirname(path.dirname(__dirname))
const defaultDbPath = path.join(rootDir, 'data', 'admin-address.db')

let dbInstance = null

export const getDatabase = (customPath = null) => {
  if (dbInstance && !customPath) return dbInstance

  const dbPath = customPath || process.env.ADMIN_ADDRESS_DB || defaultDbPath
  const dir = path.dirname(dbPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const db = new DatabaseSync(dbPath)
  initSchema(db)

  if (!customPath) {
    dbInstance = db
  }
  return db
}

export const initSchema = (db) => {
  // Bật foreign keys và WAL mode (nếu hỗ trợ qua PRAGMA)
  db.exec('PRAGMA foreign_keys = ON;')

  // 1. Bảng đơn vị hành chính
  db.exec(`
    CREATE TABLE IF NOT EXISTS administrative_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_code TEXT,
      unit_name TEXT NOT NULL,
      unit_type TEXT,
      level INTEGER,
      parent_code TEXT,
      parent_name TEXT,
      parent_key TEXT,
      matching_key TEXT NOT NULL,
      status TEXT DEFAULT 'ACTIVE'
    );

    CREATE INDEX IF NOT EXISTS idx_units_key ON administrative_units(matching_key, level);
  `)

  // 2. Bảng văn bản pháp lý
  db.exec(`
    CREATE TABLE IF NOT EXISTS legal_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_number TEXT UNIQUE NOT NULL,
      document_type TEXT,
      title TEXT NOT NULL,
      issuing_authority TEXT,
      issued_date TEXT,
      effective_date TEXT,
      source_url TEXT,
      article TEXT,
      clause TEXT,
      document_hash TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_legal_doc_num ON legal_documents(document_number);
  `)

  // 3. Bảng ánh xạ cũ -> mới
  db.exec(`
    CREATE TABLE IF NOT EXISTS administrative_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      old_province_name TEXT NOT NULL,
      old_district_name TEXT,
      old_ward_name TEXT NOT NULL,
      old_province_key TEXT NOT NULL,
      old_district_key TEXT,
      old_ward_key TEXT NOT NULL,

      new_province_name TEXT NOT NULL,
      new_ward_name TEXT NOT NULL,
      new_province_key TEXT NOT NULL,
      new_ward_key TEXT NOT NULL,

      mapping_type TEXT NOT NULL, -- FULL, PARTIAL, UNCHANGED, MERGED, SPLIT, UNKNOWN
      effective_from TEXT,
      effective_to TEXT,
      legal_document_id INTEGER REFERENCES legal_documents(id),
      note TEXT,
      confidence REAL DEFAULT 1.0,
      verified INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_map_old_keys ON administrative_mappings(old_province_key, old_district_key, old_ward_key);
    CREATE INDEX IF NOT EXISTS idx_map_old_ward ON administrative_mappings(old_ward_key);
    CREATE INDEX IF NOT EXISTS idx_map_new_keys ON administrative_mappings(new_province_key, new_ward_key);
    CREATE INDEX IF NOT EXISTS idx_map_type ON administrative_mappings(mapping_type);
  `)

  // 4. Bảng phiên bản dữ liệu
  db.exec(`
    CREATE TABLE IF NOT EXISTS data_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT UNIQUE NOT NULL,
      effective_date TEXT,
      description TEXT,
      source_count INTEGER DEFAULT 0,
      record_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'PUBLISHED',
      created_at TEXT DEFAULT (datetime('now')),
      published_at TEXT DEFAULT (datetime('now'))
    );
  `)

  // 5. Bảng staging lưu các thay đổi phát hiện cần duyệt
  db.exec(`
    CREATE TABLE IF NOT EXISTS candidate_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT,
      source_document TEXT,
      change_type TEXT,
      old_value TEXT,
      new_value TEXT,
      detected_at TEXT DEFAULT (datetime('now')),
      validation_status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, NEEDS_REVIEW
      review_note TEXT,
      published_version TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_candidate_status ON candidate_changes(validation_status);
  `)
}

export const closeDatabase = () => {
  if (dbInstance) {
    try {
      dbInstance.close()
    } catch {}
    dbInstance = null
  }
}

export const reseedDatabase = async () => {
  const db = getDatabase()
  const { initDatabase } = await import('./seed-data.js')
  return initDatabase(db)
}
