# Telegram Bot Setup for Ride Request Notifications

## Overview
This feature sends Telegram notifications to admin users whenever a new ride request (طلب رحلة) is created. Admin users will receive bilingual notifications in both Arabic and English.

## Setup Instructions

### 1. Create a Telegram Bot
1. Open Telegram and search for `@BotFather`
2. Start a conversation with BotFather
3. Send `/newbot` command
4. Follow the prompts to name your bot (e.g., "RideShare Notifications Bot")
5. Choose a unique username ending with "bot" (e.g., "rideshare_notifications_bot")
6. BotFather will provide you with a **Bot Token** - save this securely

### 2. Get Your Telegram ID
1. Search for `@userinfobot` in Telegram
2. Start a conversation and send any message
3. The bot will reply with your Telegram ID (a numeric value like `123456789`)
4. Save this ID - you'll need it in your admin profile

### 3. Configure the Application

#### Add Environment Variable
Add your bot token to the environment:
```bash
export TELEGRAM_BOT_TOKEN="your_bot_token_here"
```

Or create a `.env` file in the project root:
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

#### Update Admin Profile
1. Log into the application as an admin user
2. Navigate to your user profile
3. Enter your Telegram ID in the "Telegram ID" field
4. Save the profile

### 4. Test the Integration
1. Create a test ride request using the "طلب رحلة" (Request Ride) feature
2. Admin users with configured Telegram IDs should receive a notification

## Notification Format
Admins will receive notifications like this:

```
🚗 طلب رحلة جديد من أحمد محمد

📍 من: الرياض
📍 إلى: جدة  
🕐 الوقت المفضل: ٣:٠٠ م
👥 عدد الركاب: ٢
📝 ملاحظات: رحلة عائلية

رقم الطلب: 123
```

## Troubleshooting

### Bot Token Issues
- Ensure the token is correctly copied without extra spaces
- Verify the token format (should start with a number followed by colon)
- Test the token by sending a simple message via the Telegram Bot API

### Telegram ID Issues
- Double-check the Telegram ID is numeric only
- Ensure you've saved the ID in your admin profile
- Try messaging the bot directly first to establish a conversation

### No Notifications Received
- Verify the bot token is set in environment variables
- Check that your Telegram ID is correctly entered in your profile
- Ensure you've started a conversation with your bot (send `/start`)
- Check server logs for any error messages

## Security Notes
- Keep your bot token secure and never commit it to version control
- Only share your Telegram ID with trusted administrators
- Regularly rotate bot tokens if needed
- Consider using environment variables or secure secret management