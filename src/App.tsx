/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search,
  Filter,
  TrendingUp,
  Activity,
  MoreVertical,
  AlertCircle,
  CheckCircle,
  Circle as CircleIcon,
  PlusCircle,
  ChevronDown,
  Cpu,
  Zap,
  Sparkles,
  Bot,
  User as UserIcon,
  LayoutDashboard,
  MessageSquare,
  Calendar,
  Settings,
  ChevronRight,
  Clock,
  LogOut,
  LogIn,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  FolderKanban,
  History,
  Plus,
  Trash2,
  Send,
  Circle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { cn } from './lib/utils';
import { Message, ChatSession } from './types';
import { getChatResponse } from './services/gemini';
import { useFirebase } from './components/FirebaseProvider';
import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  deleteDoc, 
  updateDoc,
  handleFirestoreError,
  OperationType
} from './lib/firebase';

const MODELS = [
  { id: 'System Architect v1.0', desc: 'Stable, efficient architecture core.', icon: Cpu },
  { id: 'System Architect v1.1', desc: 'Enhanced logic & reasoning modules.', icon: Zap },
  { id: 'System Architect v1.0 pro', desc: 'High-performance professional core.', icon: Sparkles },
  { id: 'System Architect v1.1 pro', desc: 'Ultimate architectural intelligence.', icon: Bot },
];

