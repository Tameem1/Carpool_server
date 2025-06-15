const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function completePasswordStandardization() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  console.log('Starting final password standardization...');
  
  try {
    // Handle remaining plain numeric passwords efficiently
    let batch = 1;
    while (true) {
      const result = await pool.query(`
        SELECT id, password 
        FROM users 
        WHERE password ~ '^[0-9]+$' AND LENGTH(password) < 20
        LIMIT 30
      `);
      
      if (result.rows.length === 0) break;
      
      console.log(`Processing batch ${batch} (${result.rows.length} users)...`);
      
      for (const user of result.rows) {
        const hashedPassword = await bcrypt.hash(user.password, 12);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);
      }
      
      batch++;
    }
    
    // Handle remaining custom hash passwords
    const customResult = await pool.query(`
      SELECT id, username 
      FROM users 
      WHERE password LIKE '%.%' AND LENGTH(password) > 100
    `);
    
    console.log(`Processing ${customResult.rows.length} custom hash passwords...`);
    
    for (const user of customResult.rows) {
      const newPassword = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);
      console.log(`New password for ${user.username}: ${newPassword}`);
    }
    
    // Final verification
    const verification = await pool.query(`
      SELECT 
        CASE 
          WHEN password ~ '^[0-9]+$' AND LENGTH(password) < 20 THEN 'plain_numeric'
          WHEN password LIKE '%.%' AND LENGTH(password) > 100 THEN 'custom_hash'
          WHEN password LIKE '$2b$%' OR password LIKE '$2a$%' THEN 'bcrypt'
          ELSE 'other'
        END as type,
        COUNT(*) as count
      FROM users 
      GROUP BY type
      ORDER BY count DESC
    `);
    
    console.log('\nFinal password distribution:');
    verification.rows.forEach(row => {
      console.log(`${row.type}: ${row.count}`);
    });
    
    const inconsistent = verification.rows.filter(row => 
      row.type === 'plain_numeric' || row.type === 'custom_hash'
    );
    
    if (inconsistent.length === 0) {
      console.log('\nSUCCESS: All passwords are now consistently using bcrypt hashing!');
    } else {
      console.log(`\nRemaining inconsistencies: ${inconsistent.map(r => `${r.type}: ${r.count}`).join(', ')}`);
    }
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await pool.end();
  }
}

completePasswordStandardization().catch(console.error);