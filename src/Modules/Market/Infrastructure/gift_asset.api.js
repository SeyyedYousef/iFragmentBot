/**
 * Gift Asset API Service
 * Comprehensive wrapper for https://api.giftasset.dev
 * Features: Token rotation, rate-limit handling, all endpoints
 */

import fetch from 'node-fetch';
import { addGiftAssetToken, loadGiftAssetTokens, deleteGiftAssetToken } from '../../../Shared/Infra/Database/mongo.repository.js';

const BASE_URL = 'https://api.giftasset.dev/api/v1/gifts';

class GiftAssetAPI {
    constructor() {
        this.tokens = [];
        this.currentTokenIndex = 0;
        this.cooldowns = new Map(); // tokenIndex -> cooldownUntil timestamp
        this._loadTokens();
    }

    // ==================== TOKEN MANAGEMENT ====================

    async _loadTokens() {
        try {
            // Priority 1: MongoDB
            const dbTokens = await loadGiftAssetTokens();
            if (dbTokens && dbTokens.length > 0) {
                this.tokens = dbTokens;
                console.log(`🔑 [GiftAsset] Loaded ${this.tokens.length} API tokens from MongoDB`);
                return;
            }

            // Priority 2: Environment Variable
            const envToken = process.env.GIFT_ASSET_API_TOKEN;
            if (envToken) {
                this.tokens = [envToken];
                console.log('🔑 [GiftAsset] Using env token');
            } else {
                console.log('⚠️ [GiftAsset] No GiftAsset tokens found in DB or ENV.');
            }
        } catch (e) {
            console.error('❌ [GiftAsset] Token load crashed:', e.message);
        }
    }

    async addToken(token) {
        if (token && token.length > 5 && !this.tokens.includes(token)) {
            const success = await addGiftAssetToken(token);
            if (success) {
                this.tokens.push(token);
                console.log(`✅ [GiftAsset] Token added to DB: ${token.substring(0, 8)}...`);
                return true;
            }
        }
        return false;
    }

    async removeToken(index) {
        if (index >= 0 && index < this.tokens.length) {
            const tokenToDelete = this.tokens[index];
            const success = await deleteGiftAssetToken(tokenToDelete);
            if (success) {
                this.tokens.splice(index, 1);
                console.log(`🗑️ [GiftAsset] Token removed from DB: ${tokenToDelete.substring(0, 8)}...`);
                return true;
            }
        }
        return false;
    }

    getTokenList() {
        return this.tokens.map((t, i) => ({
            index: i,
            token: t, // Keep the full token for removal later
            preview: t.substring(0, 8) + '...' + t.slice(-4),
            cooldown: this.cooldowns.has(i) && this.cooldowns.get(i) > Date.now()
        }));
    }

    getTokenCount() {
        return this.tokens.length;
    }

    // ==================== CORE REQUEST ENGINE ====================

    /** 
     * 🧠 ENGINE V2: Smart Token Selector with Dynamic Sleep Queue
     */
    async _getNextToken() {
        if (this.tokens.length === 0) return null;
        
        const now = Date.now();
        let bestTokenIdx = -1;
        let shortestWait = Infinity;

        // 1. Find least recently used available token (Strict Round Robin)
        for (let i = 0; i < this.tokens.length; i++) {
            const idx = (this.currentTokenIndex + i) % this.tokens.length;
            const cooldownUntil = this.cooldowns.get(idx);
            
            if (!cooldownUntil || now > cooldownUntil) {
                // Token is pristine or recovered!
                this.currentTokenIndex = (idx + 1) % this.tokens.length;
                return { token: this.tokens[idx], index: idx };
            }
            
            // Log the token that will be available soonest
            const waitTime = cooldownUntil - now;
            if (waitTime < shortestWait) {
                shortestWait = waitTime;
                bestTokenIdx = idx;
            }
        }
        
        // 2. 🚦 Queue System: All tokens are exhausted! 
        // Pause execution gracefully without throwing errors or spamming the server
        if (bestTokenIdx !== -1 && shortestWait > 0 && shortestWait < 20000) { // Max queue hold 20s
            console.log(`⏳ [GiftAsset Engine] 🚦 Traffic Jam! System queuing for ${Math.ceil(shortestWait/1000)}s until Token #${bestTokenIdx} resets...`);
            await new Promise(resolve => setTimeout(resolve, shortestWait + 150)); // Sleep until ready + 150ms safe margin
            this.currentTokenIndex = (bestTokenIdx + 1) % this.tokens.length;
            return { token: this.tokens[bestTokenIdx], index: bestTokenIdx };
        } else {
            console.log(`🚨 [GiftAsset Engine] Heavy Overload! Forcing emergency override on Token #${this.currentTokenIndex}...`);
            const idx = this.currentTokenIndex;
            this.currentTokenIndex = (idx + 1) % this.tokens.length;
            return { token: this.tokens[idx], index: idx };
        }
    }

