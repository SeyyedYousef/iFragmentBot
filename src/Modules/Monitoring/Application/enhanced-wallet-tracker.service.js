/**
 * Enhanced Wallet Tracker v3.0 (TonAPI Edition)
 * Uses TonAPI public endpoints (FREE, no key required)
 *
 * Features:
 * - Liquid TON Balance
 * - NFT Portfolio (Usernames & Numbers)
 * - Whale Classification
 * - Portfolio Valuation
 */

import fetch from "node-fetch";

// TonAPI Base URL (works without API key, rate-limited)
const TONAPI_BASE = "https://tonapi.io/v2";

// Known Fragment collections
const COLLECTIONS = {
	USERNAMES: "EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi",
	NUMBERS: "EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N",
};

// Floor prices for valuation (can be updated)
const FLOOR_PRICES = {
	username: 15,
	number: 8,
};

// ==================== MAIN EXPORT ====================

export async function analyzeWallet(walletAddress) {
	console.log(`🔍 Analyzing wallet via TonAPI: ${walletAddress}`);

	try {
		// 1. Get Account Info (Balance)
		const accountInfo = await getAccountInfo(walletAddress);
		const balance = accountInfo.balance / 1e9;

		// 2. Get All NFTs owned by this wallet
		const nfts = await getWalletNfts(walletAddress);

		// 3. Calculate stats
		const analysis = calculateStats(nfts, balance);

		// 4. Format report
		const report = formatReport(walletAddress, balance, analysis, nfts);

		return {
			success: true,
			address: walletAddress,
			balance,
			nfts,
			analysis,
			report,
		};
	} catch (error) {
		console.error("❌ Wallet Analysis Error:", error.message);
		return {
			success: false,
			error: error.message,
		};
	}
}

// ==================== TONAPI CALLS ====================

async function getAccountInfo(address) {
	try {
		const url = `${TONAPI_BASE}/accounts/${address}`;
		const resp = await fetch(url, {
			headers: { Accept: "application/json" },
			timeout: 15000,
		});

		if (!resp.ok) {
			throw new Error(`TonAPI account error: ${resp.status}`);
		}

		const data = await resp.json();
		return {
			balance: parseInt(data.balance, 10) || 0,
			status: data.status,
			name: data.name || null,
		};
	} catch (e) {
		console.error("Account fetch failed:", e.message);
		return { balance: 0, status: "unknown" };
	}
}

async function getWalletNfts(address) {
	const nfts = [];

	try {
		// TonAPI: Get all NFTs for account
		const url = `${TONAPI_BASE}/accounts/${address}/nfts?limit=100&indirect_ownership=false`;
		const resp = await fetch(url, {
			headers: { Accept: "application/json" },
			timeout: 20000,
		});

		if (!resp.ok) {
			console.warn(`TonAPI NFT fetch failed: ${resp.status}`);
			return nfts;
		}

		const data = await resp.json();
		const items = data.nft_items || [];

		for (const item of items) {
			const collectionAddr = item.collection?.address || "";
			const type = identifyType(collectionAddr);

			if (type !== "unknown") {
				nfts.push({
					name: item.metadata?.name || item.dns || "Unknown",
					type: type,
					address: item.address,
					image: item.previews?.[0]?.url || item.metadata?.image || null,
					collection: item.collection?.name || "",
				});
			}
		}

		console.log(`   Found ${nfts.length} Fragment NFTs`);
	} catch (e) {
		console.error("NFT fetch error:", e.message);
	}

	return nfts;
}

// ==================== HELPERS ====================

function identifyType(collectionAddress) {
	if (!collectionAddress) return "unknown";

	// Check if it's Username collection
	if (
		collectionAddress.includes("EQCA14o1") ||
		collectionAddress === COLLECTIONS.USERNAMES ||
		collectionAddress.toLowerCase().includes("username")
	) {
		return "username";
	}

	// Check if it's Number collection
	if (
		collectionAddress.includes("EQAOQdwd") ||
		collectionAddress === COLLECTIONS.NUMBERS ||
		collectionAddress.toLowerCase().includes("anonymous") ||
		collectionAddress.toLowerCase().includes("number")
	) {
		return "number";
	}

	return "unknown";
}

function calculateStats(nfts, balance) {
	let usernameCount = 0;
	let numberCount = 0;
	let giftCount = 0;

	const usernames = [];
	const numbers = [];
	const gifts = [];

	for (const nft of nfts) {
		if (nft.type === "username") {
			usernameCount++;
			usernames.push(nft.name);
		} else if (nft.type === "number") {
			numberCount++;
			numbers.push(nft.name);
		} else {
			// It's a gift or other NFT
			giftCount++;
			gifts.push(nft.name);
		}
	}

	const usernameValue = usernameCount * FLOOR_PRICES.username;
	const numberValue = numberCount * FLOOR_PRICES.number;
	const giftValue = giftCount * 5; // Approx 5 TON per gift on average

	const totalNftValue = usernameValue + numberValue + giftValue;
	const netWorth = balance + totalNftValue;

	// Whale classification
	let tag = "🦐 Shrimp";
	if (netWorth > 100000) tag = "🐋 MEGA WHALE";
	else if (netWorth > 50000) tag = "🐋 Whale";
	else if (netWorth > 10000) tag = "🦈 Shark";
	else if (netWorth > 1000) tag = "🐬 Dolphin";
	else if (netWorth > 100) tag = "🦀 Crab";
	else if (netWorth > 10) tag = "🐟 Fish";

	return {
		usernameCount,
		numberCount,
		giftCount,
		usernameValue,
		numberValue,
		giftValue,
		totalNftValue,
		netWorth,
		tag,
		usernames: usernames.slice(0, 10),
		numbers: numbers.slice(0, 10),
		gifts: gifts.slice(0, 10),
	};
}

function formatReport(address, balance, stats, _nfts) {
	const fmt = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
	const shortAddr = `${address.substring(0, 8)}...${address.slice(-6)}`;

	let report = `
🏦 *Wallet Analysis*
\`${shortAddr}\`

${stats.tag}
💰 *Net Worth:* ≈${fmt(stats.netWorth)} TON

━━━━━━━━━━━━━━━━━━
💎 *Liquid Balance:* ${fmt(balance)} TON

📂 *NFT Portfolio:*
• Usernames: ${stats.usernameCount} (≈${fmt(stats.usernameValue)} TON)
• Numbers: ${stats.numberCount} (≈${fmt(stats.numberValue)} TON)
• *Total NFT Value:* ≈${fmt(stats.totalNftValue)} TON
`;

	if (stats.usernames.length > 0) {
		report += `\n👤 *Top Usernames:*\n`;
		stats.usernames.forEach((name) => {
			report += `• ${name}\n`;
		});
	}

	if (stats.numbers.length > 0) {
		report += `\n📞 *Top Numbers:*\n`;
		stats.numbers.forEach((name) => {
			report += `• ${name}\n`;
		});
	}

	report += `
━━━━━━━━━━━━━━━━━━
_Powered by TonAPI_
📢 @FragmentsCommunity`;

	return report;
}

// ==================== CONFIG ====================

export function updateFloorPrices(usernameFloor, numberFloor) {
	if (usernameFloor) FLOOR_PRICES.username = usernameFloor;
	if (numberFloor) FLOOR_PRICES.number = numberFloor;
	console.log(
		`✅ Floor prices updated: Username=${FLOOR_PRICES.username}, Number=${FLOOR_PRICES.number}`,
	);
}
