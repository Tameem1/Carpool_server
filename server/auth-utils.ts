import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// For passwords that are already hashed (contain a dot separator)
function isAlreadyHashed(password: string): boolean {
  return password.includes('.') && password.length > 50;
}

// Hash a plain text password
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

// Verify password against hash - handles bcrypt, custom format, and plain text
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  // For bcrypt hashed passwords (most secure format)
  if (hashedPassword.startsWith('$2b$') || hashedPassword.startsWith('$2a$') || hashedPassword.startsWith('$2y$')) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
  
  // For plain text passwords (numeric), compare directly during migration period
  if (/^\d+$/.test(hashedPassword) && hashedPassword.length < 20) {
    return plainPassword === hashedPassword;
  }
  
  // For custom hash format (legacy format with dot separator)
  if (hashedPassword.includes('.') && hashedPassword.length > 100) {
    const [hash, salt] = hashedPassword.split('.');
    if (hash && salt) {
      try {
        const testHash = crypto.pbkdf2Sync(plainPassword, Buffer.from(salt, 'hex'), 100000, 64, 'sha512');
        return testHash.toString('hex') === hash;
      } catch {
        return false;
      }
    }
  }
  
  // Fallback: try bcrypt in case format detection fails
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch {
    return false;
  }
}

// Check if a password needs to be migrated from plain text to hashed
export function needsPasswordMigration(password: string): boolean {
  return /^\d+$/.test(password) && password.length < 50;
}

// Get unique sections from user data
export function getUniqueSections(users: any[]): string[] {
  const sections = users.map(user => user.section).filter(Boolean);
  return Array.from(new Set(sections)).sort();
}

// Get users by section
export function getUsersBySection(users: any[], section: string): any[] {
  return users.filter(user => user.section === section).sort((a, b) => a.username.localeCompare(b.username));
}