import fetch from "node-fetch";

export class FragmentApiClient {
	constructor() {
		this.apiUrl = null;
		this.cookieStr = null;
		this.initialized = false;
		this.initPromise = null;
	}

	async initialize() {
		if (this.initialized) return;
		if (this.initPromise) return this.initPromise;

		this.initPromise = (async () => {
			try {
				const res = await fetch("https://fragment.com/");
				const cookies = res.headers.raw && res.headers.raw()['set-cookie'] 
						? res.headers.raw()['set-cookie'] 
						: (res.headers.getSetCookie ? res.headers.getSetCookie() : []);
				
				this.cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
				const html = await res.text();
				
				const match = html.match(/ajInit\((.*?)\);/);
				if (match) {
					const initData = JSON.parse(match[1]);
					this.apiUrl = "https://fragment.com" + initData.apiUrl;
					this.initialized = true;
					console.log("✅ Fragment API Client Initialized:", this.apiUrl);
				}
			} catch (error) {
				console.error("❌ Fragment API Init Error:", error.message);
			} finally {
				this.initPromise = null;
			}
		})();

		return this.initPromise;
	}

	async executeAPI(method, params = {}, retry = true) {
		await this.initialize();
		if (!this.initialized) return null;

		const formParams = new URLSearchParams();
		formParams.append("method", method);
		for (const [key, value] of Object.entries(params)) {
			formParams.append(key, value);
		}

		try {
			const res = await fetch(this.apiUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					"X-Requested-With": "XMLHttpRequest",
					"Cookie": this.cookieStr + "; stel_dt=-210",
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
				},
				body: formParams.toString()
			});
			
			if (!res.ok) {
				// If 401/403, might be expired session, retry once with fresh init
				if ((res.status === 401 || res.status === 403) && retry) {
					console.warn("🔄 Fragment API Session likely expired. Refreshing...");
					this.initialized = false;
					return this.executeAPI(method, params, false);
				}
				console.error(`Fragment API HTTP Error: ${res.status}`);
				return null;
			}
			
			const text = await res.text();
			try {
				return JSON.parse(text);
			} catch (e) {
				console.error("❌ Fragment API returned non-JSON response:", text.substring(0, 100));
				return null;
			}
		} catch (error) {
			console.error("Fragment API Execution Error:", error.message);
			return null;
		}
	}

	/**
	 * Search global auctions (Usernames, Numbers, or Gifts)
	 * @param {string} query 
	 * @param {string} sort 'ending', 'price_asc', 'price_desc', 'listed'
	 * @param {string} type 'usernames', 'numbers', 'gifts'
	 * @param {string} filter 'auction', 'sale'
	 */
	async searchAuctions(query = "", sort = "ending", type = "usernames", filter = "auction") {
		return this.executeAPI("searchAuctions", {
			type,
			query,
			sort,
			filter
		});
	}

	/**
	 * Get detailed auction info (Increment, Stars Price, etc.)
	 */
	async getAuctionDetails(id) {
		return this.executeAPI("getAuctionDetails", { id });
	}

	/**
	 * Get bid history for an item
	 */
	async getBidHistory(id) {
		return this.executeAPI("getBidHistory", { id });
	}

	/**
	 * Get historical transfers/owners
	 */
	async getAssetHistory(id) {
		return this.executeAPI("getAssetHistory", { id });
	}

	/**
	 * Get specific item info by method (discovery)
	 */
	async getItemInfo(method, params = {}) {
		return this.executeAPI(method, params);
	}
}

export const fragmentApiClient = new FragmentApiClient();
