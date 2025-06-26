const { Telegraf } = require('telegraf');
const axios = require('axios');

const SOCIAL_INFO = {
  developer: "@Kaiiddo on Telegram",
  youtube: "@Kaiiddo",
  twitter: "@HelloKaiiddo",
  github: "@ProKaiiddo",
  version: "v1.0.0"
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

    // Support GET, POST methods
    const method = req.method;
    let botToken, message, parseMode;
    
    if (method === 'GET') {
      botToken = req.query.token;
      message = req.query.message;
      parseMode = req.query.parse_mode || 'HTML';
    } else if (method === 'POST') {
      botToken = req.body.token;
      message = req.body.message;
      parseMode = req.body.parse_mode || 'HTML';
    } else {
      return res.status(405).json(createResponse('error', {
        message: 'Method not allowed'
      }));
    }

    // Validate required parameters
    if (!botToken || !message) {
      return res.status(400).json(createResponse('error', {
        message: 'Missing required parameters: token or message'
      }));
    }

    // Add sticky footer to message
    const fullMessage = `${message}\n\n<b><i><u>✨ This broadcast message sent via Broadcast API ${SOCIAL_INFO.version} Made With Love By ${SOCIAL_INFO.developer} ✨</u></i></b>`;

    // Initialize bot
    const bot = new Telegraf(botToken);
    
    try {
      // Get all updates to find users who interacted with the bot
      const updates = await bot.telegram.getUpdates();
      const userIds = [...new Set(updates.map(update => update.message?.from.id))].filter(Boolean);

      // Broadcast to all users
      const startTime = Date.now();
      const results = await Promise.allSettled(
        userIds.map(userId => 
          bot.telegram.sendMessage(userId, fullMessage, { parse_mode: parseMode })
        )
      );

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      const failedUserIds = results
        .filter(r => r.status === 'rejected')
        .map((r, i) => ({ user_id: userIds[i], reason: r.reason.message }));

      return res.status(200).json(createResponse('success', {
        data: {
          total_users: userIds.length,
          successful,
          failed,
          parse_mode: parseMode,
          duration_seconds: duration,
          failed_users: failed > 0 ? failedUserIds : undefined,
          message_length: fullMessage.length
        }
      }));
    } catch (error) {
      console.error('Broadcast error:', error);
      return res.status(500).json(createResponse('error', {
        message: error.response?.description || error.message || 'Broadcast failed'
      }));
    }
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json(createResponse('error', {
      message: error.message || 'Internal server error'
    }));
  }
};