export default function App() {
  const { user, loading: authLoading, isLoggingIn, authError, login, logout } = useFirebase();
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [chatEndRef] = [useRef<HTMLDivElement>(null)];

  useEffect(() => {
    if (!user) {
      setChatSessions([]);
      setMessages([]);
      return;
    }

    // Subscribe to chat sessions
    const sessionsQuery = query(
      collection(db, 'chatSessions'),
      where('userId', '==', user.uid)
    );

    const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
      const sessionsData = snapshot.docs
        .map(doc => doc.data() as ChatSession)
        .sort((a, b) => b.createdAt - a.createdAt);
      setChatSessions(sessionsData);
      if (sessionsData.length > 0 && !selectedSessionId) {
        setSelectedSessionId(sessionsData[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chatSessions');
    });

    return () => {
      unsubscribeSessions();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !selectedSessionId) {
      setMessages([]);
      return;
    }

    const messagesQuery = query(
      collection(db, 'messages'),
      where('sessionId', '==', selectedSessionId),
      where('userId', '==', user.uid)
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const msgsData = snapshot.docs
        .map(doc => doc.data() as Message)
        .sort((a, b) => a.timestamp - b.timestamp);
      setMessages(msgsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => {
      unsubscribeMessages();
    };
  }, [user, selectedSessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const deleteSession = async (sessionId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'chatSessions', sessionId));
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `chatSessions/${sessionId}`);
    }
  };

  const addSession = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user || !newSessionTitle.trim()) return;

    const id = crypto.randomUUID();
    const newSession: ChatSession = {
      id,
      title: newSessionTitle.trim(),
      createdAt: Date.now(),
      userId: user.uid
    };

    try {
      await setDoc(doc(db, 'chatSessions', id), newSession);
      setSelectedSessionId(id);
      setNewSessionTitle('');
      setIsSessionModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chatSessions/${id}`);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !user) return;

    let currentSessionId = selectedSessionId;

    // If no session exists, create one automatically
    if (!currentSessionId) {
      const newSessionId = crypto.randomUUID();
      const newSession: ChatSession = {
        id: newSessionId,
        title: input.slice(0, 30) + (input.length > 30 ? '...' : ''),
        createdAt: Date.now(),
        userId: user.uid
      };
      
      try {
        await setDoc(doc(db, 'chatSessions', newSessionId), newSession);
        setSelectedSessionId(newSessionId);
        currentSessionId = newSessionId;
      } catch (error) {
        console.error("Failed to create session:", error);
        return;
      }
    }

    const userMsgId = crypto.randomUUID();
    const userMsg: Message = {
      id: userMsgId,
      role: 'user',
      content: input,
      timestamp: Date.now(),
      userId: user.uid,
      sessionId: currentSessionId
    };

    setInput('');
    setIsLoading(true);

    try {
      await setDoc(doc(db, 'messages', userMsgId), userMsg);
      
      const response = await getChatResponse(input, selectedModel);
      
      const aiMsgId = crypto.randomUUID();
      const aiMsg: Message = {
        id: aiMsgId,
        role: 'model',
        content: response || "I'm sorry, I couldn't process that request.",
        timestamp: Date.now(),
        userId: user.uid,
        sessionId: currentSessionId
      };
      await setDoc(doc(db, 'messages', aiMsgId), aiMsg);
    } catch (error) {
      console.error(error);
      const errorMsgId = crypto.randomUUID();
      const errorMsg: Message = {
        id: errorMsgId,
        role: 'model',
        content: "Error: Failed to connect to the System Architect core. Please check your connection or API key.",
        timestamp: Date.now(),
        userId: user.uid,
        sessionId: currentSessionId
      };
      await setDoc(doc(db, 'messages', errorMsgId), errorMsg).catch(console.error);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-blue-600 rounded-2xl shadow-2xl shadow-blue-600/20 animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <p className="text-white/40 text-xs uppercase tracking-[0.3em] font-bold">Initializing System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-12">
            <div className="inline-block p-4 bg-blue-600 rounded-3xl shadow-2xl shadow-blue-600/20 mb-6">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold tracking-tighter text-white mb-2">System Architect</h1>
            <p className="text-white/40">Architect your productivity with AI precision.</p>
          </div>
          
          <button 
            onClick={login}
            disabled={isLoggingIn}
            className="w-full bg-white text-black font-semibold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-white/5"
          >
            {isLoggingIn ? (
              <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              <LogIn className="w-5 h-5" />
            )}
            <span>{isLoggingIn ? 'Authenticating...' : 'Access System Core'}</span>
          </button>

          {authError && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
              {authError}
            </div>
          )}
          
          <p className="text-[10px] text-center mt-12 text-white/20 uppercase tracking-widest">
            v1.0 // Secure Authentication Required
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gemini-bg text-gemini-text font-sans overflow-hidden">
      {/* Gemini-style Sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col bg-gemini-sidebar transition-all duration-300 ease-in-out shrink-0",
        isSidebarCollapsed ? "w-20" : "w-72"
      )}>
        <div className="p-4 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2 px-2">
              <Sparkles className="w-6 h-6 text-gemini-accent" />
              <span className="font-display font-bold tracking-tight text-lg">ARCHITECT</span>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-gemini-muted hover:text-white"
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>

        <div className="px-4 py-2">
          <button 
            onClick={() => {
              setIsSessionModalOpen(true);
            }}
            className={cn(
              "flex items-center gap-3 bg-gemini-surface hover:bg-white/10 border border-white/5 rounded-full transition-all group overflow-hidden shadow-sm",
              isSidebarCollapsed ? "w-12 h-12 justify-center" : "w-full px-4 py-3"
            )}
          >
            <Plus className="w-5 h-5 text-gemini-accent shrink-0" />
            {!isSidebarCollapsed && <span className="text-sm font-medium">New Chat</span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-4 space-y-6">
          {/* Recent Chats */}
          <div>
            {!isSidebarCollapsed && <div className="px-4 text-[11px] font-semibold uppercase tracking-wider text-gemini-muted mb-2">Recent</div>}
            <div className="space-y-1">
              {chatSessions.map((session) => (
                <div key={session.id} className="group relative px-2">
                  <button
                    onClick={() => {
                      setSelectedSessionId(session.id);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-2.5 rounded-full transition-all text-left",
                      selectedSessionId === session.id 
                        ? "bg-gemini-surface text-white" 
                        : "hover:bg-white/5 text-gemini-muted hover:text-white"
                    )}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="text-sm truncate flex-1">{session.title}</span>}
                  </button>
                  {!isSidebarCollapsed && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-2">
          <button 
            onClick={() => setIsProfileModalOpen(true)}
            className={cn(
              "flex items-center gap-3 w-full p-2.5 rounded-full hover:bg-white/5 transition-all text-left group",
              isSidebarCollapsed && "justify-center"
            )}
          >
            <div className="w-7 h-7 rounded-full bg-gemini-accent/20 border border-gemini-accent/30 flex items-center justify-center overflow-hidden shrink-0">
              {user.photoURL ? (
                <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-4 h-4 text-gemini-accent" />
              )}
            </div>
            {!isSidebarCollapsed && <span className="text-sm font-medium truncate">{user.displayName || 'Architect'}</span>}
          </button>
          <button 
            onClick={logout}
            className={cn(
              "flex items-center gap-3 w-full p-2.5 rounded-full hover:bg-red-500/10 text-gemini-muted hover:text-red-400 transition-all text-left group",
              isSidebarCollapsed && "justify-center"
            )}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0A0A0A]/90 backdrop-blur-xl border-t border-white/10 flex justify-around items-center p-4 z-[90]">
        {[
          { id: 'chat', icon: MessageSquare, label: 'Chat' },
        ].map((tab) => (
          <button
            key={tab.id}
            className="flex flex-col items-center gap-1 transition-all text-blue-400"
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {/* Chat Section */}
        <section className="flex-1 flex flex-col bg-gemini-bg transition-all duration-500">
          <header className="p-4 md:p-6 flex items-center justify-between bg-gemini-bg/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gemini-accent/10 border border-gemini-accent/20 flex items-center justify-center">
                <Bot className="w-5 h-5 md:w-6 md:h-6 text-gemini-accent" />
              </div>
              <div className="relative">
                <button 
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className="flex items-center gap-2 group"
                >
                  <h2 className="text-sm md:text-base font-display font-bold text-white group-hover:text-gemini-accent transition-colors truncate max-w-[120px] md:max-w-none">
                    {selectedModel}
                  </h2>
                  <ChevronDown className={cn(
                    "w-3 h-3 md:w-4 md:h-4 text-gemini-muted transition-transform duration-300",
                    isModelDropdownOpen && "rotate-180"
                  )} />
                </button>
                
                <AnimatePresence>
                  {isModelDropdownOpen && (
                    <>
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40"
                        onClick={() => setIsModelDropdownOpen(false)}
                      />
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full left-0 mt-2 w-64 bg-gemini-surface border border-white/5 rounded-2xl shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="p-2 space-y-1">
                          {MODELS.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => {
                                setSelectedModel(model.id);
                                setIsModelDropdownOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-start gap-3 p-3 rounded-xl transition-all text-left",
                                selectedModel === model.id 
                                  ? "bg-gemini-accent/20 border border-gemini-accent/30" 
                                  : "hover:bg-white/5 border border-transparent"
                              )}
                            >
                              <div className={cn(
                                "p-2 rounded-lg shrink-0",
                                selectedModel === model.id ? "bg-gemini-accent text-white" : "bg-white/5 text-gemini-muted"
                              )}>
                                <model.icon className="w-4 h-4" />
                              </div>
                              <div>
                                <div className={cn(
                                  "text-xs font-bold tracking-tight",
                                  selectedModel === model.id ? "text-white" : "text-white/60"
                                )}>
                                  {model.id}
                                </div>
                                <div className="text-[10px] text-gemini-muted mt-0.5 leading-tight">
                                  {model.desc}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] text-gemini-muted uppercase tracking-widest font-bold">Core Online</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 bg-gemini-surface px-3 py-1.5 rounded-full border border-white/5">
                <span className="text-[10px] font-bold text-gemini-muted uppercase tracking-widest">
                  {chatSessions.find(s => s.id === selectedSessionId)?.title || 'New Chat'}
                </span>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-8 custom-scrollbar">
            {!selectedSessionId ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-8 max-w-2xl mx-auto px-4">
                <div className="w-20 h-20 rounded-full bg-gemini-accent/10 border border-gemini-accent/20 flex items-center justify-center mb-4">
                  <Bot className="w-10 h-10 text-gemini-accent" />
                </div>
                <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
                  Hello, I'm the Architect.
                </h2>
                <p className="text-gemini-muted text-base md:text-lg leading-relaxed">
                  How can I help you design your next project today? I can help with task management, system design, or general consultation.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-8">
                  {[
                    { icon: LayoutDashboard, text: "Help me organize my tasks" },
                    { icon: FolderKanban, text: "Start a new project structure" },
                  ].map((suggestion, idx) => (
                    <button 
                      key={idx}
                      onClick={async () => {
                        const newSessionId = crypto.randomUUID();
                        const newSession: ChatSession = {
                          id: newSessionId,
                          title: suggestion.text.slice(0, 30) + (suggestion.text.length > 30 ? '...' : ''),
                          createdAt: Date.now(),
                          userId: user.uid
                        };
                        
                        try {
                          await setDoc(doc(db, 'chatSessions', newSessionId), newSession);
                          setSelectedSessionId(newSessionId);
                          
                          // Send the message
                          const userMsgId = crypto.randomUUID();
                          const userMsg: Message = {
                            id: userMsgId,
                            role: 'user',
                            content: suggestion.text,
                            timestamp: Date.now(),
                            userId: user.uid,
                            sessionId: newSessionId
                          };
                          
                          setIsLoading(true);
                          await setDoc(doc(db, 'messages', userMsgId), userMsg);
                          
                          const response = await getChatResponse(suggestion.text, selectedModel);
                          
                          const aiMsgId = crypto.randomUUID();
                          const aiMsg: Message = {
                            id: aiMsgId,
                            role: 'model',
                            content: response || "I'm sorry, I couldn't process that request.",
                            timestamp: Date.now(),
                            userId: user.uid,
                            sessionId: newSessionId
                          };
                          await setDoc(doc(db, 'messages', aiMsgId), aiMsg);
                        } catch (error) {
                          console.error("Failed to process suggestion:", error);
                          const errorMsgId = crypto.randomUUID();
                          const errorMsg: Message = {
                            id: errorMsgId,
                            role: 'model',
                            content: "Error: Failed to connect to the System Architect core. Please check your connection or API key.",
                            timestamp: Date.now(),
                            userId: user.uid,
                            sessionId: newSessionId
                          };
                          await setDoc(doc(db, 'messages', errorMsgId), errorMsg).catch(console.error);
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      className="flex items-center gap-4 p-5 bg-gemini-surface border border-white/5 rounded-3xl hover:bg-white/10 transition-all text-left group shadow-sm"
                    >
                      <suggestion.icon className="w-6 h-6 text-gemini-accent group-hover:scale-110 transition-transform" />
                      <span className="text-sm text-white/70 group-hover:text-white transition-colors">{suggestion.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-4 md:gap-6 max-w-[90%] md:max-w-[80%]",
                    msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                    msg.role === 'user' ? "bg-gemini-surface border border-white/10" : "bg-gemini-accent/20 border border-gemini-accent/30"
                  )}>
                    {msg.role === 'user' ? <UserIcon className="w-4 h-4 md:w-5 md:h-5" /> : <Bot className="w-4 h-4 md:w-5 md:h-5 text-gemini-accent" />}
                  </div>
                  <div className={cn(
                    "p-4 md:p-5 rounded-3xl text-sm md:text-base leading-relaxed shadow-sm",
                    msg.role === 'user' 
                      ? "bg-gemini-surface text-white rounded-tr-none" 
                      : "bg-transparent text-white/90 rounded-tl-none"
                  )}>
                    <div className="markdown-body prose prose-invert prose-sm md:prose-base max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    <div className={cn(
                      "text-[10px] mt-3 opacity-40 font-medium",
                      msg.role === 'user' ? "text-right" : "text-left"
                    )}>
                      {format(msg.timestamp, 'HH:mm')}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
            {isLoading && (
              <div className="flex gap-4 md:gap-6 mr-auto max-w-[85%]">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gemini-accent/20 border border-gemini-accent/30 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 md:w-5 md:h-5 text-gemini-accent" />
                </div>
                <div className="bg-transparent p-5 rounded-3xl rounded-tl-none">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-gemini-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gemini-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gemini-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <footer className="p-4 md:p-8 bg-gemini-bg">
            <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="Ask Architect..."
                className="w-full bg-gemini-surface border border-white/5 rounded-[2rem] py-4 md:py-5 pl-6 pr-16 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-gemini-accent/20 transition-all resize-none max-h-48 shadow-lg placeholder:text-gemini-muted"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-3 bottom-3 p-3 bg-gemini-accent hover:bg-gemini-accent/80 disabled:opacity-50 disabled:bg-white/10 text-white rounded-full transition-all shadow-md"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
            <p className="text-[10px] text-center mt-6 text-gemini-muted uppercase tracking-[0.2em] font-bold">
              Architect AI made by Rudra Biloriya
            </p>
          </footer>
        </section>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {(isSessionModalOpen || isProfileModalOpen) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4"
            onClick={() => {
              setIsSessionModalOpen(false);
              setIsProfileModalOpen(false);
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-gemini-bg border border-white/10 rounded-[2.5rem] w-full max-w-md p-8 md:p-10 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {isProfileModalOpen ? (
                <>
                  <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-24 h-24 rounded-full bg-gemini-accent/20 border-2 border-gemini-accent/30 flex items-center justify-center overflow-hidden mb-6 p-1 shadow-lg">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <UserIcon className="w-10 h-10 text-gemini-accent" />
                      )}
                    </div>
                    <h2 className="text-2xl font-display font-bold tracking-tight text-white">{user.displayName || 'Architect'}</h2>
                    <p className="text-gemini-muted text-xs font-mono mt-1">{user.email}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="p-5 bg-gemini-surface border border-white/5 rounded-3xl shadow-sm">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gemini-muted mb-2">Status</div>
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-bold text-white">Core Synchronized</span>
                      </div>
                    </div>
                    <div className="p-5 bg-gemini-surface border border-white/5 rounded-3xl shadow-sm">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gemini-muted mb-2">Member Since</div>
                      <div className="text-sm font-bold text-white">{format(user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date(), 'MMMM yyyy')}</div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-10">
                    <button 
                      onClick={logout}
                      className="flex-1 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-full font-bold text-[10px] uppercase tracking-widest transition-all border border-red-500/20"
                    >
                      Sign Out
                    </button>
                    <button 
                      onClick={() => setIsProfileModalOpen(false)}
                      className="flex-1 py-4 bg-gemini-surface hover:bg-white/10 text-white rounded-full font-bold text-[10px] uppercase tracking-widest transition-all border border-white/5"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-8">
                    <h3 className="text-2xl font-display font-bold tracking-tight text-white">
                      Initiate New Session
                    </h3>
                    <p className="text-gemini-muted text-sm mt-1">
                      Start a fresh consultation with the Architect.
                    </p>
                  </div>
                  <form onSubmit={addSession} className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gemini-muted uppercase tracking-[0.2em] ml-2">
                        Session Title
                      </label>
                      <input 
                        autoFocus
                        type="text"
                        placeholder="e.g., System Design Review"
                        value={newSessionTitle}
                        onChange={(e) => setNewSessionTitle(e.target.value)}
                        className="w-full bg-gemini-surface border border-white/5 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-gemini-accent/20 transition-all text-base placeholder:text-gemini-muted shadow-inner"
                      />
                    </div>
                    <div className="flex gap-4">
                      <button 
                        type="button"
                        onClick={() => {
                          setIsSessionModalOpen(false);
                          setNewSessionTitle('');
                        }}
                        className="flex-1 py-4 rounded-full bg-gemini-surface text-gemini-muted hover:text-white hover:bg-white/5 transition-all text-[10px] font-bold uppercase tracking-widest border border-white/5"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={!newSessionTitle.trim()}
                        className="flex-1 py-4 rounded-full bg-gemini-accent hover:bg-gemini-accent/80 disabled:opacity-50 text-white transition-all text-[10px] font-bold uppercase tracking-widest shadow-lg"
                      >
                        Start
                      </button>
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .markdown-body p {
          margin-bottom: 0.75rem;
        }
        .markdown-body p:last-child {
          margin-bottom: 0;
        }
        .markdown-body ul, .markdown-body ol {
          margin-bottom: 0.75rem;
          padding-left: 1.5rem;
        }
        .markdown-body li {
          margin-bottom: 0.4rem;
        }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 {
          font-family: 'Outfit', sans-serif;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: white;
        }
        .markdown-body code {
          background: rgba(255, 255, 255, 0.05);
          padding: 0.2rem 0.4rem;
          border-radius: 0.4rem;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.9em;
        }
        .markdown-body pre {
          background: #1E1E1E !important;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1rem;
          padding: 1.25rem;
          margin: 1rem 0;
        }
      `}</style>
    </div>
  );
}
