/**
 * Job Queue Service
 * Async job processing system for handling concurrent requests
 * Optimized for Render.com free plan (512MB RAM)
 */

import PQueue from "p-queue";

// ==================== CONFIGURATION ====================
const CONFIG = {
	// Concurrency limits (optimized for 512MB RAM)
	MAX_PUPPETEER_CONCURRENCY: 2, // Puppeteer jobs (memory heavy)
	MAX_API_CONCURRENCY: 8, // API-only jobs
	MAX_QUEUE_SIZE: 500, // Max jobs in queue

	// Timeouts
	JOB_TIMEOUT: 90000, // 90 seconds per job
	STALE_JOB_CLEANUP: 300000, // Clean jobs older than 5 min

	// Intervals
	CLEANUP_INTERVAL: 60000, // Cleanup every 1 minute
	STATS_LOG_INTERVAL: 30000, // Log stats every 30 seconds
};

// ==================== JOB TYPES ====================
export const JOB_TYPES = {
	// Heavy jobs (use Puppeteer)
	GIFT_REPORT: "gift_report",
	NUMBER_REPORT: "number_report",
	USERNAME_REPORT: "username_report",
	GIFT_CARD: "gift_card",
	FLEX_CARD: "flex_card",

	// Light jobs (API only)
	WALLET_CHECK: "wallet_check",
	PORTFOLIO: "portfolio",
	COMPARISON: "comparison",
};

// Jobs that require Puppeteer (heavy)
const HEAVY_JOB_TYPES = new Set([
	JOB_TYPES.GIFT_REPORT,
	JOB_TYPES.NUMBER_REPORT,
	JOB_TYPES.USERNAME_REPORT,
	JOB_TYPES.GIFT_CARD,
	JOB_TYPES.FLEX_CARD,
	JOB_TYPES.COMPARISON, // Uses Puppeteer to scrape usernames
	JOB_TYPES.PORTFOLIO, // Now generates Wallet Cards using Puppeteer
	JOB_TYPES.WALLET_CHECK,
]);

// ==================== PRIORITY LEVELS ====================
export const PRIORITIES = {
	PREMIUM: 1, // Premium users
	NORMAL: 5, // Regular users
	LOW: 10, // Background tasks
};

// ==================== JOB STATUS ====================
const JOB_STATUS = {
	QUEUED: "queued",
	PROCESSING: "processing",
	COMPLETED: "completed",
	FAILED: "failed",
	CANCELLED: "cancelled",
	TIMEOUT: "timeout",
};

// ==================== JOB QUEUE CLASS ====================
class JobQueue {
	constructor() {
		// Priority queue for heavy jobs (Puppeteer-based)
		this.heavyQueue = new PQueue({
			concurrency: CONFIG.MAX_PUPPETEER_CONCURRENCY,
			timeout: CONFIG.JOB_TIMEOUT,
			throwOnTimeout: true,
		});

		// Priority queue for light jobs (API-based)
		this.lightQueue = new PQueue({
			concurrency: CONFIG.MAX_API_CONCURRENCY,
			timeout: CONFIG.JOB_TIMEOUT,
			throwOnTimeout: true,
		});

		// Job tracking
		this.jobs = new Map(); // jobId -> job object
		this.userJobs = new Map(); // userId -> Set of jobIds
		this.jobCounter = 0;

		// Statistics
		this.stats = {
			totalProcessed: 0,
			totalFailed: 0,
			totalTimeout: 0,
			avgProcessingTime: 0,
			processingTimes: [],
		};

		// Job handlers registry
		this.handlers = new Map();

		// Bot reference (set externally)
		this.bot = null;

		// Start cleanup interval
		this.cleanupInterval = setInterval(
			() => this.cleanup(),
			CONFIG.CLEANUP_INTERVAL,
		);

		// Log stats periodically
		this.statsInterval = setInterval(
			() => this.logStats(),
			CONFIG.STATS_LOG_INTERVAL,
		);

		console.log("📋 Job Queue initialized");
		console.log(
			`   Heavy jobs (Puppeteer): max ${CONFIG.MAX_PUPPETEER_CONCURRENCY} concurrent`,
		);
		console.log(
			`   Light jobs (API): max ${CONFIG.MAX_API_CONCURRENCY} concurrent`,
		);
	}

