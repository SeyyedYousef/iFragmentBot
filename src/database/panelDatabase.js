/**
 * Panel Database Service
 * SQLite database for storing profiles, orders, proxies, and account status
 */

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
	fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "panel.db");
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");

// ==================== SCHEMA INITIALIZATION ====================

function initializeDatabase() {
	// Profiles table - for storing profile templates
	db.exec(`
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT,
            last_name TEXT,
            bio TEXT,
            photo_path TEXT,
            username TEXT,
            is_used INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

	// Orders table - for tracking fake panel orders
	db.exec(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            target TEXT NOT NULL,
            count INTEGER DEFAULT 0,
            completed INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            error_message TEXT,
            started_at DATETIME,
            finished_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

	// Proxies table - for proxy management
	db.exec(`
        CREATE TABLE IF NOT EXISTS proxies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT DEFAULT 'socks5',
            host TEXT NOT NULL,
            port INTEGER NOT NULL,
            username TEXT,
            password TEXT,
            is_active INTEGER DEFAULT 1,
            last_used DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

	// Account status table - for tracking report/rest status
	db.exec(`
        CREATE TABLE IF NOT EXISTS account_status (
            phone TEXT PRIMARY KEY,
            is_reported INTEGER DEFAULT 0,
            is_resting INTEGER DEFAULT 0,
            rest_until DATETIME,
            report_count INTEGER DEFAULT 0,
            last_action DATETIME,
            proxy_id INTEGER,
            folder TEXT DEFAULT 'default',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

	// Receiver accounts table - accounts donated by non-admin users
	db.exec(`
        CREATE TABLE IF NOT EXISTS receiver_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE NOT NULL,
            session_string TEXT,
            donated_by INTEGER NOT NULL,
            donated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_approved INTEGER DEFAULT 0,
            approved_at DATETIME
        )
    `);

	// Main Accounts table - Replaces sessions.json
	db.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
            phone TEXT PRIMARY KEY,
            user_id TEXT,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            session_string TEXT,
            is_active INTEGER DEFAULT 1,
            status TEXT DEFAULT 'unknown',
            role TEXT DEFAULT 'all',
            proxy_config TEXT, -- JSON
            stats_json TEXT,   -- JSON
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_connected DATETIME,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

	// Settings table - for storing bot settings
	db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

	console.log("✅ Panel database initialized");
}

// Initialize on import
initializeDatabase();

// ==================== PROFILES ====================

const profileQueries = {
	insert: db.prepare(`
        INSERT INTO profiles (first_name, last_name, bio, photo_path, username)
        VALUES (?, ?, ?, ?, ?)
    `),
	getAll: db.prepare("SELECT * FROM profiles ORDER BY id DESC"),
	getUnused: db.prepare(
		"SELECT * FROM profiles WHERE is_used = 0 ORDER BY RANDOM() LIMIT 1",
	),
	getById: db.prepare("SELECT * FROM profiles WHERE id = ?"),
	markUsed: db.prepare("UPDATE profiles SET is_used = 1 WHERE id = ?"),
	delete: db.prepare("DELETE FROM profiles WHERE id = ?"),
	deleteAll: db.prepare("DELETE FROM profiles"),
	count: db.prepare("SELECT COUNT(*) as count FROM profiles"),
	countUnused: db.prepare(
		"SELECT COUNT(*) as count FROM profiles WHERE is_used = 0",
	),
};

export const profiles = {
	add(firstName, lastName = "", bio = "", photoPath = "", username = "") {
		const result = profileQueries.insert.run(
			firstName,
			lastName,
			bio,
			photoPath,
			username,
		);
		return result.lastInsertRowid;
	},

	getAll() {
		return profileQueries.getAll.all();
	},

	getRandom() {
		return profileQueries.getUnused.get();
	},

	getById(id) {
		return profileQueries.getById.get(id);
	},

	markAsUsed(id) {
		profileQueries.markUsed.run(id);
	},

	delete(id) {
		profileQueries.delete.run(id);
	},

	deleteAll() {
		profileQueries.deleteAll.run();
	},

	count() {
		return profileQueries.count.get().count;
	},

	countUnused() {
		return profileQueries.countUnused.get().count;
	},
};

// ==================== ORDERS ====================

const orderQueries = {
	insert: db.prepare(`
        INSERT INTO orders (type, target, count, status, started_at)
        VALUES (?, ?, ?, 'running', CURRENT_TIMESTAMP)
    `),
	getAll: db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 100"),
	getById: db.prepare("SELECT * FROM orders WHERE id = ?"),
	getRunning: db.prepare("SELECT * FROM orders WHERE status = 'running'"),
	getPending: db.prepare("SELECT * FROM orders WHERE status = 'pending'"),
	updateProgress: db.prepare("UPDATE orders SET completed = ? WHERE id = ?"),
	updateStatus: db.prepare(
		"UPDATE orders SET status = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
	),
	setError: db.prepare(
		"UPDATE orders SET status = ?, error_message = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
	),
	delete: db.prepare("DELETE FROM orders WHERE id = ?"),
	stats: db.prepare(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM orders
    `),
};

