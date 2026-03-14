/**
 * Profile Manager Service
 * Handles profile templates for Telegram accounts
 */

import fs from "node:fs/promises";
import path from "node:path";
import { profiles } from "../../../database/panelDatabase.js";
import * as accountManager from "./account-manager.service.js";

const PROFILE_DIR = path.join(process.cwd(), "data", "profiles");

// Ensure profile directory exists
async function ensureProfileDir() {
	try {
		await fs.mkdir(PROFILE_DIR, { recursive: true });
	} catch (_e) {}
}

// ==================== PROFILE CRUD ====================

/**
 * Add a new profile manually
 */
export function addProfile(
	firstName,
	lastName = "",
	bio = "",
	photoPath = "",
	username = "",
) {
	return profiles.add(firstName, lastName, bio, photoPath, username);
}

/**
 * Add profiles from text (bulk import)
 * Format: firstName|lastName|bio (one per line)
 */
export function addProfilesFromText(text) {
	const lines = text
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l);
	const result = { success: 0, failed: 0, errors: [] };

	for (const line of lines) {
		try {
			const parts = line.split("|").map((p) => p.trim());
			const firstName = parts[0] || "";
			const lastName = parts[1] || "";
			const bio = parts[2] || "";

			if (!firstName) {
				result.failed++;
				result.errors.push(`Empty first name: ${line}`);
				continue;
			}

			addProfile(firstName, lastName, bio);
			result.success++;
		} catch (error) {
			result.failed++;
			result.errors.push(`${line}: ${error.message}`);
		}
	}

	return result;
}

/**
 * Get all profiles
 */
export function getAllProfiles() {
	return profiles.getAll();
}

/**
 * Get a random unused profile
 */
export function getRandomProfile() {
	return profiles.getRandom();
}

/**
 * Get profile by ID
 */
export function getProfileById(id) {
	return profiles.getById(id);
}

/**
 * Mark profile as used
 */
export function markProfileAsUsed(id) {
	profiles.markAsUsed(id);
}

/**
 * Delete profile
 */
export function deleteProfile(id) {
	profiles.delete(id);
}

/**
 * Delete all profiles
 */
export function deleteAllProfiles() {
	profiles.deleteAll();
}

/**
 * Get profile count
 */
export function getProfileCount() {
	return profiles.count();
}

/**
 * Get unused profile count
 */
export function getUnusedProfileCount() {
	return profiles.countUnused();
}

// ==================== PROFILE EXTRACTION ====================

/**
 * Extract profile from a Telegram account
 */
export async function extractProfileFromAccount(phone) {
	try {
		const client = await accountManager.getClientByPhone(phone);
		if (!client) {
			return { success: false, error: "اکانت متصل نیست" };
		}

		const { Api } = await import("telegram");
		const me = await client.getMe();

		// Get profile photos
		let photoPath = "";
		try {
			const photos = await client.invoke(
				new Api.photos.GetUserPhotos({
					userId: me,
					offset: 0,
					maxId: 0,
					limit: 1,
				}),
			);

			if (photos.photos && photos.photos.length > 0) {
				await ensureProfileDir();
				const photoFileName = `profile_${phone.replace(/\+/g, "")}_${Date.now()}.jpg`;
				photoPath = path.join(PROFILE_DIR, photoFileName);

				const buffer = await client.downloadProfilePhoto(me);
				if (buffer) {
					await fs.writeFile(photoPath, buffer);
				}
			}
		} catch (e) {
			console.error("Error downloading profile photo:", e.message);
		}

		// Save to database
		const profileId = addProfile(
			me.firstName || "",
			me.lastName || "",
			me.about || "",
			photoPath,
			me.username || "",
		);

		return {
			success: true,
			profile: {
				id: profileId,
				firstName: me.firstName,
				lastName: me.lastName,
				bio: me.about,
				username: me.username,
				photoPath,
			},
		};
	} catch (error) {
		return { success: false, error: error.message };
	}
}

/**
 * Extract profiles from all connected accounts
 */
export async function extractProfilesFromAllAccounts() {
	const accounts = accountManager.getAccountList();
	const results = { success: 0, failed: 0, profiles: [] };

	for (const account of accounts) {
		if (account.status !== "active") continue;

		const result = await extractProfileFromAccount(account.phone);
		if (result.success) {
			results.success++;
			results.profiles.push(result.profile);
		} else {
			results.failed++;
		}
	}

	return results;
}

// ==================== PROFILE APPLICATION ====================

/**
 * Apply a profile to an account
 */
export async function applyProfileToAccount(phone, profileId) {
	try {
		const profile = getProfileById(profileId);
		if (!profile) {
			return { success: false, error: "پروفایل یافت نشد" };
		}

		const client = await accountManager.getClientByPhone(phone);
		if (!client) {
			return { success: false, error: "اکانت متصل نیست" };
		}

		const { Api } = await import("telegram");

		// Update name and bio
		await client.invoke(
			new Api.account.UpdateProfile({
				firstName: profile.first_name,
				lastName: profile.last_name || "",
				about: profile.bio || "",
			}),
		);

		// Update photo if exists
		if (profile.photo_path) {
			try {
				const photoBuffer = await fs.readFile(profile.photo_path);
				await client.invoke(
					new Api.photos.UploadProfilePhoto({
						file: await client.uploadFile({
							file: photoBuffer,
							name: "profile.jpg",
						}),
					}),
				);
			} catch (e) {
				console.error("Error uploading photo:", e.message);
			}
		}

		// Mark profile as used
		markProfileAsUsed(profileId);

		return { success: true };
	} catch (error) {
		return { success: false, error: error.message };
	}
}

/**
 * Apply random profile to account
 */
export async function applyRandomProfileToAccount(phone) {
	const profile = getRandomProfile();
	if (!profile) {
		return { success: false, error: "هیچ پروفایل استفاده نشده‌ای وجود ندارد" };
	}

	return applyProfileToAccount(phone, profile.id);
}

/**
 * Apply random profiles to all accounts
 */
export async function applyRandomProfilesToAllAccounts() {
	const accounts = accountManager.getAccountList();
	const results = { success: 0, failed: 0, errors: [] };

	for (const account of accounts) {
		if (account.status !== "active") continue;

		const result = await applyRandomProfileToAccount(account.phone);
		if (result.success) {
			results.success++;
		} else {
			results.failed++;
			results.errors.push(`${account.phone}: ${result.error}`);
		}
	}

	return results;
}

// ==================== STATISTICS ====================

/**
 * Get profile statistics
 */
export function getProfileStats() {
	return {
		total: getProfileCount(),
		unused: getUnusedProfileCount(),
		used: getProfileCount() - getUnusedProfileCount(),
	};
}

export default {
	addProfile,
	addProfilesFromText,
	getAllProfiles,
	getRandomProfile,
	getProfileById,
	markProfileAsUsed,
	deleteProfile,
	deleteAllProfiles,
	getProfileCount,
	getUnusedProfileCount,
	extractProfileFromAccount,
	extractProfilesFromAllAccounts,
	applyProfileToAccount,
	applyRandomProfileToAccount,
	applyRandomProfilesToAllAccounts,
	getProfileStats,
};