	/**
	 * Set bot reference for sending messages
	 */
	setBot(bot) {
		this.bot = bot;
	}

	/**
	 * Register a job handler
	 */
	registerHandler(jobType, handler) {
		this.handlers.set(jobType, handler);
		console.log(`📋 Registered handler for: ${jobType}`);
	}

	/**
	 * Add a job to the queue
	 * @returns {string} Job ID
	 */
	async add(options) {
		const {
			type,
			userId,
			chatId,
			data = {},
			priority = PRIORITIES.NORMAL,
			timeout = CONFIG.JOB_TIMEOUT,
			messageId = null, // Optional: message to update with status
		} = options;

		// Check queue capacity
		const totalQueued = this.heavyQueue.pending + this.lightQueue.pending;
		if (totalQueued >= CONFIG.MAX_QUEUE_SIZE) {
			throw new Error("Queue is full. Please try again later.");
		}

		// Check if user already has a pending job of same type
		const userJobSet = this.userJobs.get(String(userId));
		if (userJobSet) {
			for (const existingJobId of userJobSet) {
				const existingJob = this.jobs.get(existingJobId);
				if (
					existingJob &&
					existingJob.type === type &&
					existingJob.status === JOB_STATUS.QUEUED
				) {
					throw new Error("You already have a pending request of this type.");
				}
			}
		}

		// Deduplication: Prevent duplicate Gift Processing (Global Check)
		if (type === JOB_TYPES.NUMBER_REPORT && data.input) {
			for (const job of this.jobs.values()) {
				if (
					(job.status === JOB_STATUS.QUEUED ||
						job.status === JOB_STATUS.PROCESSING) &&
					job.type === JOB_TYPES.NUMBER_REPORT &&
					job.data?.input === data.input
				) {
					throw new Error("This number is already being analyzed.");
				}
			}
		}
		if (type === JOB_TYPES.GIFT_REPORT && data.link) {
			for (const job of this.jobs.values()) {
				if (
					(job.status === JOB_STATUS.QUEUED ||
						job.status === JOB_STATUS.PROCESSING) &&
					job.type === JOB_TYPES.GIFT_REPORT &&
					job.data &&
					job.data.link === data.link
				) {
					throw new Error("This gift link is already being analyzed.");
				}
			}
		}

		// Create job
		const jobId = `job_${++this.jobCounter}_${Date.now()}`;
		const job = {
			id: jobId,
			type,
			userId: String(userId),
			chatId,
			data,
			priority,
			timeout,
			messageId,
			status: JOB_STATUS.QUEUED,
			createdAt: Date.now(),
			startedAt: null,
			completedAt: null,
			result: null,
			error: null,
		};

		// Store job
		this.jobs.set(jobId, job);

		// Track user's jobs
		if (!this.userJobs.has(job.userId)) {
			this.userJobs.set(job.userId, new Set());
		}
		this.userJobs.get(job.userId).add(jobId);

		// Select queue based on job type
		const queue = HEAVY_JOB_TYPES.has(type) ? this.heavyQueue : this.lightQueue;

		// Add to queue with priority
		queue
			.add(() => this.processJob(jobId), { priority })
			.catch((error) => {
				// Handle timeout or other queue errors
				const j = this.jobs.get(jobId);
				if (j && j.status === JOB_STATUS.PROCESSING) {
					j.status = JOB_STATUS.TIMEOUT;
					j.error = error.message;
					j.completedAt = Date.now();
					this.stats.totalTimeout++;
					this.notifyJobResult(j, null, error);
				}
			});

		console.log(
			`📋 Job added: ${jobId} (${type}) for user ${userId} [priority: ${priority}]`,
		);

		return jobId;
	}

