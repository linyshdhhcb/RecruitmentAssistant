const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "..", "data.sqlite");
const sourceJsonPath = path.join(__dirname, "..", "企业招聘官网.json");

const db = new Database(dbPath);

function nowIso() {
  return new Date().toISOString();
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS website (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      category TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      sort_index INTEGER NOT NULL DEFAULT 0,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_visited_at TEXT
    );
  `);

  const count = db.prepare("SELECT COUNT(1) AS total FROM website").get().total;
  if (count === 0) {
    seedFromJson();
  }
}

function seedFromJson() {
  if (!fs.existsSync(sourceJsonPath)) {
    return;
  }
  const raw = fs.readFileSync(sourceJsonPath, "utf8");
  const websites = JSON.parse(raw);
  const insert = db.prepare(`
    INSERT INTO website (name, url, category, notes, sort_index, is_enabled, created_at, updated_at, last_visited_at)
    VALUES (@name, @url, @category, @notes, @sort_index, @is_enabled, @created_at, @updated_at, @last_visited_at)
  `);
  const createdAt = nowIso();
  const insertMany = db.transaction((items) => {
    items.forEach((item, index) => {
      insert.run({
        name: item.name,
        url: item.url,
        category: "",
        notes: "",
        sort_index: index,
        is_enabled: 1,
        created_at: createdAt,
        updated_at: createdAt,
        last_visited_at: null
      });
    });
  });
  insertMany(websites);
}

function listWebsites(search = "") {
  const searchValue = `%${search.trim()}%`;
  return db
    .prepare(
      `
      SELECT * FROM website
      WHERE name LIKE ? OR url LIKE ? OR notes LIKE ?
      ORDER BY sort_index ASC, id ASC
    `
    )
    .all(searchValue, searchValue, searchValue);
}

function createWebsite(payload) {
  const nextSort = db.prepare("SELECT COALESCE(MAX(sort_index), -1) + 1 AS next_sort FROM website").get().next_sort;
  const timestamp = nowIso();
  const info = db
    .prepare(
      `
      INSERT INTO website (name, url, category, notes, sort_index, is_enabled, created_at, updated_at, last_visited_at)
      VALUES (@name, @url, @category, @notes, @sort_index, @is_enabled, @created_at, @updated_at, NULL)
    `
    )
    .run({
      name: payload.name.trim(),
      url: payload.url.trim(),
      category: (payload.category || "").trim(),
      notes: (payload.notes || "").trim(),
      sort_index: nextSort,
      is_enabled: payload.is_enabled ? 1 : 0,
      created_at: timestamp,
      updated_at: timestamp
    });
  return getWebsiteById(info.lastInsertRowid);
}

function updateWebsite(payload) {
  const timestamp = nowIso();
  db.prepare(
    `
    UPDATE website
    SET name = @name,
        url = @url,
        category = @category,
        notes = @notes,
        is_enabled = @is_enabled,
        updated_at = @updated_at
    WHERE id = @id
  `
  ).run({
    id: payload.id,
    name: payload.name.trim(),
    url: payload.url.trim(),
    category: (payload.category || "").trim(),
    notes: (payload.notes || "").trim(),
    is_enabled: payload.is_enabled ? 1 : 0,
    updated_at: timestamp
  });
  return getWebsiteById(payload.id);
}

function deleteWebsite(id) {
  db.prepare("DELETE FROM website WHERE id = ?").run(id);
}

function reorderWebsites(ids) {
  const update = db.prepare("UPDATE website SET sort_index = ?, updated_at = ? WHERE id = ?");
  const timestamp = nowIso();
  const run = db.transaction((list) => {
    list.forEach((id, index) => {
      update.run(index, timestamp, id);
    });
  });
  run(ids);
  return listWebsites();
}

function touchVisited(id) {
  db.prepare("UPDATE website SET last_visited_at = ?, updated_at = ? WHERE id = ?").run(nowIso(), nowIso(), id);
}

function exportWebsites() {
  return db
    .prepare(
      `
      SELECT id, name, url, category, notes, sort_index, is_enabled, created_at, updated_at, last_visited_at
      FROM website
      ORDER BY sort_index ASC, id ASC
    `
    )
    .all();
}

function replaceAllWebsites(items) {
  const insert = db.prepare(`
    INSERT INTO website (name, url, category, notes, sort_index, is_enabled, created_at, updated_at, last_visited_at)
    VALUES (@name, @url, @category, @notes, @sort_index, @is_enabled, @created_at, @updated_at, @last_visited_at)
  `);
  const clear = db.prepare("DELETE FROM website");
  const timestamp = nowIso();
  const run = db.transaction((records) => {
    clear.run();
    records.forEach((item, index) => {
      insert.run({
        name: String(item.name || "").trim(),
        url: String(item.url || "").trim(),
        category: String(item.category || "").trim(),
        notes: String(item.notes || "").trim(),
        sort_index: Number.isInteger(item.sort_index) ? item.sort_index : index,
        is_enabled: item.is_enabled === 0 ? 0 : 1,
        created_at: item.created_at || timestamp,
        updated_at: timestamp,
        last_visited_at: item.last_visited_at || null
      });
    });
  });
  run(items.filter((item) => item && item.name && item.url));
  return listWebsites();
}

function getWebsiteById(id) {
  return db.prepare("SELECT * FROM website WHERE id = ?").get(id);
}

module.exports = {
  initDb,
  listWebsites,
  createWebsite,
  updateWebsite,
  deleteWebsite,
  reorderWebsites,
  touchVisited,
  exportWebsites,
  replaceAllWebsites
};
