const { Telegraf } = require('telegraf');

const SOCIAL_INFO = {
  developer: "@Kaiiddo on Telegram",
  youtube: "@Kaiiddo",
  twitter: "@HelloKaiiddo",
  github: "@ProKaiiddo",
  version: "v2.0.0" // Updated version
};

const createResponse = (status, data = {}) => ({
  status,
  ...data,
  meta: {
    ...SOCIAL_INFO,
    timestamp: new Date().toISOString()
  }
});

module.exports = async (req, res) => {
  try {
    // Set response headers first
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');

    // Handle root endpoint
    if (req.url === '/' || req.url === '') {
      return res.status(200).json(createResponse('success', {
        message: 'Telegram Broadcast API',
        endpoints: {
          broadcast: '/api/broadcast',
          membership_check: '/api/check'
        },
        usage: {
          broadcast: 'Send a message to all bot users',
          membership_check: 'Check user membership in groups/channels'
        }
      }));
    }

    // Parse input based on method
    const params = req.method === 'POST' ? req.body : req.query;
    const { token, message, parse_mode = 'HTML' } = params;

    // Validate required parameters
    if (!token || !message) {
      return res.status(400).json(createResponse('error', {
        message: 'Missing required parameters: token or message'
      }));
    }

    // Initialize bot with error handling
    let bot;
    try {
      bot = new Telegraf(token);
      await bot.telegram.getMe(); // Test token validity
    } catch (tokenError) {
      return res.status(401).json(createResponse('error', {
        message: 'Invalid bot token'
      }));
    }

    try {
      // Delete webhook if exists
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      
      // Get recent updates (limited to 100 users)
      const updates = await bot.telegram.getUpdates({ limit: 100, offset: -100 });
      const userIds = [...new Set(
        updates
          .filter(update => update.message?.from?.id)
          .map(update => update.message.from.id)
      )];

      if (userIds.length === 0) {
        return res.status(200).json(createResponse('success', {
          data: {
            total_users: 0,
            successful: 0,
            failed: 0,
            parse_mode: parse_mode,
            warning: "No active users found in recent updates"
          }
        }));
      }

      // Prepare message with footer
      const fullMessage = `${message}\n\n` +
        `<b><i><u>✨ This broadcast sent via Broadcast API ${SOCIAL_INFO.version} ` +
        `Made With ❤️ By ${SOCIAL_INFO.developer} ✨</u></i></b>`;

      // Send messages with rate limiting
      const startTime = Date.now();
      const results = [];
      
      // Process in batches to avoid rate limits
      const batchSize = 20;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(userId => 
            bot.telegram.sendMessage(userId, fullMessage, { 
              parse_mode: 'HTML',
              disable_web_page_preview: true 
            })
            .catch(err => ({ status: 'rejected', reason: err }))
          )
        );
        results.push(...batchResults);
        
        // Add delay between batches if needed
        if (i + batchSize < userIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      // Process results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return res.status(200).json(createResponse('success', {
        data: {
          total_users: userIds.length,
          successful,
          failed,
          parse_mode: parse_mode,
          duration_seconds: duration.toFixed(2),
          message_length: fullMessage.length,
          batch_size: batchSize
        }
      }));

    } catch (error) {
      console.error('Broadcast error:', error);
      return res.status(500).json(createResponse('error', {
        message: 'Broadcast processing failed',
        error_details: error.message
      }));
    }
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json(createResponse('error', {
      message: 'Internal server error',
      error_details: error.message
    }));
  }
};
