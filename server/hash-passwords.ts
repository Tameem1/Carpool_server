import { db } from "./db";
import { users } from "@shared/schema";
import { hashPassword } from "./auth-utils";
import { eq } from "drizzle-orm";

async function hashPlainTextPasswords() {
  console.log("Starting password hashing process...");
  
  try {
    // Get all users
    const allUsers = await db.select().from(users);
    console.log(`Found ${allUsers.length} users to check`);
    
    let hashedCount = 0;
    
    for (const user of allUsers) {
      // Check if password is plain text (numeric and short)
      if (/^\d+$/.test(user.password) && user.password.length < 50) {
        console.log(`Hashing password for user: ${user.username} (${user.section})`);
        
        // Hash the plain text password
        const hashedPassword = await hashPassword(user.password);
        
        // Update the user with the hashed password
        await db
          .update(users)
          .set({ password: hashedPassword })
          .where(eq(users.id, user.id));
          
        hashedCount++;
      }
    }
    
    console.log(`Successfully hashed ${hashedCount} passwords`);
    console.log("Password hashing process completed!");
    
  } catch (error) {
    console.error("Error during password hashing:", error);
  }
}

// Run the script
hashPlainTextPasswords().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});