import React from 'react';
import {
  Search,
  Mail,
  ChevronLeft,
  CheckCircle2,
  Send
} from 'lucide-react';

export default function ChatView({
  filteredConversations,
  conversations,
  fetchConversations,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  unreadCounts,
  selectedConv,
  handleSelectConversation,
  mobileChatView,
  setMobileChatView,
  handleToggleStatus,
  messages,
  chatBottomRef,
  isVisitorTyping,
  handleSendReply,
  replyText,
  setReplyText,
  socket,
  agentTypingTimeoutRef
}) {
  return (
    <div className="flex h-full min-w-0">
      <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 bg-white flex flex-col shrink-0 ${mobileChatView ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Conversations ({filteredConversations.length})
          </span>
          <button 
            onClick={fetchConversations} 
            className="text-xs sm:text-sm text-[#287170] hover:text-[#205d5c] font-semibold transition cursor-pointer"
            title="Fetch latest conversations and messages"
          >
            Refresh
          </button>
        </div>

        {/* Search & Status Filters */}
        <div className="p-3.5 border-b border-slate-100 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search visitor, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 text-sm pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:border-[#287170] font-medium placeholder-slate-400"
              title="Search conversations by email, visitor ID, or message text"
            />
          </div>
          <div className="flex gap-1.5 text-xs overflow-x-auto pb-0.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition shrink-0 cursor-pointer ${statusFilter === 'all' ? 'bg-[#287170] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              title="Show all conversations"
            >
              All ({conversations.length})
            </button>
            <button
              onClick={() => setStatusFilter('unread')}
              className={`px-3 py-1 rounded-lg font-semibold transition shrink-0 cursor-pointer ${statusFilter === 'unread' ? 'bg-[#287170] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              title="Show conversations with unread visitor messages"
            >
              Unread ({conversations.filter(c => (unreadCounts[c.id] || 0) > 0).length})
            </button>
            <button
              onClick={() => setStatusFilter('open')}
              className={`px-3 py-1 rounded-lg font-semibold transition shrink-0 cursor-pointer ${statusFilter === 'open' ? 'bg-[#287170] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              title="Show open conversations"
            >
              Open ({conversations.filter(c => c.status !== 'resolved').length})
            </button>
            <button
              onClick={() => setStatusFilter('resolved')}
              className={`px-3 py-1 rounded-lg font-semibold transition shrink-0 cursor-pointer ${statusFilter === 'resolved' ? 'bg-[#287170] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              title="Show resolved conversations"
            >
              Resolved ({conversations.filter(c => c.status === 'resolved').length})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm font-medium">
              {searchQuery ? 'No conversations matching search.' : 'No conversations found in this view.'}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedConv?.id === conv.id;
              const lastMsg = conv.messages?.[0]?.content || 'Started conversation';
              const isResolved = conv.status === 'resolved';
              const unreadCount = unreadCounts[conv.id] || 0;

              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`p-4 cursor-pointer transition ${
                    isSelected ? 'bg-[#287170]/5 border-l-4 border-[#287170]' : 'hover:bg-slate-50 border-l-4 border-transparent'
                  }`}
                  title={conv.visitorEmail ? `Email: ${conv.visitorEmail}` : `Visitor #${conv.visitorId.slice(-6)}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {unreadCount > 0 && (
                        <span className="w-2 h-2 rounded-full bg-[#287170] shrink-0" />
                      )}
                      <span className={`text-sm truncate ${unreadCount > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                        {conv.visitorName || conv.visitorEmail || `Visitor #${conv.visitorId.slice(-6)}`}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-medium shrink-0">
                      {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {conv.visitorEmail && (
                    <div className="text-xs text-[#287170] font-medium truncate mt-0.5 flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-[#287170] shrink-0" />
                      <span className="truncate">{conv.visitorEmail}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {unreadCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-[#287170] text-white">
                        {unreadCount} new
                      </span>
                    )}
                    {conv.externalId && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 font-semibold truncate">
                        Identified: #{conv.externalId}
                      </span>
                    )}
                    <span 
                      className={`text-xs px-2 py-0.5 rounded-md font-semibold ${isResolved ? 'bg-slate-100 text-slate-600' : 'bg-[#287170]/10 text-[#287170]'}`}
                      title={isResolved ? "Conversation is marked resolved" : "Conversation is active"}
                    >
                      {isResolved ? 'Resolved' : 'Open'}
                    </span>
                  </div>
                  <p className={`text-xs mt-1.5 truncate leading-normal ${unreadCount > 0 ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{lastMsg}</p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedConv ? (
        <div className={`flex-1 flex flex-col bg-slate-50 min-w-0 ${!mobileChatView ? 'hidden md:flex' : 'flex'}`}>
          <div className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => setMobileChatView(false)}
                className="md:hidden p-1.5 -ml-1 text-slate-500 hover:bg-slate-100 rounded-lg shrink-0 transition"
                title="Back to conversation list"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-bold text-base text-slate-900 truncate">
                {selectedConv.visitorName || 'Visitor'}
              </span>
              {selectedConv.visitorEmail && (
                <span className="text-xs font-mono text-[#287170] bg-[#287170]/10 px-2.5 py-0.5 rounded-full border border-[#287170]/25 hidden sm:flex items-center gap-1.5" title={`Visitor Email: ${selectedConv.visitorEmail}`}>
                  <Mail className="w-3.5 h-3.5" />
                  <span className="truncate">{selectedConv.visitorEmail}</span>
                </span>
              )}
              {selectedConv.externalId && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 hidden sm:inline" title="Authenticated User ID">
                  ✓ #{selectedConv.externalId}
                </span>
              )}
              <span className="text-xs text-slate-400 font-mono hidden xl:inline" title={`Visitor Session ID: ${selectedConv.visitorId}`}>
                ({selectedConv.visitorId.slice(0, 8)}...)
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleToggleStatus}
                className={`text-xs sm:text-sm px-3.5 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  selectedConv.status === 'resolved'
                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                }`}
                title={selectedConv.status === 'resolved' ? "Reopen this conversation" : "Mark conversation as resolved"}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{selectedConv.status === 'resolved' ? 'Reopen' : 'Mark Resolved'}</span>
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
            {messages.map((m) => {
              const isAgent = m.senderType === 'agent';
              return (
                <div key={m.id} className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isAgent
                        ? 'bg-[#287170] text-white rounded-br-sm shadow-sm'
                        : 'bg-white text-slate-900 border border-slate-200 rounded-bl-sm shadow-xs'
                    }`}
                  >
                    {m.content}
                  </div>
                  <span className="text-xs text-slate-600 font-medium mt-1.5 px-1">
                    {isAgent ? 'You (Agent)' : (m.senderName || 'Visitor')} •{' '}
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* Visitor Typing Indicator */}
          {isVisitorTyping && (
            <div className="px-4 sm:px-6 py-2.5 text-sm font-medium text-[#287170] italic bg-[#287170]/5 flex items-center gap-2 border-t border-[#287170]/20 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[#287170]" />
              <span>Visitor is typing a reply...</span>
            </div>
          )}

          <form onSubmit={handleSendReply} className="p-3 sm:p-4 bg-white border-t border-slate-200 flex gap-2 sm:gap-3">
            <input
              type="text"
              value={replyText}
              onChange={(e) => {
                setReplyText(e.target.value);
                if (socket && selectedConv) {
                  socket.emit('typing', { conversationId: selectedConv.id, senderType: 'agent', isTyping: true });
                  clearTimeout(agentTypingTimeoutRef.current);
                  agentTypingTimeoutRef.current = setTimeout(() => {
                    socket.emit('typing', { conversationId: selectedConv.id, senderType: 'agent', isTyping: false });
                  }, 1200);
                }
              }}
              placeholder="Type your reply to the visitor..."
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:border-[#287170] placeholder-slate-500"
            />
            <button
              type="submit"
              disabled={!replyText.trim()}
              className="bg-[#287170] hover:bg-[#205d5c] disabled:opacity-50 text-white px-5 sm:px-6 py-3 rounded-xl font-semibold text-base flex items-center gap-2 transition shrink-0 shadow-sm cursor-pointer"
            >
              <Send className="w-5 h-5" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-slate-600 text-base font-medium bg-slate-50">
          Select a conversation to view messages.
        </div>
      )}
    </div>
  );
}
