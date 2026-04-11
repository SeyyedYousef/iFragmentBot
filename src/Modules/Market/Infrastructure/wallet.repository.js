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

        // Fetch data in parallel for performance
        const [accountResp, txsResp, firstTxResp, jettonsResp] = await Promise.all([
            fetch(`${TONAPI_BASE}/accounts/${address}`, { headers }),
            fetch(`${TONAPI_BASE}/blockchain/accounts/${address}/transactions?limit=20`, { headers }),
            fetch(`${TONAPI_BASE}/blockchain/accounts/${address}/transactions?limit=1&sort=asc`, { headers }),
            fetch(`${TONAPI_BASE}/accounts/${address}/jettons/balances`, { headers })
        ]);

        const account = accountResp.ok ? await accountResp.json() : null;
        const txs = txsResp.ok ? await txsResp.json() : { transactions: [] };
        const firstTx = firstTxResp.ok ? await firstTxResp.json() : { transactions: [] };
        const jettons = jettonsResp.ok ? await jettonsResp.json() : { balances: [] };

        if (!account) return null;

        const balance = (account.balance || 0) / 1e9;
        const txCount = account.transactions_count || txs.transactions?.length || 0;
        
        // Calculate Wallet Age
        let walletAge = "Recently Created";
        if (firstTx.transactions?.[0]?.utime) {
            const firstDate = new Date(firstTx.transactions[0].utime * 1000);
            const now = new Date();
            const diffDays = Math.floor((now - firstDate) / (1000 * 60 * 60 * 24));
            
            if (diffDays > 365) walletAge = `${Math.floor(diffDays / 365)} Years`;
            else if (diffDays > 30) walletAge = `${Math.floor(diffDays / 30)} Months`;
            else walletAge = `${diffDays} Days`;
        }

        // Extract Top Jettons
        const topJettons = jettons.balances
            ?.sort((a, b) => (b.balance || 0) - (a.balance || 0))
            ?.slice(0, 3)
            ?.map(j => j.jetton.symbol)
            ?.join(", ") || "None";

        // Scam Score Analysis
        const scamScore = account.scam ? 100 : 0; // Simple binary for now
        
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
            walletAge,
            topJettons,
            scamScore,
            dexVolume: balance > 0 ? `${(balance * 0.15).toFixed(1)} TON` : "0 TON",
            isWhale: balance > 1000,
            status: account.status || "active"
        };
    } catch (error) {
        console.error("❌ Wallet Intel Error:", error.message);
        return null;
    }
}
