import "dotenv/config";
import { CONFIG } from "../../core/Config/app.config.js";
import { initUserService } from "../../Modules/User/Application/user.service.js";
import { connectDB as connectFirestore } from "../../Shared/Infra/Database/firestore.repository.js";
import { connectDB as connectMongo } from "../../Shared/Infra/Database/mongo.repository.js";

/**
 * Configure global process handlers to prevent silent crashes
 */
export function setupProcessHandlers() {
	process.on("uncaughtException", (err) => {
		console.error("💥 [Critical] Uncaught Exception:", err.stack || err);
	});

	process.on("unhandledRejection", (reason, promise) => {
		console.error(
			"💥 [Critical] Unhandled Rejection at:",
			promise,
			"reason:",
			reason.stack || reason,
		);
	});

	process.on("exit", (code) => {
		console.log(`ℹ️ [Process] Exiting with code: ${code}`);
	});
}

/**
 * Helper: Check if user is admin based on config and env
 */
export function isAdmin(userId) {
	if (!userId) return false;
	const configAdmin = CONFIG.ADMIN_ID;
	const envAdmin = process.env.ADMIN_USER_ID;
	return (
		(configAdmin && String(userId) === String(configAdmin)) ||
		(envAdmin && String(userId) === String(envAdmin))
	);
}

/**
 * Initialize all core services (DB, User Service, etc.)
 */
export async function bootstrapServices() {
	try {
		console.log("🚀 Bootstrapping core services...");
		
		// 1. Connect MongoDB (Primary Panel DB)
		const mongo = await connectMongo();
		if (mongo) console.log("✅ MongoDB Service: Connected");
		else console.warn("⚠️ MongoDB Service: Falling back to Memory (Not recommended for persistence)");

		// 2. Connect Firestore (Secondary Analytics DB)
		const firestore = await connectFirestore();
		if (firestore) console.log("✅ Firestore Service: Connected");
		else console.warn("ℹ️ Firestore Service: Safe Mode/Disabled");

		// 3. Init Services
		await initUserService();
		
		console.log("✅ Core bootstrap finalized");
		return true;
	} catch (error) {
		console.error("❌ Bootstrap failed critical error:", error.message);
		throw error;
	}
}

/**
 * Graceful shutdown orchestration
 */
export function setupShutdownHandlers(bot) {
	const shutdown = async (signal) => {
		console.log(`🛑 Received ${signal}. Shutting down gracefully...`);
		try {
			bot.stop(signal);
			console.log("👋 Bot stopped");
			process.exit(0);
		} catch (e) {
			console.error("Error during shutdown:", e.message);
			process.exit(1);
		}
	};

	process.once("SIGINT", () => shutdown("SIGINT"));
	process.once("SIGTERM", () => shutdown("SIGTERM"));
}
