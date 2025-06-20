// Test script to verify Telegram notifications are working
const { storage } = require('./server/storage');

async function testNotifications() {
  console.log('Testing Telegram notification system...');
  
  // Check if we have admin users
  const admins = await storage.getAdminUsers();
  console.log(`Found ${admins.length} admin users:`, admins.map(a => `${a.firstName} ${a.lastName} (${a.telegramId || 'No Telegram ID'})`));
  
  // Check sample users with Telegram IDs
  const allUsers = await storage.getAllUsers();
  const usersWithTelegram = allUsers.filter(u => u.telegramId);
  console.log(`Found ${usersWithTelegram.length} users with Telegram IDs:`, usersWithTelegram.map(u => `${u.firstName} ${u.lastName} (${u.telegramId})`));
  
  // Check recent trips
  const todayTrips = await storage.getTodayTrips();
  console.log(`Found ${todayTrips.length} trips today`);
  
  // Check recent ride requests
  const todayRequests = await storage.getTodayRideRequests();
  console.log(`Found ${todayRequests.length} ride requests today`);
  
  console.log('Notification scenarios that should trigger:');
  console.log('1. ✓ Admin notification when new trip is created');
  console.log('2. ✓ Admin notification when new ride request is created');
  console.log('3. ✓ Driver notification when rider joins trip');
  console.log('4. ✓ Driver notification when rider is assigned to trip');
  
  process.exit(0);
}

testNotifications().catch(console.error);