	/**
	 * Process a job
	 */
	async processJob(jobId) {
		const job = this.jobs.get(jobId);
		if (!job || job.status !== JOB_STATUS.QUEUED) {
			return;
		}

		job.status = JOB_STATUS.PROCESSING;
		job.startedAt = Date.now();

		// Notify user that processing started
		await this.notifyJobStarted(job);

		try {
			// Get handler
			const handler = this.handlers.get(job.type);
			if (!handler) {
				throw new Error(`No handler registered for job type: ${job.type}`);
			}

			// Execute handler
			const result = await handler(job);

			// Mark completed
			job.status = JOB_STATUS.COMPLETED;
			job.completedAt = Date.now();
			job.result = result;

			// Update stats
			const processingTime = job.completedAt - job.startedAt;
			this.stats.totalProcessed++;
			this.stats.processingTimes.push(processingTime);
			if (this.stats.processingTimes.length > 100) {
				this.stats.processingTimes.shift();
			}
			this.stats.avgProcessingTime = Math.round(
				this.stats.processingTimes.reduce((a, b) => a + b, 0) /
					this.stats.processingTimes.length,
			);

			console.log(`✅ Job completed: ${jobId} in ${processingTime}ms`);

			// Notify result
			await this.notifyJobResult(job, result, null);

			return result;
		} catch (error) {
			job.status = JOB_STATUS.FAILED;
			job.completedAt = Date.now();
			job.error = error.message;
			this.stats.totalFailed++;

			console.error(`❌ Job failed: ${jobId}:`, error.message);

			// Notify error
			await this.notifyJobResult(job, null, error);

			throw error;
		}
	}

	/**
	 * Notify user that job started
	 */
	async notifyJobStarted(job) {
		if (!this.bot) return;

		try {
			if (job.messageId) {
				// Edit existing message
				await this.bot.telegram.editMessageText(
					job.chatId,
					job.messageId,
					null,
					"🔄 *Processing your request...*\n\n_This may take up to 30 seconds._",
					{ parse_mode: "Markdown" },
				);
			}
		} catch (_e) {
			// Ignore edit errors
		}
	}

	/**
	 * Notify user of job result
	 */
	async notifyJobResult(_job, _result, _error) {
		// This is handled by the job handler itself
		// The handler should send the final message to the user
	}

	/**
	 * Get job position in queue
	 */
	getPosition(jobId) {
		const job = this.jobs.get(jobId);
		if (!job || job.status !== JOB_STATUS.QUEUED) {
			return 0;
		}

		// Count jobs with same or higher priority that are ahead
		let position = 1;
		for (const [_id, j] of this.jobs.entries()) {
			if (
				j.status === JOB_STATUS.QUEUED &&
				j.createdAt < job.createdAt &&
				j.priority <= job.priority
			) {
				position++;
			}
		}

		return position;
	}

	/**
	 * Get estimated wait time in seconds
	 */
	getEstimatedWait(jobId) {
		const position = this.getPosition(jobId);
		if (position === 0) return 0;

		const avgTime = this.stats.avgProcessingTime || 15000; // Default 15s
		const concurrency = CONFIG.MAX_PUPPETEER_CONCURRENCY;

		return Math.ceil((position * avgTime) / (concurrency * 1000));
	}

	/**
	 * Cancel a job
	 */
	cancel(jobId) {
		const job = this.jobs.get(jobId);
		if (!job) return false;

		if (job.status === JOB_STATUS.QUEUED) {
			job.status = JOB_STATUS.CANCELLED;
			job.completedAt = Date.now();
			console.log(`🚫 Job cancelled: ${jobId}`);
			return true;
		}

		return false;
	}

