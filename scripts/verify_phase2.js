import { accounts, transaction } from "../src/database/panelDatabase.js";

async function verify() {
	console.log("🔍 Starting Phase 2 Verification...");

	// 1. Test Transaction Wrapper
	console.log("🧪 Testing Transaction Wrapper...");
	try {
		transaction(() => {
			// Perform dummy write
			accounts.save({
				phone: "+999999999",
				session: "test_session",
				isActive: false, // Don't try to connect
			});
			throw new Error("Force Rollback");
		})();
	} catch (_e) {
		console.log("   ✅ Transaction rolled back correctly on error");
	}

	// Verify it was NOT saved
	const check = accounts.getByPhone("+999999999");
	if (check) {
		console.error("❌ Transaction FAILED to rollback! Dummy account found.");
		process.exit(1);
	} else {
		console.log("   ✅ Dummy account not found (Rollback successful)");
	}

	// 2. Test Success Transaction
	try {
		console.log("🧪 Testing Successful Transaction...");
		transaction(() => {
			accounts.save({
				phone: "+888888888",
				session: "test_session_ok",
				isActive: false,
			});
		})();

		const checkOk = accounts.getByPhone("+888888888");
		if (checkOk) {
			console.log("   ✅ Transaction committed successfully");
			// Cleanup
			accounts.delete("+888888888");
		} else {
			console.error("❌ Transaction FAILED to commit!");
			process.exit(1);
		}
	} catch (e) {
		console.error("❌ Transaction threw unexpected error:", e);
		process.exit(1);
	}

	console.log("✅ Phase 2 Verification Completed.");
	process.exit(0);
}

verify().catch((e) => {
	console.error(e);
	process.exit(1);
});