    /**
     * 🚀 Advanced Fetcher with Preemptive Rate-Limiting and Multi-Tier Backoff
     */
    async _request(method, endpoint, params = {}, body = null) {
        // Retry logic is hyper-resilient: 1 attempt per token, plus 1 final network retry
        const maxAttempts = Math.max(this.tokens.length + 1, 3);

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const tokenInfo = await this._getNextToken();
            
            try {
                let url = `${BASE_URL}${endpoint}`;

                // Parse Params
                const queryParts = Object.entries(params)
                    .filter(([, v]) => v !== undefined && v !== null)
                    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
                if (queryParts.length > 0) {
                    url += '?' + queryParts.join('&');
                }

                const options = {
                    method: method.toUpperCase(),
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 10000 // Optimized timeout bounds
                };

                if (tokenInfo?.token) {
                    options.headers['X-API-Token'] = tokenInfo.token;
                }

                if (body && method.toUpperCase() !== 'GET') {
                    options.body = JSON.stringify(body);
                }

                const response = await fetch(url, options);

                // ✨ Preemptive Traffic Analysis ✨
                const remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
                const retryAfter = response.headers.get('Retry-After');
                
                // If token is dangerously close to limit, soft-cooldown it BEFORE it dies (Prevent 429)
                if (!isNaN(remaining) && remaining <= 1 && tokenInfo) {
                    this.cooldowns.set(tokenInfo.index, Date.now() + 15000); // 15s proactive rest
                    console.log(`🛡️ [GiftAsset Engine] Token #${tokenInfo.index} critically low on rates. Entering proactive sleep.`);
                }

                // Hard Limits (Tokens actually blocked)
                if (response.status === 429 || response.status === 401) {
                    let penaltyTime = 30000; // Base 30s penalty
                    if (retryAfter) {
                        penaltyTime = parseInt(retryAfter) * 1000;
                    } else if (response.status === 401) {
                        penaltyTime = 120000; // Suspected invalid/revoked token (2 mins exclusion)
                    }
                    
                    if (tokenInfo) {
                        this.cooldowns.set(tokenInfo.index, Date.now() + penaltyTime);
                        console.log(`🔥 [GiftAsset Engine] Token #${tokenInfo.index} hit 429/401! Banning for ${penaltyTime/1000}s. Spinning cylinder...`);
                    }
                    continue; // Auto-trigger next loop iteration (next token)
                }

                // Server Errors => Exponential Backoff
                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'Unknown error');
                    console.warn(`[GiftAsset Engine] Error ${response.status} on ${endpoint}: ${errorText.substring(0,60)}`);
                    
                    if (response.status >= 500 && attempt < maxAttempts - 1) {
                        // Server transient fail, wait a moment and hit again
                        const backoff = 1000 * Math.pow(1.5, attempt);
                        await new Promise(r => setTimeout(r, backoff));
                        continue;
                    }
                    return null;
                }

                // 🎉 Success! Clear any accidental cooldowns
                if (tokenInfo && this.cooldowns.has(tokenInfo.index)) {
                     this.cooldowns.delete(tokenInfo.index);
                }

