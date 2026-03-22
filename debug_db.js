
import 'dotenv/config';
import { connectDB, getDB } from './src/Shared/Infra/Database/mongo.repository.js';

async function debugSettings() {
    await connectDB();
    const db = getDB();
    if (!db) {
        console.error("❌ DB NOT CONNECTED");
        process.exit(1);
    }
    const col = db.collection("settings");
    const doc = await col.findOne({ _id: "dashboard_config" });
    console.log("DASHBOARD_CONFIG:", JSON.stringify(doc, null, 2));
    process.exit(0);
}

debugSettings();
