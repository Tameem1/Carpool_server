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

// Verify password against hash - handles both bcrypt and custom format
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  console.log('Password verification attempt:', { plainPassword, hashedPassword, hashedLength: hashedPassword.length });
  
  // If the stored password is already in the custom hash format (contains a dot)
  if (isAlreadyHashed(hashedPassword)) {
    console.log('Using custom hash format verification');
    // For existing hashed passwords, we need to handle the custom format
    // The format appears to be: hash.salt
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch {
      // If bcrypt fails, try the custom format verification
      const [hash, salt] = hashedPassword.split('.');
      if (hash && salt) {
        const testHash = crypto.pbkdf2Sync(plainPassword, Buffer.from(salt, 'hex'), 100000, 64, 'sha512');
        return testHash.toString('hex') === hash;
      }
      return false;
    }
  }
  
  // For plain text passwords (numeric), hash them first and then compare
  // This handles the migration case where some passwords are still plain text
  if (/^\d+$/.test(hashedPassword)) {
    console.log('Using plain text numeric password verification');
    const result = plainPassword === hashedPassword;
    console.log('Plain text comparison result:', result);
    return result;
  }
  
  // Standard bcrypt comparison
  console.log('Using standard bcrypt verification');
  return await bcrypt.compare(plainPassword, hashedPassword);
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