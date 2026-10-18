// src/app/adminConfig.js
// Put YOUR Google account email here (lowercase). Only this account can open /admin.
// IMPORTANT: put the same email inside firestore.rules too (that is the real security).
export const ADMIN_EMAILS = ["shaakyarishmika@gmail.com"];

export const isAdminEmail = (email) => ADMIN_EMAILS.includes((email || "").toLowerCase());
