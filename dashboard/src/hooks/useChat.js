import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { BACKEND_URL, conversationsApi } from '../services/api';

export function useChat(activeSite, token, user) {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({}); // { [conversationId]: count }
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'unread' | 'open' | 'resolved'
  const [isVisitorTyping, setIsVisitorTyping] = useState(false);
  const [mobileChatView, setMobileChatView] = useState(false);
  const [socket, setSocket] = useState(null);

  const chatBottomRef = useRef(null);
  const agentTypingTimeoutRef = useRef(null);

  // Clear chat state helper
  const resetChatState = useCallback(() => {
    setConversations([]);
    setSelectedConv(null);
    setMessages([]);
    setUnreadCounts({});
    setIsVisitorTyping(false);
  }, []);

  // Fetch Conversations for Active Site
  const fetchConversations = useCallback(async () => {
    if (!activeSite || !token) return;
    try {
      const data = await conversationsApi.getAll(activeSite.apiKey);
      setConversations(data);
      if (data.length > 0) {
        setSelectedConv(prev => {
          if (!prev) return data[0];
          const found = data.find(c => c.id === prev.id);
          return found || data[0];
        });
      }
    } catch (e) {
      console.error('Failed to fetch conversations:', e);
    }
  }, [activeSite, token]);

  // Handle active site reset
  useEffect(() => {
    if (!activeSite) {
      resetChatState();
      return;
    }
    setSelectedConv(null);
    setMessages([]);
    setIsVisitorTyping(false);
    fetchConversations();
  }, [activeSite, fetchConversations, resetChatState]);

  // Select a Conversation
  const handleSelectConversation = useCallback((conv) => {
    setSelectedConv(conv);
    setMobileChatView(true);
    // Mark as read
    setUnreadCounts(prev => {
      if (!prev[conv.id]) return prev;
      const updated = { ...prev };
      delete updated[conv.id];
      return updated;
    });
  }, []);

  // Load Messages when selected conversation changes
  useEffect(() => {
    if (!selectedConv || !token) return;
    let isMounted = true;

    const fetchMessages = async () => {
      try {
        const data = await conversationsApi.getMessages(selectedConv.id);
        if (isMounted) {
          setMessages(data);
        }
      } catch (e) {
        console.error('Failed to fetch messages:', e);
      }
    };

    fetchMessages();

    if (socket) {
      socket.emit('join_conversation', { conversationId: selectedConv.id });
    }

    return () => { isMounted = false; };
  }, [selectedConv, token, socket]);

  // Socket.IO Connection Lifecycle
  useEffect(() => {
    if (!activeSite) return;

    const s = io(BACKEND_URL);
    setSocket(s);

    s.on('connect', () => {
      s.emit('join_site_admin', { siteKey: activeSite.apiKey });
    });

    s.on('new_message_notification', (data) => {
      fetchConversations();
      setSelectedConv(current => {
        const isCurrent = current && current.id === data.conversationId;
        if (isCurrent) {
          setMessages(prev => {
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        } else if (data.message?.senderType === 'visitor') {
          setUnreadCounts(prev => ({
            ...prev,
            [data.conversationId]: (prev[data.conversationId] || 0) + 1
          }));
        }
        return current;
      });
    });

    s.on('message_received', (msg) => {
      setSelectedConv(current => {
        if (current && msg.conversationId === current.id) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
        return current;
      });
    });

    s.on('typing', ({ conversationId, senderType, isTyping }) => {
      setSelectedConv(current => {
        if (current && conversationId === current.id && senderType === 'visitor') {
          setIsVisitorTyping(isTyping);
        }
        return current;
      });
    });

    s.on('all_conversations_deleted', () => {
      resetChatState();
    });

    return () => {
      s.disconnect();
    };
  }, [activeSite, fetchConversations, resetChatState]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isVisitorTyping]);

  // Send Reply from Operator
  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedConv || !socket) return;

    socket.emit('send_message', {
      conversationId: selectedConv.id,
      siteKey: activeSite.apiKey,
      senderType: 'agent',
      senderName: user?.name || 'Support Agent',
      content: replyText.trim()
    });

    setReplyText('');
    socket.emit('typing', {
      conversationId: selectedConv.id,
      senderType: 'agent',
      isTyping: false
    });
  };

  // Toggle Conversation Status (open / resolved)
  const handleToggleStatus = async () => {
    if (!selectedConv || !token) return;
    const nextStatus = selectedConv.status === 'resolved' ? 'open' : 'resolved';
    try {
      const updated = await conversationsApi.updateStatus(selectedConv.id, nextStatus);
      setSelectedConv(updated);
      setConversations(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch (e) {
      alert('Error updating status: ' + e.message);
    }
  };

  // Total unread count
  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadCounts).reduce((acc, count) => acc + count, 0);
  }, [unreadCounts]);

  // Filtered conversations list
  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      if (statusFilter === 'unread') return (unreadCounts[conv.id] || 0) > 0;
      if (statusFilter === 'open' && conv.status === 'resolved') return false;
      if (statusFilter === 'resolved' && conv.status !== 'resolved') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = conv.visitorName?.toLowerCase().includes(q);
        const emailMatch = conv.visitorEmail?.toLowerCase().includes(q);
        const extMatch = conv.externalId?.toLowerCase().includes(q);
        const msgMatch = conv.messages?.[0]?.content?.toLowerCase().includes(q);
        return nameMatch || emailMatch || extMatch || msgMatch;
      }
      return true;
    });
  }, [conversations, statusFilter, unreadCounts, searchQuery]);

  return {
    conversations,
    setConversations,
    selectedConv,
    setSelectedConv,
    unreadCounts,
    messages,
    replyText,
    setReplyText,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    isVisitorTyping,
    mobileChatView,
    setMobileChatView,
    socket,
    chatBottomRef,
    agentTypingTimeoutRef,
    fetchConversations,
    handleSelectConversation,
    handleSendReply,
    handleToggleStatus,
    resetChatState,
    totalUnreadCount,
    filteredConversations
  };
}
