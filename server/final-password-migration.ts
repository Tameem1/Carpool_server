import { db } from "./db";
import { users } from "@shared/schema";
import { sql } from "drizzle-orm";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

async function completePasswordMigration() {
  console.log("Starting final password migration...");
  
  // First, migrate all remaining plain numeric passwords using batch processing
  const batchSize = 50;
  let totalMigrated = 0;
  
  while (true) {
    // Get a batch of plain numeric passwords
    const plainUsers = await db.execute(sql`
      SELECT id, username, password 
      FROM users 
      WHERE password ~ '^[0-9]+$' AND LENGTH(password) < 20
      LIMIT ${batchSize}
    `);
    
    if (plainUsers.rows.length === 0) {
      console.log("No more plain numeric passwords to migrate");
      break;
    }
    
    console.log(`Processing batch of ${plainUsers.rows.length} plain passwords...`);
    
    // Process each user in the batch
    for (const user of plainUsers.rows) {
      const hashedPassword = await bcrypt.hash(user.password as string, 12);
      await db.execute(sql`
        UPDATE users 
        SET password = ${hashedPassword}
        WHERE id = ${user.id}
      `);
    }
    
    totalMigrated += plainUsers.rows.length;
    console.log(`Migrated ${totalMigrated} plain numeric passwords so far`);
  }
  
  console.log(`Completed migration of ${totalMigrated} plain numeric passwords`);
  
  // Now handle custom hash passwords
  const customHashUsers = await db.execute(sql`
    SELECT id, username, password 
    FROM users 
    WHERE password LIKE '%.%' AND LENGTH(password) > 100
  `);
  
  console.log(`Found ${customHashUsers.rows.length} custom hash passwords to migrate`);
  
  for (const user of customHashUsers.rows) {
    try {
      const password = user.password as string;
      const [hash, salt] = password.split('.');
      
      // Try to reverse engineer some common passwords
      let foundPassword = null;
      const commonPatterns = [
        '123456', '111111', '222222', '333333', '444444', '555555',
        '666666', '777777', '888888', '999999', '000000',
        '123123', '654321', '987654'
      ];
      
      // Test common patterns first
      for (const testPassword of commonPatterns) {
        try {
          const testHash = crypto.pbkdf2Sync(testPassword, Buffer.from(salt, 'hex'), 100000, 64, 'sha512');
          if (testHash.toString('hex') === hash) {
            foundPassword = testPassword;
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      // If common patterns don't work, generate a new secure password
      if (!foundPassword) {
        foundPassword = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`Generated new password for ${user.username}: ${foundPassword}`);
      } else {
        console.log(`Recovered password for ${user.username}: ${foundPassword}`);
      }
      
      const hashedPassword = await bcrypt.hash(foundPassword, 12);
      await db.execute(sql`
        UPDATE users 
        SET password = ${hashedPassword}
        WHERE id = ${user.id}
      `);
      
    } catch (error) {
      console.error(`Error processing custom hash for user ${user.username}:`, error);
      // Generate a fallback password
      const fallbackPassword = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedPassword = await bcrypt.hash(fallbackPassword, 12);
      await db.execute(sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${user.id}`);
      console.log(`Generated fallback password for ${user.username}: ${fallbackPassword}`);
    }
  }
  
  console.log("Migration completed!");
  
  // Final verification
  const finalAnalysis = await db.execute(sql`
    SELECT 
      CASE 
        WHEN password ~ '^[0-9]+$' AND LENGTH(password) < 20 THEN 'plain_numeric'
        WHEN password LIKE '%.%' AND LENGTH(password) > 100 THEN 'custom_hash'
        WHEN password LIKE '$2b$%' OR password LIKE '$2a$%' THEN 'bcrypt'
        ELSE 'other'
      END as password_type,
      COUNT(*) as count
    FROM users 
    GROUP BY password_type
    ORDER BY count DESC
  `);
  
  console.log("Final password analysis:");
  finalAnalysis.rows.forEach((row: any) => {
    console.log(`${row.password_type}: ${row.count}`);
  });
  
  const remainingPlain = finalAnalysis.rows.find((r: any) => r.password_type === 'plain_numeric')?.count || 0;
  const remainingCustom = finalAnalysis.rows.find((r: any) => r.password_type === 'custom_hash')?.count || 0;
  
  if (remainingPlain === 0 && remainingCustom === 0) {
    console.log("SUCCESS: All passwords are now properly hashed with bcrypt!");
    return true;
  } else {
    console.log(`WARNING: ${remainingPlain} plain and ${remainingCustom} custom passwords still remain`);
    return false;
  }
}

async function main() {
  try {
    const success = await completePasswordMigration();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();