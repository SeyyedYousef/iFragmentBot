import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT_PATH = resolve(
	__dirname,
	"../../../../scripts/scrapling_fragment.py",
);
const PYTHON_BIN = process.env.SCRAPLING_PYTHON || "python";

/**
 * Executes the Scrapling bridge script to fetch Fragment HTML.
 * @param {string} item - Fragment username (without @) or number.
 * @param {{type?: string, proxy?: string, timeoutMs?: number, headful?: boolean, killTimeoutMs?: number}} [options]
 */
export function scraplingFetchFragment(item, options = {}) {
	if (!item) {
		return Promise.reject(new Error("item is required for Scrapling fetch"));
	}

	if (!existsSync(SCRIPT_PATH)) {
		return Promise.reject(
			new Error(`Scrapling bridge script missing at ${SCRIPT_PATH}`),
		);
	}

	const {
		type = "username",
		proxy,
		timeoutMs = 45000,
		headful = false,
		killTimeoutMs = 70000,
		url,
		wait,
	} = options;
	const args = [
		SCRIPT_PATH,
		item.replace("@", "").trim().toLowerCase(),
		"--type",
		type,
	];

	if (url) {
		args.push("--url", url);
	}

	if (wait) {
		args.push("--wait", wait);
	} else if (type === "number" || type === "username") {
		// Default wait for standard pages
		args.push("--wait", ".tm-section-header-status");
	} else {
		// No wait for custom pages unless specified
		args.push("--wait", "");
	}

	if (proxy) {
		args.push("--proxy", proxy);
	}

	if (timeoutMs) {
		args.push("--timeout", String(timeoutMs));
	}

	if (headful) {
		args.push("--headful");
	}

	return new Promise((resolve, reject) => {
		let stdout = "";
		let stderr = "";
		const child = spawn(PYTHON_BIN, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let killed = false;

		const timer = setTimeout(() => {
			killed = true;
			child.kill("SIGTERM");
		}, killTimeoutMs);

		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});

		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		child.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});

		child.on("close", (code) => {
			clearTimeout(timer);

			if (!stdout.trim() && stderr) {
				return reject(new Error(stderr.trim()));
			}

			let payload;
			try {
				payload = JSON.parse(stdout || "{}");
			} catch (err) {
				return reject(
					new Error(`Failed to parse Scrapling output: ${err.message}`),
				);
			}

			if (killed) {
				return reject(new Error("Scrapling fetch timed out"));
			}

			if (code !== 0 || payload.error) {
				const reason =
					payload?.error || stderr || `Scrapling exited with code ${code}`;
				const details = payload?.details || payload?.trace;
				const error = new Error(reason);
				if (details) {
					error.details = details;
				}
				return reject(error);
			}

			resolve(payload);
		});
	});
}
