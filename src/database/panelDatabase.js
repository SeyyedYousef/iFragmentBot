import { ObjectId } from "mongodb";
import { getDB } from "../Shared/Infra/Database/mongo.repository.js";

// Helper to get db connection
const getCol = (name) => {
    const db = getDB();
    if (!db) throw new Error("Database not connected. Ensure connectDB() is called.");
    return db.collection(name);
};

// Helper to map MongoDB _id to id string format to maintain compatibility with existing code
const mapId = (doc) => {
    if (!doc) return null;
    doc.id = doc._id.toString();
    return doc;
};

// ==================== PROFILES ====================
export const profiles = {
    async add(firstName, lastName = "", bio = "", photoPath = "", username = "") {
        const result = await getCol("panel_profiles").insertOne({
            first_name: firstName,
            last_name: lastName,
            bio,
            photo_path: photoPath,
            username,
            is_used: 0,
            created_at: new Date()
        });
        return result.insertedId.toString();
    },
    async getAll() {
        const docs = await getCol("panel_profiles").find().sort({ _id: -1 }).toArray();
        return docs.map(mapId);
    },
    async getRandom() {
        const docs = await getCol("panel_profiles").aggregate([
            { $match: { is_used: 0 } },
            { $sample: { size: 1 } }
        ]).toArray();
        return docs.length > 0 ? mapId(docs[0]) : null;
    },
    async getById(id) {
        if (!ObjectId.isValid(id)) return null;
        return mapId(await getCol("panel_profiles").findOne({ _id: new ObjectId(id) }));
    },
    async markAsUsed(id) {
        if (!ObjectId.isValid(id)) return;
        await getCol("panel_profiles").updateOne({ _id: new ObjectId(id) }, { $set: { is_used: 1 } });
    },
    async delete(id) {
        if (!ObjectId.isValid(id)) return;
        await getCol("panel_profiles").deleteOne({ _id: new ObjectId(id) });
    },
    async deleteAll() {
        await getCol("panel_profiles").deleteMany({});
    },
    async count() {
        return await getCol("panel_profiles").countDocuments();
    },
    async countUnused() {
        return await getCol("panel_profiles").countDocuments({ is_used: 0 });
    }
};

// ==================== ORDERS ====================
export const orders = {
    async create(type, target, count) {
        const result = await getCol("panel_orders").insertOne({
            type,
            target,
            count,
            completed: 0,
            status: "running",
            started_at: new Date(),
            created_at: new Date()
        });
        return result.insertedId.toString();
    },
    async getAll() {
        const docs = await getCol("panel_orders").find().sort({ _id: -1 }).limit(100).toArray();
        return docs.map(mapId);
    },
    async getById(id) {
        if (!ObjectId.isValid(id)) return null;
        return mapId(await getCol("panel_orders").findOne({ _id: new ObjectId(id) }));
    },
    async getRunning() {
        const docs = await getCol("panel_orders").find({ status: "running" }).toArray();
        return docs.map(mapId);
    },
    async getPending() {
        const docs = await getCol("panel_orders").find({ status: "pending" }).toArray();
        return docs.map(mapId);
    },
    async updateProgress(id, completed) {
        if (!ObjectId.isValid(id)) return;
        await getCol("panel_orders").updateOne({ _id: new ObjectId(id) }, { $set: { completed } });
    },
    async complete(id) {
        if (!ObjectId.isValid(id)) return;
        await getCol("panel_orders").updateOne({ _id: new ObjectId(id) }, { $set: { status: "completed", finished_at: new Date() } });
    },
    async fail(id, errorMessage) {
        if (!ObjectId.isValid(id)) return;
        await getCol("panel_orders").updateOne({ _id: new ObjectId(id) }, { $set: { status: "failed", error_message: errorMessage, finished_at: new Date() } });
    },
    async cancel(id) {
        if (!ObjectId.isValid(id)) return;
        await getCol("panel_orders").updateOne({ _id: new ObjectId(id) }, { $set: { status: "cancelled", finished_at: new Date() } });
    },
    async delete(id) {
        if (!ObjectId.isValid(id)) return;
        await getCol("panel_orders").deleteOne({ _id: new ObjectId(id) });
    },
    async getStats() {
        const stats = await getCol("panel_orders").aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                    running: { $sum: { $cond: [{ $eq: ["$status", "running"] }, 1, 0] } },
                    failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } }
                }
            }
        ]).toArray();
        if (stats.length === 0) return { total: 0, completed: 0, running: 0, failed: 0 };
        return { total: stats[0].total, completed: stats[0].completed, running: stats[0].running, failed: stats[0].failed };
    }
};