export const orders = {
	create(type, target, count) {
		const result = orderQueries.insert.run(type, target, count);
		return result.lastInsertRowid;
	},

	getAll() {
		return orderQueries.getAll.all();
	},

	getById(id) {
		return orderQueries.getById.get(id);
	},

	getRunning() {
		return orderQueries.getRunning.all();
	},

	getPending() {
		return orderQueries.getPending.all();
	},

	updateProgress(id, completed) {
		orderQueries.updateProgress.run(completed, id);
	},

	complete(id) {
		orderQueries.updateStatus.run("completed", id);
	},

	fail(id, errorMessage) {
		orderQueries.setError.run("failed", errorMessage, id);
	},

	cancel(id) {
		orderQueries.updateStatus.run("cancelled", id);
	},

	delete(id) {
		orderQueries.delete.run(id);
	},

	getStats() {
		return orderQueries.stats.get();
	},
};

// ==================== PROXIES ====================

const proxyQueries = {
	insert: db.prepare(`
        INSERT INTO proxies (type, host, port, username, password)
        VALUES (?, ?, ?, ?, ?)
    `),
	getAll: db.prepare("SELECT * FROM proxies ORDER BY id"),
	getActive: db.prepare("SELECT * FROM proxies WHERE is_active = 1"),
	getById: db.prepare("SELECT * FROM proxies WHERE id = ?"),
	getRandom: db.prepare(
		"SELECT * FROM proxies WHERE is_active = 1 ORDER BY RANDOM() LIMIT 1",
	),
	toggle: db.prepare("UPDATE proxies SET is_active = ? WHERE id = ?"),
	updateLastUsed: db.prepare(
		"UPDATE proxies SET last_used = CURRENT_TIMESTAMP WHERE id = ?",
	),
	delete: db.prepare("DELETE FROM proxies WHERE id = ?"),
	deleteAll: db.prepare("DELETE FROM proxies"),
	count: db.prepare(
		"SELECT COUNT(*) as count FROM proxies WHERE is_active = 1",
	),
};

export const proxies = {
	add(type, host, port, username = "", password = "") {
		const result = proxyQueries.insert.run(
			type,
			host,
			port,
			username,
			password,
		);
		return result.lastInsertRowid;
	},

	getAll() {
		return proxyQueries.getAll.all();
	},

	getActive() {
		return proxyQueries.getActive.all();
	},

	getById(id) {
		return proxyQueries.getById.get(id);
	},

	getRandom() {
		const proxy = proxyQueries.getRandom.get();
		if (proxy) {
			proxyQueries.updateLastUsed.run(proxy.id);
		}
		return proxy;
	},

	toggle(id, isActive) {
		proxyQueries.toggle.run(isActive ? 1 : 0, id);
	},

	delete(id) {
		proxyQueries.delete.run(id);
	},

	deleteAll() {
		proxyQueries.deleteAll.run();
	},

	count() {
		return proxyQueries.count.get().count;
	},
};

// ==================== ACCOUNT STATUS ====================

