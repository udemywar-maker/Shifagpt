
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Character, Message, ChatState, CharacterCustomization } from './types.ts';
import { CHARACTERS } from './constants.ts';
import { geminiService } from './services/geminiService.ts';
import CharacterCard from './components/CharacterCard.tsx';
import MessageBubble from './components/MessageBubble.tsx';
import CharacterEditor from './components/CharacterEditor.tsx';

const App: React.FC = () => {
  const [customOverrides, setCustomOverrides] = useState<Record<string, CharacterCustomization>>(() => {
    const saved = localStorage.getItem('shifagpt_custom_characters');
    return saved ? JSON.parse(saved) : {};
  });

  const [userAddedCharacters, setUserAddedCharacters] = useState<Character[]>(() => {
    const saved = localStorage.getItem('shifagpt_user_characters');
    return saved ? JSON.parse(saved) : [];
  });

  const [autoTalk, setAutoTalk] = useState<boolean>(() => {
    const saved = localStorage.getItem('shifagpt_auto_talk');
    return saved === 'true';
  });

  const characters = useMemo(() => {
    const base = CHARACTERS.map(char => {
      const override = customOverrides[char.id];
      return override ? { ...char, ...override, isCustomized: true } : char;
    });
    return [...base, ...userAddedCharacters];
  }, [customOverrides, userAddedCharacters]);

  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [chatState, setChatState] = useState<ChatState>(ChatState.IDLE);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottomRef = useRef<boolean>(true);

  const selectedCharacter = useMemo(() => 
    characters.find(c => c.id === selectedCharacterId) || null,
    [characters, selectedCharacterId]
  );

  const scrollToBottom = (force = false) => {
    if (force || isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    isAtBottomRef.current = atBottom;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, chatState]);

  useEffect(() => {
    localStorage.setItem('shifagpt_auto_talk', autoTalk.toString());
  }, [autoTalk]);

  useEffect(() => {
    localStorage.setItem('shifagpt_custom_characters', JSON.stringify(customOverrides));
  }, [customOverrides]);

  useEffect(() => {
    localStorage.setItem('shifagpt_user_characters', JSON.stringify(userAddedCharacters));
  }, [userAddedCharacters]);

  useEffect(() => {
    if (selectedCharacterId && messages.length > 0) {
      localStorage.setItem(`shifagpt_history_${selectedCharacterId}`, JSON.stringify(messages));
    }
  }, [messages, selectedCharacterId]);

  const handleSelectCharacter = (char: Character) => {
    const previousId = selectedCharacterId;
    setSelectedCharacterId(char.id);
    
    if (previousId !== char.id) {
      const savedHistory = localStorage.getItem(`shifagpt_history_${char.id}`);
      if (savedHistory) {
        setMessages(JSON.parse(savedHistory));
      } else {
        const initialGreeting: Message = {
          id: 'initial-' + Date.now(),
          role: 'model',
          content: `Hi! it's me, ${char.name}. I've been waiting for you to message. How are you feeling today?`,
          timestamp: Date.now()
        };
        setMessages([initialGreeting]);
      }
      setTimeout(() => scrollToBottom(true), 100);
    }
  };

  const handleSaveCustomization = (id: string, updates: any) => {
    if (isCreating) {
      const newChar: Character = { 
        ...updates, 
        id, 
        isUserAdded: true,
        voiceName: updates.voiceName || (updates.gender === 'female' ? 'Aoede' : 'Zephyr')
      };
      setUserAddedCharacters(prev => [...prev, newChar]);
      setIsCreating(false);
      handleSelectCharacter(newChar);
    } else {
      const isOriginal = CHARACTERS.some(c => c.id === id);
      if (isOriginal) {
        setCustomOverrides(prev => ({ ...prev, [id]: updates }));
      } else {
        setUserAddedCharacters(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      }
      setEditingCharacter(null);
      if (selectedCharacterId === id) geminiService.resetChat(id);
    }
  };

  const handleDeleteCharacter = (id: string) => {
    if (confirm("Permanently delete this character and history?")) {
      setUserAddedCharacters(prev => prev.filter(c => c.id !== id));
      localStorage.removeItem(`shifagpt_history_${id}`);
      if (selectedCharacterId === id) {
        setSelectedCharacterId(null);
        setMessages([]);
      }
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || !selectedCharacter || chatState !== ChatState.IDLE) return;

    const userMsgText = inputValue.trim();
    const userMessage: Message = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: userMsgText,
      timestamp: Date.now(),
      status: 'sent'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setChatState(ChatState.LOADING);
    setTimeout(() => scrollToBottom(true), 50);

    try {
      const modelMessageId = 'model-' + Date.now();
      let fullContent = '';
      const stream = geminiService.sendMessageStream(selectedCharacter, userMsgText);
      
      setMessages(prev => [...prev, {
        id: modelMessageId,
        role: 'model',
        content: '',
        timestamp: Date.now()
      }]);

      for await (const chunk of stream) {
        fullContent += chunk as string;
        setMessages(prev => prev.map(msg => 
          msg.id === modelMessageId ? { ...msg, content: fullContent } : msg
        ));
        setChatState(ChatState.CHATTING);
      }
      
      setChatState(ChatState.IDLE);
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id ? { ...msg, status: 'seen' } : msg
      ));

      if (autoTalk) {
        geminiService.speak(fullContent, selectedCharacter.voiceName);
      }
    } catch (error) {
      setChatState(ChatState.ERROR);
      setMessages(prev => [...prev, {
        id: 'err-' + Date.now(),
        role: 'model',
        content: "Something went wrong. Let's try that again?",
        timestamp: Date.now()
      }]);
      setTimeout(() => setChatState(ChatState.IDLE), 2000);
    }
  };

  const isTyping = chatState === ChatState.LOADING || chatState === ChatState.CHATTING;

  return (
    <div className="flex h-screen bg-white text-slate-900 overflow-hidden font-sans">
      <aside className={`${isSidebarOpen ? 'w-full md:w-80' : 'w-0'} bg-white border-r border-slate-100 transition-all duration-500 ease-in-out flex flex-col z-50 overflow-hidden shrink-0`}>
        <div className="p-7 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 rotate-3">
              <i className="fas fa-heart text-white text-lg"></i>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">ShifaGPT</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-900">
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
          <div className="mb-6 mt-2 flex items-center justify-between px-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Your Circles</span>
            <button onClick={() => setIsCreating(true)} className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-600 hover:text-white transition-all">
              <i className="fas fa-plus text-xs"></i>
            </button>
          </div>
          
          <nav className="space-y-1.5 pb-10">
            {characters.map(char => (
              <CharacterCard 
                key={char.id} 
                character={char} 
                isSelected={selectedCharacterId === char.id}
                onSelect={(c) => {
                  handleSelectCharacter(c);
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                onEdit={(c) => setEditingCharacter(c)}
                onDelete={handleDeleteCharacter}
              />
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-50 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Privacy First Roleplay
          </p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative mesh-gradient overflow-hidden">
        <header className="h-20 glass border-b border-slate-100 flex items-center justify-between px-8 z-40">
          <div className="flex items-center gap-5">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 -ml-3 text-slate-500 hover:text-indigo-600">
                <i className="fas fa-bars-staggered"></i>
              </button>
            )}
            {selectedCharacter && (
              <div className="flex items-center gap-4 animate-in fade-in duration-500">
                <div className="relative">
                  <img src={selectedCharacter.avatar} className="w-11 h-11 rounded-2xl object-cover shadow-sm ring-2 ring-white" alt="" />
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${isTyping ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 leading-none mb-1">{selectedCharacter.name}</h2>
                  <div className="flex items-center h-4">
                    {isTyping ? (
                      <span className="text-[10px] font-bold text-indigo-500 animate-pulse flex items-center gap-1.5 uppercase tracking-wider">
                        <span className="flex gap-0.5">
                          <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce"></span>
                          <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        </span>
                        Thinking...
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{selectedCharacter.role}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {selectedCharacter && (
              <>
                <button 
                  onClick={() => setAutoTalk(!autoTalk)}
                  className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all ${autoTalk ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:bg-slate-50'}`}
                >
                  <i className={`fas ${autoTalk ? 'fa-volume-high' : 'fa-volume-xmark'} text-sm`}></i>
                </button>
                <button onClick={() => setEditingCharacter(selectedCharacter)} className="w-10 h-10 flex items-center justify-center rounded-2xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                  <i className="fas fa-sliders text-sm"></i>
                </button>
              </>
            )}
          </div>
        </header>

        <div 
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 md:px-10 py-10 relative custom-scrollbar"
        >
          {!selectedCharacter ? (
            <div className="h-full flex flex-col items-center justify-center animate-in fade-in zoom-in duration-700">
              <div className="text-center max-w-4xl mx-auto w-full px-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[11px] font-black uppercase tracking-widest mb-6">
                  <i className="fas fa-sparkles"></i> AI Companion Suite
                </div>
                <h1 className="text-5xl md:text-6xl font-black text-slate-900 mb-6 tracking-tight">
                  Who do you want to <br/><span className="text-indigo-600">talk to today?</span>
                </h1>
                <p className="text-slate-500 text-lg mb-16 max-w-xl mx-auto font-medium">
                  Private conversations with personalities designed to understand you.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {characters.slice(0, 6).map((char) => (
                    <div 
                      key={char.id}
                      onClick={() => handleSelectCharacter(char)}
                      className="group bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm character-card-hover transition-all cursor-pointer text-left relative overflow-hidden"
                    >
                      <img src={char.avatar} className="w-16 h-16 rounded-3xl object-cover mb-5 shadow-lg group-hover:rotate-3 transition-transform" alt={char.name} />
                      <h4 className="text-xl font-black text-slate-900 mb-1">{char.name}</h4>
                      <div className="text-indigo-500 text-[11px] font-black uppercase tracking-widest mb-3">{char.role}</div>
                      <p className="text-slate-500 text-sm font-medium line-clamp-2">{char.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto flex flex-col gap-1 pb-10">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} character={selectedCharacter} />
              ))}
              {chatState === ChatState.LOADING && (
                <div className="flex justify-start mb-6 message-in">
                  <div className="flex items-end gap-3">
                    <img src={selectedCharacter.avatar} className="w-9 h-9 rounded-full shadow-md border-2 border-white" alt="" />
                    <div className="bg-white px-6 py-4 rounded-[28px] rounded-bl-sm border border-slate-100 flex gap-2 items-center shadow-sm">
                      <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {selectedCharacter && (
          <div className="px-6 md:px-12 pb-10 pt-2 z-40 relative">
            <div className="max-w-3xl mx-auto flex items-end gap-3 animate-in slide-in-from-bottom-6 duration-500">
              <div className="flex-1 glass rounded-[32px] shadow-2xl shadow-indigo-900/5 focus-within:ring-4 ring-indigo-500/10 transition-all flex items-center px-6 py-1.5">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={`Message ${selectedCharacter.name}...`}
                  rows={1}
                  className="w-full bg-transparent py-4 focus:outline-none resize-none text-[16px] font-medium text-slate-800 placeholder:text-slate-400"
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                  }}
                />
              </div>
              <button
                type="submit"
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || chatState !== ChatState.IDLE}
                className={`w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
                  inputValue.trim() && chatState === ChatState.IDLE
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-400/30 hover:bg-indigo-700 hover:scale-110 active:scale-95'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                }`}
              >
                <i className={`fas ${chatState === ChatState.LOADING ? 'fa-spinner fa-spin' : 'fa-paper-plane'} text-lg`}></i>
              </button>
            </div>
          </div>
        )}
      </main>

      {(editingCharacter || isCreating) && (
        <CharacterEditor 
          character={editingCharacter || {}}
          onSave={handleSaveCustomization}
          onCancel={() => { setEditingCharacter(null); setIsCreating(false); }}
          isNew={isCreating}
        />
      )}
    </div>
  );
};

export default App;
