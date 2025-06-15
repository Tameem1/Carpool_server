import { db } from "./db";
import { sql } from "drizzle-orm";
import bcrypt from 'bcryptjs';

async function sqlBasedPasswordMigration() {
  console.log("Starting SQL-based password migration for remaining users...");
  
  // Get count of remaining plain passwords
  const remainingCount = await db.execute(sql`
    SELECT COUNT(*) as count 
    FROM users 
    WHERE password ~ '^[0-9]+$' AND LENGTH(password) < 20
  `);
  
  console.log(`Found ${remainingCount.rows[0].count} remaining plain passwords`);
  
  // Process in smaller chunks to avoid timeouts
  const chunkSize = 20;
  let processed = 0;
  
  while (true) {
    // Get next chunk of plain passwords
    const chunk = await db.execute(sql`
      SELECT id, password 
      FROM users 
      WHERE password ~ '^[0-9]+$' AND LENGTH(password) < 20
      LIMIT ${chunkSize}
    `);
    
    if (chunk.rows.length === 0) break;
    
    // Process each password in the chunk
    for (const user of chunk.rows) {
      const hashedPassword = await bcrypt.hash(user.password as string, 12);
      await db.execute(sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${user.id}`);
      processed++;
      
      if (processed % 10 === 0) {
        console.log(`Processed ${processed} passwords...`);
      }
    }
  }
  
  console.log(`Completed migration of ${processed} plain passwords`);
  
  // Handle custom hash passwords
  const customHashes = await db.execute(sql`
    SELECT id, username 
    FROM users 
    WHERE password LIKE '%.%' AND LENGTH(password) > 100
  `);
  
  console.log(`Processing ${customHashes.rows.length} custom hash passwords...`);
  
  for (const user of customHashes.rows) {
    // Generate new secure password for custom hash users
    const newPassword = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await db.execute(sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${user.id}`);
    console.log(`New password for ${user.username}: ${newPassword}`);
  }
  
  // Final verification
  const final = await db.execute(sql`
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
  `);
  
  console.log("Final password distribution:");
  final.rows.forEach((row: any) => {
    console.log(`${row.type}: ${row.count}`);
  });
  
  return final.rows;
}

async function main() {
  try {
    await sqlBasedPasswordMigration();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();