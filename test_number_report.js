import { generateNumberReport } from "./src/Modules/Market/Application/number-report.service.js";

async function test() {
	console.log("🚀 Starting +888 Number Report Test...");
	try {
		// Testing a common minted number (+888 8 000 0000 or similar style)
		// Let's use 88812345678 (11 digits)
		const sampleNumber = "+88812345678";
		console.log(`Testing with: ${sampleNumber}`);

		const result = await generateNumberReport(sampleNumber);

		console.log("✅ Success! Report Generated:");
		console.log("--- REPORT TEXT ---");
		console.log(result.report);
		console.log("--- DATA ---");
		console.dir({
			numberClean: result.numberClean,
			estimatedValue: result.estimatedValue,
			status: result.status,
			momentum: result.momentum,
		});
	} catch (error) {
		console.error("❌ Test Failed with Error:");
		console.error(error);
	}
}

test();
