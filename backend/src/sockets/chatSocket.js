const prisma = require('../db');

function registerChatSocket(io) {
  io.on('connection', (socket) => {
    // Admin or Visitor joins site-wide configuration room
    socket.on('join_site_admin', (data) => {
      const siteKey = data && data.siteKey;
      if (siteKey) {
        socket.join(`site_${siteKey}`);
      }
    });

    socket.on('join_site', (data) => {
      const siteKey = data && data.siteKey;
      if (siteKey) {
        socket.join(`site_${siteKey}`);
      }
    });

    // Visitor or Agent joins specific conversation room
    socket.on('join_conversation', (data) => {
      const conversationId = data && data.conversationId;
      if (conversationId) {
        socket.join(`conv_${conversationId}`);
      }
    });

    // Typing indicator
    socket.on('typing', (data) => {
      if (!data) return;
      const { conversationId, senderType, isTyping } = data;
      if (conversationId) {
        socket.to(`conv_${conversationId}`).emit('typing', { senderType, isTyping });
      }
    });

    // Sending message
    socket.on('send_message', async (data) => {
      try {
        if (!data) return;
        const { conversationId, siteKey, senderType, content, senderName } = data;
        if (!conversationId || !content || typeof content !== 'string') return;
        const trimmed = content.trim();
        if (trimmed.length === 0 || trimmed.length > 5000) return;

        // Ensure socket is joined to the conversation room
        socket.join(`conv_${conversationId}`);

        let savedMessage = null;
        if (prisma) {
          savedMessage = await prisma.message.create({
            data: {
              conversationId,
              senderType: senderType || 'visitor',
              senderName: senderName || (senderType === 'agent' ? 'Support Agent' : 'Visitor'),
              content: trimmed
            }
          });

          // Update conversation lastMessageAt and reopen status if visitor sends message
          await prisma.conversation.update({
            where: { id: conversationId },
            data: {
              lastMessageAt: new Date(),
              status: senderType === 'visitor' ? 'open' : undefined
            }
          });
        } else {
          savedMessage = {
            id: 'temp-' + Date.now(),
            conversationId,
            senderType: senderType || 'visitor',
            senderName: senderName || (senderType === 'agent' ? 'Support Agent' : 'Visitor'),
            content: trimmed,
            createdAt: new Date().toISOString()
          };
        }

        // Broadcast to both visitor and agent in conversation
        io.to(`conv_${conversationId}`).emit('message_received', savedMessage);

        // Notify admin inbox in site room
        if (siteKey) {
          io.to(`site_${siteKey}`).emit('new_message_notification', {
            conversationId,
            message: savedMessage
          });
        }
      } catch (err) {
        console.error('[Socket] Error handling send_message:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });
  });
}

module.exports = registerChatSocket;