	/**
	 * Get queue statistics
	 */
	getStats() {
		return {
			heavyQueue: {
				pending: this.heavyQueue.pending,
				running: this.heavyQueue.pending - this.heavyQueue.size,
				size: this.heavyQueue.size,
			},
			lightQueue: {
				pending: this.lightQueue.pending,
				running: this.lightQueue.pending - this.lightQueue.size,
				size: this.lightQueue.size,
			},
			jobs: {
				total: this.jobs.size,
				queued: [...this.jobs.values()].filter(
					(j) => j.status === JOB_STATUS.QUEUED,
				).length,
				processing: [...this.jobs.values()].filter(
					(j) => j.status === JOB_STATUS.PROCESSING,
				).length,
			},
			stats: {
				totalProcessed: this.stats.totalProcessed,
				totalFailed: this.stats.totalFailed,
				totalTimeout: this.stats.totalTimeout,
				avgProcessingTime: this.stats.avgProcessingTime,
			},
			users: this.userJobs.size,
		};
	}

	/**
	 * Check if queue is overloaded
	 */
	isOverloaded() {
		const heavyPending = this.heavyQueue.pending;
		const heavySize = this.heavyQueue.size;

		// Overloaded if more than 20 heavy jobs waiting
		return heavyPending > 20 || heavySize > 15;
	}

	/**
	 * Cleanup completed/stale jobs
	 */
	cleanup() {
		const now = Date.now();
		const keysToDelete = [];

		for (const [jobId, job] of this.jobs.entries()) {
			// Remove completed jobs older than 5 minutes
			if (
				job.status === JOB_STATUS.COMPLETED ||
				job.status === JOB_STATUS.FAILED ||
				job.status === JOB_STATUS.CANCELLED ||
				job.status === JOB_STATUS.TIMEOUT
			) {
				if (now - job.completedAt > CONFIG.STALE_JOB_CLEANUP) {
					keysToDelete.push(jobId);
				}
			}

			// Remove stale queued jobs (older than 10 minutes)
			if (job.status === JOB_STATUS.QUEUED) {
				if (now - job.createdAt > 600000) {
					job.status = JOB_STATUS.TIMEOUT;
					job.completedAt = now;
					keysToDelete.push(jobId);
				}
			}
		}

		// Delete jobs
		for (const jobId of keysToDelete) {
			const job = this.jobs.get(jobId);
			if (job) {
				const userJobs = this.userJobs.get(job.userId);
				if (userJobs) {
					userJobs.delete(jobId);
					if (userJobs.size === 0) {
						this.userJobs.delete(job.userId);
					}
				}
			}
			this.jobs.delete(jobId);
		}

		if (keysToDelete.length > 0) {
			console.log(`🧹 Cleaned up ${keysToDelete.length} stale jobs`);
		}
	}

	/**
	 * Log queue statistics
	 */
	logStats() {
		const stats = this.getStats();
		if (stats.heavyQueue.pending > 0 || stats.lightQueue.pending > 0) {
			console.log(
				`📊 Queue: Heavy[${stats.heavyQueue.pending}] Light[${stats.lightQueue.pending}] | ` +
					`Processed: ${stats.stats.totalProcessed} | Avg: ${stats.stats.avgProcessingTime}ms`,
			);
		}
	}

	/**
	 * Shutdown queues gracefully
	 */
	async shutdown() {
		console.log("📋 Shutting down job queue...");

		clearInterval(this.cleanupInterval);
		clearInterval(this.statsInterval);

		// Wait for current jobs to complete
		await Promise.all([this.heavyQueue.onIdle(), this.lightQueue.onIdle()]);

		console.log("📋 Job queue shutdown complete");
	}
}

// ==================== SINGLETON INSTANCE ====================
export const jobQueue = new JobQueue();

// ==================== HELPER FUNCTIONS ====================

/**
 * Format queue position message for user
 */
export function formatQueueMessage(position, estimatedWait, isPremium = false) {
	if (position <= 0) {
		return "🔄 *Processing your request...*";
	}

	const priorityNote = isPremium ? "⚡ _Premium Priority Active_" : "";

	return `⏳ *Request Queued*

Your position: **#${position}**
Estimated wait: ~**${estimatedWait}** seconds

${priorityNote}
_You'll receive the result when ready._`.trim();
}

/**
 * Check if a job type is heavy (requires Puppeteer)
 */
export function isHeavyJob(jobType) {
	return HEAVY_JOB_TYPES.has(jobType);
}

export default jobQueue;
