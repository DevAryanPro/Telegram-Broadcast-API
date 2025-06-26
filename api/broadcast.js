const { Telegraf } = require('telegraf');
const axios = require('axios');

module.exports = async (req, res) => {
  try {
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
      return res.status(405).json({ 
        status: 'error', 
        message: 'Method not allowed' 
      });
    }

    // Validate required parameters
    if (!botToken || !message) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing required parameters: token or message' 
      });
    }

    // Add sticky footer to message
    const fullMessage = `${message}\n\n<b><i><u>✨ This broadcast message sent via Broadcast API Made With Love By @Kaiiddo ✨</u></i></b>`;

    // Initialize bot
    const bot = new Telegraf(botToken);
    
    try {
      // Get all updates to find users who interacted with the bot
      const updates = await bot.telegram.getUpdates();
      const userIds = [...new Set(updates.map(update => update.message?.from.id))].filter(Boolean);

      // Broadcast to all users
      const results = await Promise.allSettled(
        userIds.map(userId => 
          bot.telegram.sendMessage(userId, fullMessage, { parse_mode: parseMode })
        )
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return res.status(200).json({
        status: 'success',
        data: {
          total_users: userIds.length,
          successful,
          failed,
          parse_mode: parseMode
        }
      });
    } catch (error) {
      console.error('Broadcast error:', error);
      return res.status(500).json({ 
        status: 'error', 
        message: error.response?.description || error.message || 'Broadcast failed' 
      });
    }
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: error.message || 'Internal server error' 
    });
  }
};
