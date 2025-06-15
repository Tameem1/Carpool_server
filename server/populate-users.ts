import { db } from "./db";
import { users } from "@shared/schema";
import fs from 'fs';
import path from 'path';

async function populateUsers() {
  try {
    // Read the JSON file
    const jsonPath = path.join(process.cwd(), 'attached_assets', 'updated_users_1749975941874.json');
    const usersData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    console.log(`Loading ${usersData.length} users from JSON file...`);
    
    // Clear existing users
    await db.delete(users);
    
    // Transform the data to match our schema
    const transformedUsers = usersData.map((user: any) => ({
      id: user.id.toString(),
      username: user.username,
      section: user.section,
      telegramUsername: user.telegram_username,
      password: user.password,
      telegramId: user.telegram_id,
      role: user.role
    }));
    
    // Insert users in batches to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < transformedUsers.length; i += batchSize) {
      const batch = transformedUsers.slice(i, i + batchSize);
      await db.insert(users).values(batch);
      console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(transformedUsers.length/batchSize)}`);
    }
    
    console.log('All users populated successfully!');
    
    // Verify the data
    const count = await db.select().from(users);
    console.log(`Total users in database: ${count.length}`);
    
    // Show sections
    const sections = [...new Set(count.map(u => u.section))].sort();
    console.log('Available sections:', sections);
    
  } catch (error) {
    console.error('Error populating users:', error);
  }
}

populateUsers();