import { db } from "./db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from 'bcryptjs';

async function completePasswordMigration() {
  console.log("Completing password migration for all remaining users...");
  
  // Get current status
  const currentStatus = await db.execute(sql`
    SELECT 
      CASE 
        WHEN password ~ '^[0-9]+$' AND LENGTH(password) < 20 THEN 'plain'
        WHEN password LIKE '%.%' AND LENGTH(password) > 100 THEN 'custom'
        WHEN password LIKE '$2b$%' THEN 'bcrypt'
        ELSE 'other'
      END as type,
      COUNT(*) as count
    FROM users 
    GROUP BY type
    ORDER BY count DESC
  `);
  
  console.log("Current password distribution:");
  currentStatus.rows.forEach((row: any) => {
    console.log(`${row.type}: ${row.count}`);
  });
  
  // Process remaining plain passwords in very small batches
  let totalProcessed = 0;
  const batchSize = 5;
  
  while (true) {
    const batch = await db.execute(sql`
      SELECT id, password 
      FROM users 
      WHERE password ~ '^[0-9]+$' AND LENGTH(password) < 20
      LIMIT ${batchSize}
    `);
    
    if (batch.rows.length === 0) break;
    
    for (const user of batch.rows) {
      const hashedPassword = await bcrypt.hash(user.password as string, 12);
      await db.execute(sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${user.id}`);
      totalProcessed++;
    }
    
    console.log(`Processed ${totalProcessed} passwords`);
    
    // Small delay to prevent overwhelming
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Handle custom hash passwords
  const customUsers = await db.execute(sql`
    SELECT id, username 
    FROM users 
    WHERE password LIKE '%.%' AND LENGTH(password) > 100
  `);
  
  for (const user of customUsers.rows) {
    const newPassword = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await db.execute(sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${user.id}`);
    console.log(`New password for ${user.username}: ${newPassword}`);
  }
  
  // Final verification
  const finalStatus = await db.execute(sql`
    SELECT 
      CASE 
        WHEN password ~ '^[0-9]+$' AND LENGTH(password) < 20 THEN 'plain'
        WHEN password LIKE '%.%' AND LENGTH(password) > 100 THEN 'custom'
        WHEN password LIKE '$2b$%' THEN 'bcrypt'
        ELSE 'other'
      END as type,
      COUNT(*) as count
    FROM users 
    GROUP BY type
    ORDER BY count DESC
  `);
  
  console.log("\n=== FINAL PASSWORD ANALYSIS ===");
  finalStatus.rows.forEach((row: any) => {
    console.log(`${row.type}: ${row.count}`);
  });
  
  const success = !finalStatus.rows.some((r: any) => r.type === 'plain' || r.type === 'custom');
  
  if (success) {
    console.log("\n✅ SUCCESS: All passwords are now consistently hashed with bcrypt!");
  } else {
    console.log("\n⚠️ Some passwords may still need attention");
  }
  
  return success;
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