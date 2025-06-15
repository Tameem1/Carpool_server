import { db } from "./db";
import { users } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import bcrypt from 'bcryptjs';

async function quickMigrateRemainingPasswords() {
  console.log("Starting quick migration of remaining passwords...");
  
  // Get all users with plain numeric passwords
  const plainUsers = await db.select({
    id: users.id,
    username: users.username,
    password: users.password
  }).from(users).where(sql`password ~ '^[0-9]+$' AND LENGTH(password) < 20`);
  
  console.log(`Found ${plainUsers.length} plain numeric passwords to migrate`);
  
  // Process in smaller batches to avoid timeout
  const batchSize = 5;
  let completed = 0;
  
  for (let i = 0; i < plainUsers.length; i += batchSize) {
    const batch = plainUsers.slice(i, i + batchSize);
    
    for (const user of batch) {
      const hashedPassword = await bcrypt.hash(user.password, 12);
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, user.id));
      completed++;
    }
    
    console.log(`Migrated ${completed}/${plainUsers.length} passwords`);
    
    // Small delay to prevent overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log("Migration of plain numeric passwords completed!");
  
  // Now handle custom hash passwords
  const customHashUsers = await db.select({
    id: users.id,
    username: users.username,
    password: users.password
  }).from(users).where(sql`password LIKE '%.%' AND LENGTH(password) > 100`);
  
  console.log(`Found ${customHashUsers.length} custom hash passwords to migrate`);
  
  for (const user of customHashUsers) {
    // Generate a new secure password since we can't easily reverse the custom hash
    const newPassword = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, user.id));
      
    console.log(`Generated new password for ${user.username}: ${newPassword}`);
  }
  
  console.log("All password migrations completed!");
}

// Verification
async function verifyMigration() {
  const result = await db.execute(sql`
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
  
  console.log("Password migration verification:");
  result.rows.forEach((row: any) => {
    console.log(`${row.password_type}: ${row.count}`);
  });
  
  const plainCount = result.rows.find((r: any) => r.password_type === 'plain_numeric')?.count || 0;
  const customCount = result.rows.find((r: any) => r.password_type === 'custom_hash')?.count || 0;
  
  if (plainCount === 0 && customCount === 0) {
    console.log("SUCCESS: All passwords are now properly hashed!");
  } else {
    console.log(`WARNING: ${plainCount} plain and ${customCount} custom hash passwords remain`);
  }
}

async function main() {
  try {
    await quickMigrateRemainingPasswords();
    await verifyMigration();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();