// ==================== PROXIES ====================
export const proxies = {
    async add(type, host, port, username = "", password = "") {
        const result = await getCol("panel_proxies").insertOne({
            type, host, port, username, password, is_active: 1, created_at: new Date()
        });
        return result.insertedId.toString();
    },
    async getAll() {
        const docs = await getCol("panel_proxies").find().sort({ _id: 1 }).toArray();
        return docs.map(mapId);
    },
    async getActive() {
        const docs = await getCol("panel_proxies").find({ is_active: 1 }).toArray();
        return docs.map(mapId);
    },
    async getById(id) {
        if (!ObjectId.isValid(id)) return null;
        return mapId(await getCol("panel_proxies").findOne({ _id: new ObjectId(id) }));
    },
    async getRandom() {
        const docs = await getCol("panel_proxies").aggregate([
            { $match: { is_active: 1 } },
            { $sample: { size: 1 } }
        ]).toArray();
        if (docs.length > 0) {
            await getCol("panel_proxies").updateOne({ _id: docs[0]._id }, { $set: { last_used: new Date() } });
            return mapId(docs[0]);
        }
        return null;
    },
    async toggle(id, isActive) {
        if (!ObjectId.isValid(id)) return;
        await getCol("panel_proxies").updateOne({ _id: new ObjectId(id) }, { $set: { is_active: isActive ? 1 : 0 } });
    },
    async delete(id) {
        if (!ObjectId.isValid(id)) return;
        await getCol("panel_proxies").deleteOne({ _id: new ObjectId(id) });
    },
    async deleteAll() {
        await getCol("panel_proxies").deleteMany({});
    },
    async count() {
        return await getCol("panel_proxies").countDocuments({ is_active: 1 });
    }
};

// ==================== ACCOUNT STATUS ====================
export const accountStatus = {
    async set(phone, { isReported = 0, isResting = 0, restUntil = null, proxyId = null, folder = "default" } = {}) {
        await getCol("panel_account_status").updateOne(
            { phone },
            {
                $set: {
                    phone, is_reported: isReported, is_resting: isResting, rest_until: restUntil, proxy_id: proxyId, folder, updated_at: new Date()
                },
                $setOnInsert: { created_at: new Date() }
            },
            { upsert: true }
        );
    },
    async get(phone) {
        return await getCol("panel_account_status").findOne({ phone });
    },
    async getAll() {
        return await getCol("panel_account_status").find().toArray();
    },
    async getReported() {
        return await getCol("panel_account_status").find({ is_reported: 1 }).toArray();
    },
    async getResting() {
        return await getCol("panel_account_status").find({ is_resting: 1 }).toArray();
    },
    async getHealthy() {
        return await getCol("panel_account_status").find({ is_reported: 0, is_resting: 0 }).toArray();
    },
    async markReported(phone) {
        await getCol("panel_account_status").updateOne(
            { phone },
            { $set: { is_reported: 1, updated_at: new Date() }, $inc: { report_count: 1 } },
            { upsert: true }
        );
    },
    async markResting(phone, restUntilMinutes = 60) {
        const restUntil = new Date(Date.now() + restUntilMinutes * 60 * 1000).toISOString();
        await getCol("panel_account_status").updateOne(
            { phone },
            { $set: { is_resting: 1, rest_until: restUntil, updated_at: new Date() } },
            { upsert: true }
        );
    },
    async clearRest(phone) {
        await getCol("panel_account_status").updateOne({ phone }, { $set: { is_resting: 0, rest_until: null, updated_at: new Date() } });
    },
    async clearAllRest() {
        await getCol("panel_account_status").updateMany({}, { $set: { is_resting: 0, rest_until: null, updated_at: new Date() } });
    },
    async delete(phone) {
        await getCol("panel_account_status").deleteOne({ phone });
    },
    async getStats() {
        const stats = await getCol("panel_account_status").aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    reported: { $sum: { $cond: [{ $eq: ["$is_reported", 1] }, 1, 0] } },
                    resting: { $sum: { $cond: [{ $eq: ["$is_resting", 1] }, 1, 0] } },
                    healthy: { $sum: { $cond: [{ $and: [{ $eq: ["$is_reported", 0] }, { $eq: ["$is_resting", 0] }] }, 1, 0] } }
                }
            }
        ]).toArray();
        if (stats.length === 0) return { total: 0, reported: 0, resting: 0, healthy: 0 };
        return { total: stats[0].total, reported: stats[0].reported, resting: stats[0].resting, healthy: stats[0].healthy };
    }
};

