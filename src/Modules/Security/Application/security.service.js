/**
 * Security Utilities
 * Encryption, validation, and security helpers
 */

import crypto from 'crypto';

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data');
const KEY_FILE = path.join(DATA_DIR, 'encryption.key');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getEncryptionKey() {
    // 1. Try Environment Variable
    if (process.env.SESSION_ENCRYPTION_KEY) {
        return process.env.SESSION_ENCRYPTION_KEY;
    }

    // 2. Try Key File
    if (fs.existsSync(KEY_FILE)) {
        try {
            return fs.readFileSync(KEY_FILE, 'utf8').trim();
        } catch (e) {
            console.error('Failed to read encryption key file:', e);
        }
    }

    // 3. Generate New Key and Save
    const newKey = crypto.randomBytes(32).toString('hex');
    try {
        fs.writeFileSync(KEY_FILE, newKey);
        console.warn('⚠️ New encryption key generated (old encrypted sessions are now invalid)');
    } catch (e) {
        console.error('CRITICAL: Failed to save encryption key:', e);
    }
    return newKey;
}

// Encryption key init
const ENCRYPTION_KEY = getEncryptionKey();

const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt sensitive data
 */
export function encrypt(text) {
    if (!text) return '';
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0'));
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error.message);
        return text; // Fallback to plain text if encryption fails
    }
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedText) {
    if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
    try {
        const [ivHex, encrypted] = encryptedText.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0'));
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error.message);
        return encryptedText; // Return as-is if decryption fails
    }
}

/**
 * Validate Telegram Session String
 * Session strings are base64 encoded and have specific structure
 */
export function isValidSessionString(session) {
    if (!session || typeof session !== 'string') return false;

    // Minimum length check (real sessions are usually 300+ chars)
    if (session.length < 100) return false;

    // Check if it's base64-like (alphanumeric + /+=)
    if (!/^[A-Za-z0-9+/=]+$/.test(session.trim())) return false;

    // Try to decode and check structure
    try {
        const decoded = Buffer.from(session.trim(), 'base64');
        // Valid sessions decode to at least 50 bytes
        return decoded.length >= 50;
    } catch {
        return false;
    }
}

/**
 * Validate phone number (international format)
 */
export function isValidPhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return false;

    // Clean the phone number
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');

    // International format: + followed by 7-15 digits
    return /^\+?[1-9]\d{6,14}$/.test(cleaned);
}

/**
 * Sanitize error message to prevent information leakage
 */