const accountStatusQueries = {
	upsert: db.prepare(`
        INSERT INTO account_status (phone, is_reported, is_resting, rest_until, proxy_id, folder)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(phone) DO UPDATE SET
            is_reported = excluded.is_reported,
            is_resting = excluded.is_resting,
            rest_until = excluded.rest_until,
            proxy_id = excluded.proxy_id,
            folder = excluded.folder,
            updated_at = CURRENT_TIMESTAMP
    `),
	getByPhone: db.prepare("SELECT * FROM account_status WHERE phone = ?"),
	getAll: db.prepare("SELECT * FROM account_status"),
	getReported: db.prepare("SELECT * FROM account_status WHERE is_reported = 1"),
	getResting: db.prepare("SELECT * FROM account_status WHERE is_resting = 1"),
	getHealthy: db.prepare(
		"SELECT * FROM account_status WHERE is_reported = 0 AND is_resting = 0",
	),
	setReported: db.prepare(
		"UPDATE account_status SET is_reported = 1, report_count = report_count + 1, updated_at = CURRENT_TIMESTAMP WHERE phone = ?",
	),
	setResting: db.prepare(
		"UPDATE account_status SET is_resting = 1, rest_until = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?",
	),
	clearRest: db.prepare(
		"UPDATE account_status SET is_resting = 0, rest_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE phone = ?",
	),
	clearAllRest: db.prepare(
		"UPDATE account_status SET is_resting = 0, rest_until = NULL, updated_at = CURRENT_TIMESTAMP",
	),
	delete: db.prepare("DELETE FROM account_status WHERE phone = ?"),
	stats: db.prepare(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN is_reported = 1 THEN 1 ELSE 0 END) as reported,
            SUM(CASE WHEN is_resting = 1 THEN 1 ELSE 0 END) as resting,
            SUM(CASE WHEN is_reported = 0 AND is_resting = 0 THEN 1 ELSE 0 END) as healthy
        FROM account_status
    `),
};

export const accountStatus = {
	set(
		phone,
		{
			isReported = 0,
			isResting = 0,
			restUntil = null,
			proxyId = null,
			folder = "default",
		} = {},
	) {
		accountStatusQueries.upsert.run(
			phone,
			isReported,
			isResting,
			restUntil,
			proxyId,
			folder,
		);
	},

	get(phone) {
		return accountStatusQueries.getByPhone.get(phone);
	},

	getAll() {
		return accountStatusQueries.getAll.all();
	},

	getReported() {
		return accountStatusQueries.getReported.all();
	},

	getResting() {
		return accountStatusQueries.getResting.all();
	},

	getHealthy() {
		return accountStatusQueries.getHealthy.all();
	},

	markReported(phone) {
		accountStatusQueries.setReported.run(phone);
	},

	markResting(phone, restUntilMinutes = 60) {
		const restUntil = new Date(
			Date.now() + restUntilMinutes * 60 * 1000,
		).toISOString();
		accountStatusQueries.setResting.run(restUntil, phone);
	},

	clearRest(phone) {
		accountStatusQueries.clearRest.run(phone);
	},

	clearAllRest() {
		accountStatusQueries.clearAllRest.run();
	},

	delete(phone) {
		accountStatusQueries.delete.run(phone);
	},

	getStats() {
		return accountStatusQueries.stats.get();
	},
};

// ==================== RECEIVER ACCOUNTS ====================

const receiverQueries = {
	insert: db.prepare(`
        INSERT INTO receiver_accounts (phone, session_string, donated_by)
        VALUES (?, ?, ?)
    `),
	getAll: db.prepare(
		"SELECT * FROM receiver_accounts ORDER BY donated_at DESC",
	),
	getPending: db.prepare(
		"SELECT * FROM receiver_accounts WHERE is_approved = 0",
	),
	getApproved: db.prepare(
		"SELECT * FROM receiver_accounts WHERE is_approved = 1",
	),
	approve: db.prepare(
		"UPDATE receiver_accounts SET is_approved = 1, approved_at = CURRENT_TIMESTAMP WHERE id = ?",
	),
	delete: db.prepare("DELETE FROM receiver_accounts WHERE id = ?"),
	getByPhone: db.prepare("SELECT * FROM receiver_accounts WHERE phone = ?"),
};

export const receiver = {
	add(phone, sessionString, donatedBy) {
		try {
			const result = receiverQueries.insert.run(
				phone,
				sessionString,
				donatedBy,
			);
			return { success: true, id: result.lastInsertRowid };
		} catch (error) {
			if (error.message.includes("UNIQUE constraint")) {
				return { success: false, error: "این شماره قبلاً ثبت شده است" };
			}
			return { success: false, error: error.message };
		}
	},

	getAll() {
		return receiverQueries.getAll.all();
	},

	getPending() {
		return receiverQueries.getPending.all();
	},

	getApproved() {
		return receiverQueries.getApproved.all();
	},

	approve(id) {
		receiverQueries.approve.run(id);
	},

	delete(id) {
		receiverQueries.delete.run(id);
	},

	getByPhone(phone) {
		return receiverQueries.getByPhone.get(phone);
	},
};

// ==================== MAIN ACCOUNTS ====================

const accountQueries = {
	upsert: db.prepare(`
        INSERT INTO accounts (phone, user_id, username, first_name, last_name, session_string, is_active, status, role, proxy_config, stats_json, added_at, last_connected, updated_at)
        VALUES (@phone, @user_id, @username, @first_name, @last_name, @session_string, @is_active, @status, @role, @proxy_config, @stats_json, @added_at, @last_connected, CURRENT_TIMESTAMP)
        ON CONFLICT(phone) DO UPDATE SET
            user_id = excluded.user_id,
            username = excluded.username,
            first_name = excluded.first_name,
            last_name = excluded.last_name,
            session_string = excluded.session_string,
            is_active = excluded.is_active,
            status = excluded.status,
            role = excluded.role,
            proxy_config = excluded.proxy_config,
            stats_json = excluded.stats_json,
            last_connected = excluded.last_connected,
            updated_at = CURRENT_TIMESTAMP
    `),
	getAll: db.prepare("SELECT * FROM accounts"),
	getByPhone: db.prepare("SELECT * FROM accounts WHERE phone = ?"),
	delete: db.prepare("DELETE FROM accounts WHERE phone = ?"),
	count: db.prepare("SELECT COUNT(*) as count FROM accounts"),
	updateStatus: db.prepare(
		"UPDATE accounts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?",
	),
	updateActivity: db.prepare(
		"UPDATE accounts SET last_connected = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?",
	),
};

export const accounts = {
	save(account) {
		// Prepare object for DB (flatten JSONs)
		const dbObj = {
			phone: account.phone,
			user_id: account.id || account.user_id,
			username: account.username,
			first_name: account.firstName || account.first_name,
			last_name: account.lastName || account.last_name,
			session_string: account.session || account.session_string,
			is_active: account.isActive ? 1 : 0,
			status: account.status,
			role: account.role,
			proxy_config: account.proxy ? JSON.stringify(account.proxy) : null,
			stats_json: account.stats
				? JSON.stringify(account.stats)
				: JSON.stringify({}),
			added_at: account.addedAt || account.added_at,
			last_connected: account.lastConnected || account.last_connected,
		};
		accountQueries.upsert.run(dbObj);
	},

	getAll() {
		return accountQueries.getAll.all().map((row) => ({
			...row,
			firstName: row.first_name,
			lastName: row.last_name,
			session: row.session_string,
			isActive: Boolean(row.is_active),
			proxy: row.proxy_config ? JSON.parse(row.proxy_config) : null,
			stats: row.stats_json ? JSON.parse(row.stats_json) : {},
			addedAt: row.added_at,
			lastConnected: row.last_connected,
		}));
	},

	getByPhone(phone) {
		const row = accountQueries.getByPhone.get(phone);
		if (!row) return null;
		return {
			...row,
			firstName: row.first_name,
			lastName: row.last_name,
			session: row.session_string,
			isActive: Boolean(row.is_active),
			proxy: row.proxy_config ? JSON.parse(row.proxy_config) : null,
			stats: row.stats_json ? JSON.parse(row.stats_json) : {},
			addedAt: row.added_at,
			lastConnected: row.last_connected,
		};
	},

	delete(phone) {
		accountQueries.delete.run(phone);
	},

	count() {
		return accountQueries.count.get().count;
	},
};

// ==================== SETTINGS ====================

const settingsQueries = {
	get: db.prepare("SELECT value FROM settings WHERE key = ?"),
	set: db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `),
	getAll: db.prepare("SELECT * FROM settings"),
	delete: db.prepare("DELETE FROM settings WHERE key = ?"),
};

export const settings = {
	get(key, defaultValue = null) {
		const row = settingsQueries.get.get(key);
		if (!row) return defaultValue;
		try {
			return JSON.parse(row.value);
		} catch {
			return row.value;
		}
	},

	set(key, value) {
		const stringValue =
			typeof value === "string" ? value : JSON.stringify(value);
		settingsQueries.set.run(key, stringValue);
	},

	getAll() {
		return settingsQueries.getAll.all().reduce((acc, row) => {
			try {
				acc[row.key] = JSON.parse(row.value);
			} catch {
				acc[row.key] = row.value;
			}
			return acc;
		}, {});
	},

	delete(key) {
		settingsQueries.delete.run(key);
	},
};

// ==================== UTILITIES ====================

export function closeDatabase() {
	db.close();
}

export function backupDatabase(backupPath) {
	return db.backup(backupPath);
}

export const transaction = (fn) => {
	const trx = db.transaction(fn);
	return trx; // Returns the wrapper function
};

export default {
	profiles,
	orders,
	proxies,
	accountStatus,
	receiver,
	accounts,
	settings,
	transaction, // Export transaction helper
	closeDatabase,
	backupDatabase,
};
