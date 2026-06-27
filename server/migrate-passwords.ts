import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

interface PasswordMigrationStats {
  totalUsers: number;
  plainNumericMigrated: number;
  customHashMigrated: number;
  alreadyBcrypt: number;
  errors: number;
}

async function isCustomHashFormat(password: string): Promise<boolean> {
  return password.includes('.') && password.length > 100;
}

async function isPlainNumeric(password: string): Promise<boolean> {
  return /^\d+$/.test(password) && password.length < 20;
}

async function isBcryptHash(password: string): Promise<boolean> {
  return password.startsWith('$2b$') || password.startsWith('$2a$') || password.startsWith('$2y$');
}

async function extractPlainTextFromCustomHash(hashedPassword: string, possiblePlainTexts: string[]): Promise<string | null> {
  // For custom hash format, we need to try common patterns or known passwords
  // Since we can't reverse the hash, we'll try common numeric patterns
  const [hash, salt] = hashedPassword.split('.');
  if (!hash || !salt) return null;

  // Try the user's potential plain passwords (we'll extract these from other users with similar patterns)
  for (const plainText of possiblePlainTexts) {
    try {
      const testHash = crypto.pbkdf2Sync(plainText, Buffer.from(salt, 'hex'), 100000, 64, 'sha512');
      if (testHash.toString('hex') === hash) {
        return plainText;
      }
    } catch (error) {
      // Continue trying other possibilities
    }
  }
  
  return null;
}

async function generateCommonPasswordCandidates(): Promise<string[]> {
  // Get all plain numeric passwords that might be similar patterns
  const plainPasswords = await db.select({ password: users.password })
    .from(users)
    .where(eq(users.password, users.password)); // Get all passwords
  
  return plainPasswords
    .filter(p => /^\d+$/.test(p.password) && p.password.length < 20)
    .map(p => p.password)
    .slice(0, 1000); // Limit to avoid performance issues
}

async function migrateAllPasswords(): Promise<PasswordMigrationStats> {
  console.log("🔐 Starting comprehensive password migration...");
  
  const stats: PasswordMigrationStats = {
    totalUsers: 0,
    plainNumericMigrated: 0,
    customHashMigrated: 0,
    alreadyBcrypt: 0,
    errors: 0
  };

  try {
    // Get all users
    const allUsers = await db.select().from(users);
    stats.totalUsers = allUsers.length;
    console.log(`📊 Found ${allUsers.length} users to process`);

    // Get common password candidates for custom hash reversal attempts
    const passwordCandidates = await generateCommonPasswordCandidates();
    console.log(`🔍 Generated ${passwordCandidates.length} password candidates for custom hash testing`);

    for (const user of allUsers) {
      try {
        console.log(`\n👤 Processing user: ${user.username} (ID: ${user.id})`);
        
        if (await isBcryptHash(user.password)) {
          console.log(`  ✅ Already using bcrypt - skipping`);
          stats.alreadyBcrypt++;
          continue;
        }

        let newHashedPassword: string | null = null;

        if (await isPlainNumeric(user.password)) {
          console.log(`  🔢 Plain numeric password detected: ${user.password}`);
          newHashedPassword = await bcrypt.hash(user.password, 12);
          stats.plainNumericMigrated++;
        } 
        else if (await isCustomHashFormat(user.password)) {
          console.log(`  🔧 Custom hash format detected - attempting to find original password`);
          
          // Try to find the original password by testing against common patterns
          const originalPassword = await extractPlainTextFromCustomHash(user.password, passwordCandidates);
          
          if (originalPassword) {
            console.log(`  ✅ Successfully recovered original password: ${originalPassword}`);
            newHashedPassword = await bcrypt.hash(originalPassword, 12);
            stats.customHashMigrated++;
          } else {
            console.log(`  ⚠️  Could not recover original password - generating new random password`);
            // Generate a new secure password since we can't recover the original
            const newPassword = Math.floor(100000 + Math.random() * 900000).toString();
            newHashedPassword = await bcrypt.hash(newPassword, 12);
            console.log(`  🔑 New password for user ${user.username}: ${newPassword} (SAVE THIS!)`);
            stats.customHashMigrated++;
          }
        }

        if (newHashedPassword) {
          // Update the user with the new bcrypt password
          await db
            .update(users)
            .set({ password: newHashedPassword })
            .where(eq(users.id, user.id));
          
          console.log(`  ✅ Successfully updated password for user: ${user.username}`);
        }

      } catch (error) {
        console.error(`  ❌ Error processing user ${user.username}:`, error);
        stats.errors++;
      }
    }

    console.log("\n🎉 Password migration completed!");
    console.log("📈 Migration Statistics:");
    console.log(`  Total users processed: ${stats.totalUsers}`);
    console.log(`  Plain numeric passwords migrated: ${stats.plainNumericMigrated}`);
    console.log(`  Custom hash passwords migrated: ${stats.customHashMigrated}`);
    console.log(`  Already using bcrypt: ${stats.alreadyBcrypt}`);
    console.log(`  Errors encountered: ${stats.errors}`);

    return stats;

  } catch (error) {
    console.error("💥 Fatal error during password migration:", error);
    throw error;
  }
}

// Verification function to check migration success
async function verifyMigration(): Promise<void> {
  console.log("\n🔍 Verifying password migration...");
  
  const passwordTypes = await db.select({
    password: users.password
  }).from(users);

  const analysis = {
    bcrypt: 0,
    plainNumeric: 0,
    customHash: 0,
    other: 0
  };

  for (const user of passwordTypes) {
    if (await isBcryptHash(user.password)) {
      analysis.bcrypt++;
    } else if (await isPlainNumeric(user.password)) {
      analysis.plainNumeric++;
    } else if (await isCustomHashFormat(user.password)) {
      analysis.customHash++;
    } else {
      analysis.other++;
    }
  }

  console.log("✅ Post-migration password analysis:");
  console.log(`  Bcrypt passwords: ${analysis.bcrypt}`);
  console.log(`  Plain numeric passwords: ${analysis.plainNumeric}`);
  console.log(`  Custom hash passwords: ${analysis.customHash}`);
  console.log(`  Other formats: ${analysis.other}`);

  if (analysis.plainNumeric === 0 && analysis.customHash === 0) {
    console.log("🎉 SUCCESS: All passwords are now properly hashed with bcrypt!");
  } else {
    console.log("⚠️  WARNING: Some passwords may still need migration");
  }
}

// Main execution
async function main() {
  try {
    const stats = await migrateAllPasswords();
    await verifyMigration();
    
    console.log("\n🏁 Migration process completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  }
}

// Run the migration
main();

export { migrateAllPasswords, verifyMigration };