export function sanitizeError(error) {
    const message = error?.message || String(error);

    // Patterns that might leak sensitive info
    const sensitivePatterns = [
        /session[:\s]*[A-Za-z0-9+/=]+/gi,
        /token[:\s]*[A-Za-z0-9:_-]+/gi,
        /password[:\s]*\S+/gi,
        /api[_\s]*(id|hash)[:\s]*\S+/gi,
        /\d{10,}/g // Long numbers (phone, IDs)
    ];

    let sanitized = message;
    for (const pattern of sensitivePatterns) {
        sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    // Common Telegram error translations
    const errorMap = {
        'PHONE_NUMBER_INVALID': 'شماره تلفن نامعتبر است',
        'PHONE_CODE_INVALID': 'کد تأیید نامعتبر است',
        'PHONE_CODE_EXPIRED': 'کد تأیید منقضی شده است',
        'SESSION_EXPIRED': 'نشست منقضی شده. لطفاً دوباره وارد شوید',
        'AUTH_KEY_UNREGISTERED': 'اکانت غیرفعال شده است',
        'USER_DEACTIVATED': 'اکانت غیرفعال شده است',
        'USER_DEACTIVATED_BAN': 'اکانت مسدود شده است',
        'FLOOD_WAIT': 'تعداد درخواست‌ها زیاد است. لطفاً صبر کنید',
        'TOO_MANY_REQUESTS': 'تعداد درخواست‌ها زیاد است',
        'CONNECTION_ERROR': 'خطا در اتصال به سرور',
        'TIMEOUT': 'زمان انتظار به پایان رسید'
    };

    for (const [key, value] of Object.entries(errorMap)) {
        if (sanitized.toUpperCase().includes(key)) {
            return value;
        }
    }

    // If message is too technical, return generic error
    if (sanitized.length > 100 || /[{}[\]<>]/.test(sanitized)) {
        return 'خطایی رخ داد. لطفاً دوباره تلاش کنید';
    }

    return sanitized;
}

/**
 * Encrypt data with user provided password (PBKDF2 + AES-256-GCM)
 */
export async function encryptWithPassword(data, password) {
    if (!data || !password) throw new Error('Data and password required');

    // Generate random salt and iv
    const salt = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    // Derive key
    const key = await new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey);
        });
    });

    // Encrypt
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // Return as combined string: version:salt:iv:authTag:encrypted
    return `v1:${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt data with user provided password
 */
export async function decryptWithPassword(encryptedString, password) {
    if (!encryptedString || !password) throw new Error('Data and password required');

    const parts = encryptedString.split(':');
    if (parts.length !== 5 || parts[0] !== 'v1') {
        throw new Error('Invalid encrypted format or version');
    }

    const [version, saltHex, ivHex, authTagHex, encrypted] = parts;

    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    // Derive key
    const key = await new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey);
        });
    });

    // Decrypt
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
}

/**
 * Rate limiter with sliding window
 */
class RateLimiter {
    constructor() {
        this.requests = new Map(); // userId -> { count, windowStart }
        this.limits = {
            default: { requests: 30, windowMs: 60000 }, // 30 per minute
            sensitive: { requests: 5, windowMs: 60000 }, // 5 per minute for sensitive ops
            bulk: { requests: 3, windowMs: 300000 } // 3 per 5 minutes for bulk ops
        };
    }

    check(userId, type = 'default') {
        const limit = this.limits[type] || this.limits.default;
        const now = Date.now();
        const key = `${userId}:${type}`;

        let record = this.requests.get(key);

        if (!record || now - record.windowStart > limit.windowMs) {
            // New window
            record = { count: 0, windowStart: now };
        }

        if (record.count >= limit.requests) {
            const waitTime = Math.ceil((limit.windowMs - (now - record.windowStart)) / 1000);
            return { allowed: false, waitSeconds: waitTime };
        }

        record.count++;
        this.requests.set(key, record);

        return { allowed: true };
    }

    // Cleanup old entries periodically
    cleanup() {
        const now = Date.now();
        for (const [key, record] of this.requests.entries()) {
            if (now - record.windowStart > 600000) { // 10 minutes
                this.requests.delete(key);
            }
        }
    }
}

export const rateLimiter = new RateLimiter();

// Cleanup every 5 minutes
setInterval(() => rateLimiter.cleanup(), 300000);

/**
 * Promise with timeout
 */
export function withTimeout(promise, ms, errorMessage = 'عملیات به پایان رسید') {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), ms)
        )
    ]);
}

/**
 * Retry with exponential backoff
 */
export async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry on certain errors
            const noRetryPatterns = ['INVALID', 'EXPIRED', 'DEACTIVATED', 'BAN'];
            if (noRetryPatterns.some(p => error.message?.toUpperCase().includes(p))) {
                throw error;
            }

            if (attempt < maxRetries - 1) {
                const delay = baseDelay * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

/**
 * Hash sensitive data for logging
 */
export function hashForLog(data) {
    if (!data) return 'null';
    const hash = crypto.createHash('sha256').update(String(data)).digest('hex');
    return hash.slice(0, 8) + '...';
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

export default {
    encrypt,
    decrypt,
    isValidSessionString,
    isValidPhoneNumber,
    sanitizeError,
    encryptWithPassword,
    decryptWithPassword,
    rateLimiter,
    withTimeout,
    withRetry,
    hashForLog,
    generateSecureToken
};