                return await response.json();

            } catch (error) {
                // Network Errors (ECONNRESET, ETIMEDOUT)
                console.warn(`[GiftAsset Engine] TCP/Network error on ${endpoint} ->`, error.message);
                
                // Soft penalty for token on network drop just in case IP was closed softly
                if (tokenInfo && !this.cooldowns.has(tokenInfo.index)) {
                    this.cooldowns.set(tokenInfo.index, Date.now() + 5000); 
                }

                if (attempt === maxAttempts - 1) return null;
                await new Promise(r => setTimeout(r, 600)); // Network breath
            }
        }

        console.error('❌ [GiftAsset Engine] FATAL: All tokens burned out and limits exceeded.');
        return null;
    }

    // ==================== 👤 USER DATA ====================

    /** Get all collections a user holds */
    async getAllCollectionsByUser(username, limit = 100, offset = 0, include = [], exclude = []) {
        const body = { limit, offset };
        if (include?.length) body.include = include;
        if (exclude?.length) body.exclude = exclude;
        return this._request('POST', '/get_all_collections_by_user', { username }, body);
    }

    /** Get detailed info for a specific gift by name (e.g. EasterEgg-1) */
    async getGiftByName(giftName) {
        return this._request('GET', '/get_gift_by_name', { name: giftName });
    }

    /** Get all gifts owned by a user with full details */
    async getGiftsByUser(username, limit = 100, offset = 0) {
        return this._request('GET', '/get_gift_by_user', { username, limit, offset });
    }

    /** Calculate total profile value across all marketplaces */
    async getUserProfilePrice(username, limit = 100, offset = 0) {
        return this._request('GET', '/get_user_profile_price', { username, limit, offset });
    }

    // ==================== 📊 PROVIDERS & MARKET ====================

    /** Top attribute sales volumes per day */
    async getAttributeVolumes() {
        return this._request('GET', '/get_attribute_volumes');
    }

    /** Buy offers on a collection */
    async getCollectionOffers(collectionName) {
        return this._request('POST', '/get_collection_offers', {}, { collection_name: collectionName });
    }

    /** Top collection volumes over N seconds */
    async getCustomCollectionsVolumes(maxTime) {
        return this._request('GET', '/get_custom_collections_volumes', { maxtime: maxTime });
    }

    /** Fee per marketplace */
    async getProvidersFee() {
        return this._request('GET', '/get_providers_fee');
    }

    /** Recent sales from a specific marketplace */
    async getProvidersSalesHistory(providerName, limit = 50, offset = 0, premarket = false) {
        const params = { provider_name: providerName, limit, offset };
        if (premarket) params.premarket = true;
        return this._request('GET', '/get_providers_sales_history', params);
    }

    /** Live marketplace volumes */
    async getProvidersVolumes() {
        return this._request('GET', '/get_providers_volumes');
    }

    /** 🎯 Snipe radar: best deals (below market value) */
    async getTopBestDeals() {
        return this._request('GET', '/get_top_best_deals');
    }

    // ==================== 🏷 METADATA ====================

    /** Raw attribute metadata for all collections */
    async getAttributesMetadata() {
        return this._request('GET', '/get_attributes_metadata');
    }

    /** Raw collection metadata */
    async getCollectionsMetadata() {
        return this._request('GET', '/get_collections_metadata');
    }

    // ==================== 📈 ANALYTICS ====================

    /** Emission vs upgraded (minted) counts per collection */
    async getGiftsCollectionsEmission() {
        return this._request('GET', '/get_gifts_collections_emission');
    }

    /** Market cap per collection per marketplace */
    async getGiftsCollectionsMarketCap() {
        return this._request('GET', '/get_gifts_collections_marketcap');
    }

    /** Recent gift upgrades (mint events) */
    async getGiftsUpdateStat() {
        return this._request('GET', '/get_gifts_update_stat');
    }
}

// Singleton
const giftAssetAPI = new GiftAssetAPI();
export default giftAssetAPI;
