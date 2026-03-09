/**
 * Identity Service v2
 * Generates realistic profiles (Name, Bio) for accounts using AI
 */

import fetch from 'node-fetch';

const FIRST_NAMES = {
    male_fa: ['Ali', 'Reza', 'Mohammad', 'Amir', 'Hossein', 'Mehdi', 'Saeed', 'Vahid', 'Farhad', 'Kourosh', 'Arash', 'Babak', 'Saman', 'Nima', 'Parsa'],
    female_fa: ['Sara', 'Maryam', 'Fatemeh', 'Zahra', 'Narges', 'Mina', 'Samira', 'Parisa', 'Ayalr', 'Negar', 'Hasti', 'Rozha', 'Donya', 'Bita'],
    male_en: ['John', 'David', 'Michael', 'Chris', 'James', 'Robert', 'William', 'Daniel', 'Ryan', 'Kevin', 'Alex', 'Brian', 'Eric', 'Scott'],
    female_en: ['Sarah', 'Emily', 'Jessica', 'Jennifer', 'Laura', 'Megan', 'Rachel', 'Amy', 'Nicole', 'Elizabeth', 'Lisa', 'Michelle', 'Amanda']
};

const LAST_NAMES = {
    fa: ['Rad', 'Tehrani', 'Irani', 'Karimi', 'Rahimi', 'Hosseini', 'Mohammadi', 'Alizadeh', 'Rezaei', 'Jafari', 'Sadeghi', 'Moradi', 'Ahmadi', 'Ebrahimi'],
    en: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez']
};

const BIOS = {
    crypto: ['💎 Crypto Enthusiast', '🚀 To the moon!', 'Bitcoin & ETH lover', 'DeFi & NFT Investor', 'Blockchain Developer', 'HODL 4 Life', 'Trader | Investor | Dreamer'],
    developer: ['💻 Code is Life', 'Full Stack Developer', 'Python & JS', 'Building the future', 'Open Source Contributor', 'Tech Geek 🤖', 'Debugging my life...'],
    general: ['Just living life', 'Dream Big ✨', 'Music 🎧 | Travel ✈️', 'Positive Vibes Only', 'Carpe Diem', 'Learning every day', 'Silence is gold'],
    fa_general: ['خدا برایم کافیست', 'زندگی زیباست...', 'هدف من: موفقیت', 'عاشق سفر و طبیعت 🌿', 'سکوت سرشار از ناگفته‌هاست', 'خنده بر هر درد بی درمان دواست', 'خدایا شکرت ❤️']
};

/**
 * Generate a random identity (Static fallback)
 */
export function generateIdentity(type = 'random') {
    const isPersian = type === 'persian' || (type === 'random' && Math.random() > 0.5);
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    let firstName, lastName, bio;

    if (isPersian) {
        firstName = getRandom(FIRST_NAMES[`${gender}_fa`]);
        lastName = getRandom(LAST_NAMES.fa);
        bio = type === 'crypto' || type === 'developer' ? getRandom(BIOS[type]) : getRandom(BIOS.fa_general);
    } else {
        firstName = getRandom(FIRST_NAMES[`${gender}_en`]);
        lastName = getRandom(LAST_NAMES.en);
        bio = type === 'crypto' || type === 'developer' ? getRandom(BIOS[type]) : getRandom(BIOS.general);
    }

    if (Math.random() > 0.8) lastName += Math.floor(Math.random() * 99);

    return { firstName, lastName, bio, fullName: `${firstName} ${lastName}` };
}

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function generateBatch(count, type = 'random') {
    const batch = [];
    for (let i = 0; i < count; i++) {
        batch.push(generateIdentity(type));
    }
    return batch;
}


export default {
    generateIdentity,
    generateBatch
};


