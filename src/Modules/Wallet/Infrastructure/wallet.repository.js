/**
 * Wallet Intelligence Repository — HTTP-only, Render-safe
 * Cross-references TON wallets with Fragment assets (usernames, numbers, gifts)
 */
import fetch from "node-fetch";

const TONAPI_BASE = "https://tonapi.io/v2";
const FRAGMENT_HEADERS = {
	"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
	Accept: "application/json",
};

/**
 * Get wallet balance and basic info from TON API
 * @param {string} address - TON wallet address (EQ... or UQ...)
 */
export async function getWalletInfo(address) {
	try {
		const res = await fetch(`${TONAPI_BASE}/accounts/${address}`, {
			headers: FRAGMENT_HEADERS,
			timeout: 10000,
		});
		if (!res.ok) return null;
		const data = await res.json();
		return {
			address: data.address?.bounceable || address,
			balance: data.balance ? +(data.balance / 1e9).toFixed(4) : 0,
			status: data.status || "unknown",
			name: data.name || null,
			isWallet: data.is_wallet ?? true,
		};
	} catch (e) {
		console.error(`❌ [Wallet] Info error for ${address}:`, e.message);
		return null;
	}
}

/**
 * Get NFTs owned by a wallet (Fragment usernames, numbers, gifts)
 * @param {string} address - TON wallet address
 */
export async function getWalletNfts(address) {
	try {
		const res = await fetch(`${TONAPI_BASE}/accounts/${address}/nfts?limit=100`, {
			headers: FRAGMENT_HEADERS,
			timeout: 10000,
		});
		if (!res.ok) return { usernames: [], numbers: [], gifts: [], other: [] };
		const data = await res.json();

		const result = { usernames: [], numbers: [], gifts: [], other: [] };

		for (const nft of data.nft_items || []) {
			const meta = nft.metadata || {};
			const name = meta.name || "";
			const collection = nft.collection?.name || "";
			const desc = meta.description || "";

			if (collection.includes("Telegram Username") || name.startsWith("@")) {
				result.usernames.push({
					name: name.replace("@", ""),
					url: `https://fragment.com/username/${name.replace("@", "")}`,
				});
			} else if (collection.includes("Anonymous") || name.startsWith("+888")) {
				result.numbers.push({
					number: name,
					url: `https://fragment.com/number/${name.replace(/\D/g, "")}`,
				});
			} else if (collection.includes("Gift") || desc.includes("gift") || desc.includes("collectible")) {
				result.gifts.push({
					name,
					collection: collection,
					image: meta.image || null,
				});
			} else {
				result.other.push({ name, collection });
			}
		}

		return result;
	} catch (e) {
		console.error(`❌ [Wallet] NFT error for ${address}:`, e.message);
		return { usernames: [], numbers: [], gifts: [], other: [] };
	}
}

/**
 * Get recent transactions for a wallet
 * @param {string} address - TON wallet address
 * @param {number} limit - Max transactions to fetch
 */
export async function getWalletTransactions(address, limit = 20) {
	try {
		const res = await fetch(`${TONAPI_BASE}/accounts/${address}/events?limit=${limit}`, {
			headers: FRAGMENT_HEADERS,
			timeout: 10000,
		});
		if (!res.ok) return [];
		const data = await res.json();

		return (data.events || []).map(ev => ({
			timestamp: ev.timestamp,
			type: ev.actions?.[0]?.type || "unknown",
			amount: ev.actions?.[0]?.TonTransfer?.amount
				? +(ev.actions[0].TonTransfer.amount / 1e9).toFixed(4)
				: null,
			from: ev.actions?.[0]?.TonTransfer?.sender?.address || null,
			to: ev.actions?.[0]?.TonTransfer?.recipient?.address || null,
			comment: ev.actions?.[0]?.TonTransfer?.comment || null,
		}));
	} catch (e) {
		console.error(`❌ [Wallet] Tx error for ${address}:`, e.message);
		return [];
	}
}

/**
 * Full wallet intelligence report — cross-references everything
 */
export async function getWalletIntelligence(address) {
	const [info, nfts, txs] = await Promise.all([
		getWalletInfo(address),
		getWalletNfts(address),
		getWalletTransactions(address, 10),
	]);

	const totalAssets =
		nfts.usernames.length + nfts.numbers.length + nfts.gifts.length + nfts.other.length;

	return {
		...info,
		nfts,
		recentTxs: txs.slice(0, 5),
		portfolio: {
			totalAssets,
			usernames: nfts.usernames.length,
			numbers: nfts.numbers.length,
			gifts: nfts.gifts.length,
		},
	};
}
