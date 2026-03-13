/**
 * Apify API Token Manager (Rotation + DB persistence)
 *
 * This module ONLY manages Apify tokens.
 * Actual actor execution is implemented separately (to avoid coupling).
 */

import { addApifyToken, loadApifyTokens, deleteApifyToken } from '../../../Shared/Infra/Database/mongo.repository.js';

class ApifyTokenManager {
    constructor() {
        this.tokens = [];
        this.currentTokenIndex = 0;
        this._loadTokens();
    }

    async _loadTokens() {
        try {
            const dbTokens = await loadApifyTokens();
            if (dbTokens && dbTokens.length > 0) {
                this.tokens = dbTokens;
                console.log(`🔑 [Apify] Loaded ${this.tokens.length} API tokens from MongoDB`);
                return;
            }

            const envToken = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;
            if (envToken) {
                this.tokens = [envToken];
                console.log('🔑 [Apify] Using env token');
            } else {
                console.log('⚠️ [Apify] No Apify tokens found in DB or ENV.');
            }
        } catch (e) {
            console.error('❌ [Apify] Token load crashed:', e.message);
        }
    }

    getTokenCount() {
        return this.tokens.length;
    }

    getTokenList() {
        return this.tokens.map((t, i) => ({
            index: i,
            preview: t.substring(0, 8) + '...' + t.slice(-4)
        }));
    }

    getNextToken() {
        if (this.tokens.length === 0) return null;
        const idx = this.currentTokenIndex % this.tokens.length;
        const token = this.tokens[idx];
        this.currentTokenIndex = (idx + 1) % this.tokens.length;
        return token;
    }

    async addToken(token) {
        if (!token || token.length < 10) return false;
        if (this.tokens.includes(token)) return false;
        const ok = await addApifyToken(token);
        if (ok) {
            this.tokens.push(token);
            return true;
        }
        return false;
    }

    async removeToken(index) {
        if (index < 0 || index >= this.tokens.length) return false;
        const token = this.tokens[index];
        const ok = await deleteApifyToken(token);
        if (ok) {
            this.tokens.splice(index, 1);
            if (this.currentTokenIndex >= this.tokens.length) this.currentTokenIndex = 0;
            return true;
        }
        return false;
    }
}

const apifyAPI = new ApifyTokenManager();
export default apifyAPI;