// ==================== RECEIVER ACCOUNTS ====================
export const receiver = {
    async add(phone, sessionString, donatedBy) {
        try {
            const exists = await getCol("panel_receiver_accounts").findOne({ phone });
            if (exists) return { success: false, error: "این شماره قبلاً ثبت شده است" };
            
            const result = await getCol("panel_receiver_accounts").insertOne({
                phone, session_string: sessionString, donated_by: donatedBy, donated_at: new Date(), is_approved: 0
            });
            return { success: true, id: result.insertedId.toString() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    async getAll() {
        const docs = await getCol("panel_receiver_accounts").find().sort({ donated_at: -1 }).toArray();
        return docs.map(mapId);
    },
    async getPending() {
        const docs = await getCol("panel_receiver_accounts").find({ is_approved: 0 }).toArray();
        return docs.map(mapId);
    },
    async getApproved() {
        const docs = await getCol("panel_receiver_accounts").find({ is_approved: 1 }).toArray();
        return docs.map(mapId);
    },
    async approve(id) {
        if (!ObjectId.isValid(id)) return;
        await getCol("panel_receiver_accounts").updateOne({ _id: new ObjectId(id) }, { $set: { is_approved: 1, approved_at: new Date() } });
    },
    async delete(id) {
        if (!ObjectId.isValid(id)) return;
        await getCol("panel_receiver_accounts").deleteOne({ _id: new ObjectId(id) });
    },
    async getByPhone(phone) {
        return mapId(await getCol("panel_receiver_accounts").findOne({ phone }));
    }
};

// ==================== MAIN ACCOUNTS ====================
export const accounts = {
    async save(account) {
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
            stats_json: account.stats ? JSON.stringify(account.stats) : JSON.stringify({}),
            added_at: account.addedAt || account.added_at,
            last_connected: account.lastConnected || account.last_connected,
            updated_at: new Date()
        };
        await getCol("panel_accounts").updateOne(
            { phone: dbObj.phone },
            { $set: dbObj },
            { upsert: true }
        );
    },
    async getAll() {
        const rows = await getCol("panel_accounts").find().toArray();
        return rows.map(row => ({
            ...row,
            firstName: row.first_name,
            lastName: row.last_name,
            session: row.session_string,
            isActive: Boolean(row.is_active),
            proxy: row.proxy_config ? JSON.parse(row.proxy_config) : null,
            stats: row.stats_json ? JSON.parse(row.stats_json) : {},
            addedAt: row.added_at,
            lastConnected: row.last_connected
        }));
    },
    async getByPhone(phone) {
        const row = await getCol("panel_accounts").findOne({ phone });
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
            lastConnected: row.last_connected
        };
    },
    async delete(phone) {
        await getCol("panel_accounts").deleteOne({ phone });
    },
    async count() {
        return await getCol("panel_accounts").countDocuments();
    }
};

// ==================== SETTINGS ====================
export const settings = {
    async get(key, defaultValue = null) {
        const row = await getCol("panel_settings").findOne({ key });
        if (!row) return defaultValue;
        try {
            return JSON.parse(row.value);
        } catch {
            return row.value;
        }
    },
    async set(key, value) {
        const stringValue = typeof value === "string" ? value : JSON.stringify(value);
        await getCol("panel_settings").updateOne(
            { key },
            { $set: { key, value: stringValue, updated_at: new Date() } },
            { upsert: true }
        );
    },
    async getAll() {
        const rows = await getCol("panel_settings").find().toArray();
        return rows.reduce((acc, row) => {
            try { acc[row.key] = JSON.parse(row.value); } catch { acc[row.key] = row.value; }
            return acc;
        }, {});
    },
    async delete(key) {
        await getCol("panel_settings").deleteOne({ key });
    }
};

// ==================== UTILITIES ====================
export async function closeDatabase() {
    // Mongo close is handled globally in mongo.repository.js
}

export async function backupDatabase(backupPath) {
    // Not applicable directly
    return true;
}

export const transaction = async (fn) => {
    // Transactions exist but require a replica set in MongoDB. We'll simulate by just executing.
    return await fn();
};

export default {
    profiles,
    orders,
    proxies,
    accountStatus,
    receiver,
    accounts,
    settings,
    transaction,
    closeDatabase,
    backupDatabase
};
