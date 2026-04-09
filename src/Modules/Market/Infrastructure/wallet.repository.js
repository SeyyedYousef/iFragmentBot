/**
 * Wallet Intelligence Repository
 * Provides deep insights into TON wallets (Balance, Activity, Assets)
 */
import fetch from "node-fetch";

const TONAPI_BASE = "https://tonapi.io/v2";

export async function getWalletIntel(address) {
    try {
        const headers = {
            "Accept": "application/json",
            "User-Agent": "iFragmentBot/1.0"
        };
        
        if (process.env.TONAPI_KEY) {
            headers["Authorization"] = `Bearer ${process.env.TONAPI_KEY}`;
        }

        const [accountResp, transactionsResp] = await Promise.all([
            fetch(`${TONAPI_BASE}/accounts/${address}`, { headers }),
            fetch(`${TONAPI_BASE}/blockchain/accounts/${address}/transactions?limit=10`, { headers })
        ]);

        const account = accountResp.ok ? await accountResp.json() : null;
        const txs = transactionsResp.ok ? await transactionsResp.json() : { transactions: [] };

        if (!account) return null;

        const balance = (account.balance || 0) / 1e9;
        const txCount = txs.transactions?.length || 0;
        
        // Intelligence Logic
        let rank = "Collector";
        if (balance > 10000) rank = "Mega Whale 🐋";
        else if (balance > 1000) rank = "Whale 🐋";
        else if (balance > 100) rank = "Active Trader 📈";
        
        return {
            address,
            balance,
            rank,
            lastActivity: txs.transactions?.[0]?.utime || null,
            txCount,
            isWhale: balance > 1000,
            status: account.status || "active"
        };
    } catch (error) {
        console.error("❌ Wallet Intel Error:", error.message);
        return null;
    }
}
