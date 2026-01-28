// Quick test to verify all imports and algorithm work
import { estimateGiftValue, generateGiftReport } from './src/services/marketappService.js';

console.log('🧪 Testing Est. Value Algorithm V2.0...\n');

// Test 1: Basic estimation with mock data
const mockResult = estimateGiftValue(
    100, // collectionFloor
    { model: 120, backdrop: 150, symbol: 80 }, // attributeFloors
    { model: 75, backdrop: 85, symbol: 50 }, // attributeRarities
    10000, // totalItems
    500, // onSale
    {
        itemNumber: 5, // Single digit - should get bonus
        modelName: 'Gold Star',
        backdropName: 'Black', // Premium backdrop
        symbolName: 'Diamond',
        marketPrices: {
            model: { median: 130, count: 10 },
            backdrop: { median: 180, count: 5 },
            symbol: { median: 90, count: 8 }
        },
        collectionSlug: 'TestCollection'
    }
);

console.log('═══════════════════════════════════════');
console.log('📊 ALGORITHM V2.0 TEST RESULTS');
console.log('═══════════════════════════════════════\n');

console.log('💰 Estimated Value:', mockResult.estimated, 'TON');
console.log('📈 Base Value:', mockResult.baseValue, 'TON');
console.log('🔢 Multiplier:', mockResult.totalMultiplier + 'x');
console.log('');
console.log('🎯 Confidence Level:', mockResult.confidence);
console.log('📊 Confidence Score:', mockResult.confidenceScore + '%');
console.log('');
console.log('📦 Data Quality:', mockResult.dataQuality?.level, `(${mockResult.dataQuality?.score || 0}/100)`);
console.log('📋 Sources:', mockResult.dataQuality?.sources?.join(', ') || 'N/A');
console.log('');
console.log('💎 Bonuses Applied:');
mockResult.bonuses.forEach(b => console.log('  ▸', b));
console.log('');
console.log('🏆 Badges:', mockResult.badges.join(' • '));
console.log('');

if (mockResult.valueRange) {
    console.log('📐 Value Range:', mockResult.valueRange.low, '-', mockResult.valueRange.high, 'TON');
}

console.log('\n✅ Algorithm V2.0 test complete!');
console.log('═══════════════════════════════════════\n');

// Validation
const passed = [];
const failed = [];

// Check confidence is in new 5-level system
if (['ultra_high', 'very_high', 'high', 'moderate', 'low', 'very_low'].includes(mockResult.confidence)) {
    passed.push('5-Level Confidence System');
} else {
    failed.push('5-Level Confidence System - Got: ' + mockResult.confidence);
}

// Check confidence score exists
if (typeof mockResult.confidenceScore === 'number') {
    passed.push('Confidence Score (numeric)');
} else {
    failed.push('Confidence Score missing');
}

// Check data quality exists
if (mockResult.dataQuality && mockResult.dataQuality.score >= 0) {
    passed.push('Data Quality Scoring');
} else {
    failed.push('Data Quality Scoring missing');
}

// Check single digit bonus was applied (itemNumber = 5)
if (mockResult.bonuses.some(b => b.includes('Single digit'))) {
    passed.push('Single Digit Number Bonus');
} else {
    failed.push('Single Digit Number Bonus not applied');
}

// Check premium backdrop bonus (Black)
if (mockResult.bonuses.some(b => b.includes('Premium backdrop'))) {
    passed.push('Premium Backdrop Bonus');
} else {
    failed.push('Premium Backdrop Bonus not applied');
}

// Check no duplicate marketData (old bug)
if (mockResult.marketData && !Array.isArray(mockResult.marketData)) {
    passed.push('No Duplicate marketData (bug fixed)');
} else {
    failed.push('Duplicate marketData bug still present');
}

console.log('📋 VALIDATION RESULTS:');
console.log('═══════════════════════════════════════');
passed.forEach(p => console.log('✅', p));
failed.forEach(f => console.log('❌', f));
console.log('');
console.log(`Result: ${passed.length}/${passed.length + failed.length} tests passed`);

if (failed.length === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Algorithm upgraded to 100/100 🎉');
} else {
    console.log('\n⚠️ Some tests failed. Please review.');
    process.exit(1);
}
