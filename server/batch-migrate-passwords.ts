import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

async function batchMigratePasswords() {
  console.log("Starting batch password migration...");
  
  try {
    // Get all users with plain numeric passwords
    const plainNumericUsers = await db.select()
      .from(users)
      .where(eq(users.password, users.password)); // Get all users first
    
    const usersToMigrate = plainNumericUsers.filter(user => 
      /^\d+$/.test(user.password) && user.password.length < 20
    );
    
    console.log(`Found ${usersToMigrate.length} users with plain numeric passwords to migrate`);
    
    // Process in batches of 10
    const batchSize = 10;
    let migratedCount = 0;
    
    for (let i = 0; i < usersToMigrate.length; i += batchSize) {
      const batch = usersToMigrate.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(usersToMigrate.length/batchSize)}...`);
      
      const updatePromises = batch.map(async (user) => {
        const hashedPassword = await bcrypt.hash(user.password, 12);
        return db
          .update(users)
          .set({ password: hashedPassword })
          .where(eq(users.id, user.id));
      });
      
      await Promise.all(updatePromises);
      migratedCount += batch.length;
      console.log(`Migrated ${migratedCount}/${usersToMigrate.length} users`);
    }
    
    console.log(`Successfully migrated ${migratedCount} plain numeric passwords to bcrypt`);
    
    // Now handle custom hash passwords
    const customHashUsers = await db.select()
      .from(users)
      .where(eq(users.password, users.password));
    
    const customHashToMigrate = customHashUsers.filter(user => 
      user.password.includes('.') && user.password.length > 100
    );
    
    console.log(`Found ${customHashToMigrate.length} users with custom hash passwords`);
    
    // For custom hash, we'll try to extract the original password by testing common patterns
    for (const user of customHashToMigrate) {
      try {
        const [hash, salt] = user.password.split('.');
        if (!hash || !salt) continue;
        
        // Try common 6-digit patterns that might match
        let originalPassword = null;
        
        // Try sequential numbers
        for (let testNum = 100000; testNum <= 999999; testNum += 111) {
          const testPassword = testNum.toString();
          try {
            const testHash = crypto.pbkdf2Sync(testPassword, Buffer.from(salt, 'hex'), 100000, 64, 'sha512');
            if (testHash.toString('hex') === hash) {
              originalPassword = testPassword;
              break;
            }
          } catch (e) {
            // Continue trying
          }
          
          // Don't spend too much time on each user
          if (testNum > 100000 + 10000) break;
        }
        
        if (originalPassword) {
          const hashedPassword = await bcrypt.hash(originalPassword, 12);
          await db
            .update(users)
            .set({ password: hashedPassword })
            .where(eq(users.id, user.id));
          console.log(`Migrated custom hash for user ${user.username} with password ${originalPassword}`);
        } else {
          // Generate a new password if we can't recover the original
          const newPassword = Math.floor(100000 + Math.random() * 900000).toString();
          const hashedPassword = await bcrypt.hash(newPassword, 12);
          await db
            .update(users)
            .set({ password: hashedPassword })
            .where(eq(users.id, user.id));
          console.log(`Generated new password for ${user.username}: ${newPassword} (SAVE THIS!)`);
        }
      } catch (error) {
        console.error(`Error processing custom hash for user ${user.username}:`, error);
      }
    }
    
    console.log("Batch migration completed!");
    
  } catch (error) {
    console.error("Batch migration failed:", error);
    throw error;
  }
}

// Verification function
async function verifyAllPasswords() {
  const allUsers = await db.select({ password: users.password }).from(users);
  
  const analysis = {
    bcrypt: 0,
    plainNumeric: 0,
    customHash: 0,
    other: 0
  };
  
  for (const user of allUsers) {
    if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
      analysis.bcrypt++;
    } else if (/^\d+$/.test(user.password) && user.password.length < 20) {
      analysis.plainNumeric++;
    } else if (user.password.includes('.') && user.password.length > 100) {
      analysis.customHash++;
    } else {
      analysis.other++;
    }
  }
  
  console.log("Final password analysis:");
  console.log(`Bcrypt passwords: ${analysis.bcrypt}`);
  console.log(`Plain numeric passwords: ${analysis.plainNumeric}`);
  console.log(`Custom hash passwords: ${analysis.customHash}`);
  console.log(`Other formats: ${analysis.other}`);
  
  if (analysis.plainNumeric === 0 && analysis.customHash === 0) {
    console.log("SUCCESS: All passwords are now properly hashed with bcrypt!");
  } else {
    console.log("WARNING: Some passwords may still need migration");
  }
}

// Main execution
async function main() {
  try {
    await batchMigratePasswords();
    await verifyAllPasswords();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();