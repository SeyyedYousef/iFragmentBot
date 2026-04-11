/**
 * iFragmentBot - Ultra-Fast Gift Variable & Link Resolver
 * 
 * Supports both Direct Contract Addresses AND Official Telegram t.me/nft/... links
 */

class GiftVariableService {
    constructor() {
        this.apiBase = 'https://tonapi.io/v2';
        // Official Telegram Gifts Collection (Raw hex address)
        this.telegramGiftsCollection = '0:46fa0e9a864014196a5e7d66f1f83ffdb10f2859bbf2ea9baeabbf14d9ce0d50';
    }

    /**
     * استخراج هوشمند اطلاعات از لینک‌های ترکیبی
     */
    analyzeLink(text) {
        if (!text) return null;
        
        // ۱. بررسی لینک‌های تلگرام (مثل https://t.me/nft/PlushPepe-1983)
        // این Regex آپدیت شد تا خط فاصله‌ها را هم به درستی بگیرد
        const telegramNftRegex = /t\.me\/nft\/([a-zA-Z0-9_\-]+)(?:-\d+)?/;
        const tgMatch = text.match(telegramNftRegex);
        if (tgMatch) {
            // حذف عدد انتهای لینک (مثل -1983) برای پیدا کردن فقط نام مدل
            let cleanSlug = tgMatch[1];
            if (cleanSlug.match(/-\d+$/)) {
                cleanSlug = cleanSlug.replace(/-\d+$/, '');
            }
            return { type: 'telegram_slug', value: cleanSlug };
        }

        // ۲. بررسی آدرس‌های قرارداد هوشمند تون
        const tonAddressRegex = /([EU][Q|A|D|B|C|I|R|G][a-zA-Z0-9_\-]{46})/;
        const addressMatch = text.match(tonAddressRegex);
        if (addressMatch) {
            return { type: 'contract_address', value: addressMatch[1] };
        }

        return null;
    }

    /**
     * Parallel Resolver (GPU-Style Processing)
     * پردازش موازی برای رسیدن به سرعت میلی‌ثانیه‌ای
     */
    async getFloorOfSpecificGiftByLink(userMessageOrLink) {
        try {
            const linkInfo = this.analyzeLink(userMessageOrLink);
            if (!linkInfo) return { error: true, message: "❌ هیچ لینک معتبری یافت نشد." };

            // شروع همزمان دو درخواست اصلی (موازی سازی)
            const [collectionItemsRes, nftItemRes] = await Promise.all([
                fetch(`${this.apiBase}/nfts/collections/${this.telegramGiftsCollection}/items?limit=250&sort_by=price_asc`),
                linkInfo.type === 'contract_address' ? fetch(`${this.apiBase}/nfts/${linkInfo.value}`) : Promise.resolve(null)
            ]);

            const [floorData, nftData] = await Promise.all([
                collectionItemsRes.json(),
                nftItemRes ? nftItemRes.json() : Promise.resolve(null)
            ]);

            if (!floorData.nft_items) return { error: true, message: "خطا در دریافت لیست بازار." };

            // استخراج نام مدل
            let giftModelName = "";
            if (linkInfo.type === 'telegram_slug') {
                giftModelName = linkInfo.value;
            } else if (nftData) {
                if (nftData.collection?.address !== this.telegramGiftsCollection) {
                    return { error: true, message: "⚠️ این قرارداد متعلق به کالکشن رسمی گیفت تلگرام نیست." };
                }
                giftModelName = nftData.metadata.name;
            }

            const targetNameCleaned = giftModelName.replace(/[\s\-\_\#0-9]+/g, '').toLowerCase();

            // فیلتر کردن سریع (In-memory Filter)
            const matchingSpecificGifts = floorData.nft_items.filter(i => {
                if (!i.metadata || !i.metadata.name || !i.sale) return false;
                const dbNameCleaned = i.metadata.name.replace(/[\s\-\_\#0-9]+/g, '').toLowerCase();
                return dbNameCleaned === targetNameCleaned;
            });

            if (matchingSpecificGifts.length === 0) {
                const prettyName = giftModelName.replace(/([A-Z])/g, ' $1').trim();
                return { error: false, message: `✅ مدل شناسایی شد: ${prettyName}\n⚠️ اما در حال حاضر برای فروش موجود نیست.` };
            }

            // استخراج همزمان تمام قیمت‌ها از دیتای دریافتی
            const resultVars = {
                "{Gift-Name}": matchingSpecificGifts[0].metadata.name.split('#')[0].trim(),
                "{Specific-Floor-Global}": (parseInt(matchingSpecificGifts[0].sale.price.value) / 1e9).toFixed(1),
                "{Market-Name}": matchingSpecificGifts[0].sale.market.name || "TON Market"
            };

            // پیدا کردن کف قیمت در هر مارکت به صورت موازی در حافظه
            const tonnelItem = matchingSpecificGifts.find(i => i.sale.market.name?.toLowerCase().includes('tonnel'));
            const getgemsItem = matchingSpecificGifts.find(i => i.sale.market.name?.toLowerCase().includes('getgems'));
            const portalsItem = matchingSpecificGifts.find(i => i.sale.market.name?.toLowerCase().includes('portal'));

            resultVars["{Specific-Floor-Tonnel}"] = tonnelItem ? (parseInt(tonnelItem.sale.price.value) / 1e9).toFixed(1) : "نامشخص";
            resultVars["{Specific-Floor-Getgems}"] = getgemsItem ? (parseInt(getgemsItem.sale.price.value) / 1e9).toFixed(1) : "نامشخص";
            resultVars["{Specific-Floor-Portals}"] = portalsItem ? (parseInt(portalsItem.sale.price.value) / 1e9).toFixed(1) : "نامشخص";

            return { error: false, variables: resultVars };

        } catch (error) {
            return { error: true, message: "خطا در پردازش موازی داده‌ها.", details: error.message };
        }
    }

    /**
     * موتور جایگزینی متغیرها (High Performance)
     */
    async replaceVariablesInText(text, link) {
        if (!text.includes('{')) return text;
        const data = await this.getFloorOfSpecificGiftByLink(link);
        if (data.error || !data.variables) return text;

        let newText = text;
        for (const [key, value] of Object.entries(data.variables)) {
            newText = newText.split(key).join(value); // سریع‌تر از replace
        }
        return newText;
    }
}

const giftVariableService = new GiftVariableService();
export { giftVariableService as GiftVariableService };
export default giftVariableService;
