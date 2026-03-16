
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

  const [hiddenCharacters, setHiddenCharacters] = useState<string[]>(() => {
    const saved = localStorage.getItem('shifagpt_hidden_characters');
    return saved ? JSON.parse(saved) : [];
  });

  const [autoTalk, setAutoTalk] = useState<boolean>(true);

  const characters = useMemo(() => {
    const base = CHARACTERS.filter(char => !hiddenCharacters.includes(char.id)).map(char => {
      const override = customOverrides[char.id];
      return override ? { ...char, ...override, isCustomized: true } : char;
    });
    return [...base, ...userAddedCharacters];
  }, [customOverrides, userAddedCharacters, hiddenCharacters]);

  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(() => {
    const saved = localStorage.getItem('shifagpt_selected_character');
    return saved || 'husband';
  });

  useEffect(() => {
    if (selectedCharacterId) {
      localStorage.setItem('shifagpt_selected_character', selectedCharacterId);
    }
  }, [selectedCharacterId]);

  useEffect(() => {
    if (!selectedCharacterId && characters.length > 0) {
      setSelectedCharacterId(characters[0].id);
    }
  }, [selectedCharacterId, characters]);

  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (selectedCharacterId) {
      const char = characters.find(c => c.id === selectedCharacterId);
      if (char) {
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
    }
  }, [selectedCharacterId]); // Only run when selectedCharacterId changes

  const [inputValue, setInputValue] = useState('');
  const [chatState, setChatState] = useState<ChatState>(ChatState.IDLE);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ base64: string, mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
    localStorage.setItem('shifagpt_hidden_characters', JSON.stringify(hiddenCharacters));
  }, [hiddenCharacters]);

  useEffect(() => {
    if (selectedCharacterId && messages.length > 0) {
      localStorage.setItem(`shifagpt_history_${selectedCharacterId}`, JSON.stringify(messages));
    }
  }, [messages, selectedCharacterId]);

  const handleSelectCharacter = (char: Character) => {
    setSelectedCharacterId(char.id);
  };

  const handleSaveCustomization = (id: string, updates: any) => {
    if (isCreating) {
      const newChar: Character = { 
        ...updates, 
        id, 
        isUserAdded: true,
        voiceName: updates.voiceName || (updates.gender === 'female' ? 'Aoede' : 'Fenrir')
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
    setConfirmDialog({
      isOpen: true,
      title: "Delete Character",
      message: "Are you sure you want to permanently delete this character and their chat history?",
      onConfirm: () => {
        const isOriginal = CHARACTERS.some(c => c.id === id);
        if (isOriginal) {
          setHiddenCharacters(prev => [...prev, id]);
        } else {
          setUserAddedCharacters(prev => prev.filter(c => c.id !== id));
        }
        localStorage.removeItem(`shifagpt_history_${id}`);
        if (selectedCharacterId === id) {
          setSelectedCharacterId(null);
          setMessages([]);
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleClearChat = () => {
    if (selectedCharacter) {
      setConfirmDialog({
        isOpen: true,
        title: "Clear Chat History",
        message: "Are you sure you want to clear the chat history? This cannot be undone.",
        onConfirm: () => {
          const initialGreeting: Message = {
            id: 'initial-' + Date.now(),
            role: 'model',
            content: `Hi! it's me, ${selectedCharacter.name}. I've been waiting for you to message. How are you feeling today?`,
            timestamp: Date.now()
          };
          setMessages([initialGreeting]);
          localStorage.removeItem(`shifagpt_history_${selectedCharacter.id}`);
          geminiService.resetChat(selectedCharacter.id);
          setConfirmDialog(null);
        }
      });
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputValue.trim() && !selectedImage) || !selectedCharacter || chatState !== ChatState.IDLE) return;

    const userMsgText = inputValue.trim();
    const userMessage: Message = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: userMsgText,
      timestamp: Date.now(),
      status: 'sent',
      imageBase64: selectedImage?.base64,
      mimeType: selectedImage?.mimeType
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    const imageToSend = selectedImage;
    setSelectedImage(null);
    setChatState(ChatState.LOADING);
    setTimeout(() => scrollToBottom(true), 50);

    try {
      const modelMessageId = 'model-' + Date.now();
      let fullContent = '';
      const stream = geminiService.sendMessageStream(selectedCharacter, userMsgText, imageToSend?.base64, imageToSend?.mimeType);
      
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        setSelectedImage({
          base64: base64Data,
          mimeType: file.type
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans">
      <aside className={`${isSidebarOpen ? 'w-full md:w-80' : 'w-0'} bg-[#0a0a0a] border-r border-white/10 transition-all duration-500 ease-in-out flex flex-col z-50 overflow-hidden shrink-0`}>
        <div className="p-7 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center shadow-lg shadow-black/50 rotate-3 border border-white/10">
              <i className="fas fa-heart text-white/80 text-lg"></i>
            </div>
            <h1 className="text-2xl font-serif font-semibold tracking-tight text-white">ShifaGPT</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-white/40 hover:text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
          <div className="mb-6 mt-2 flex items-center justify-between px-2">
            <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Your Circles</span>
            <button onClick={() => setIsCreating(true)} className="w-8 h-8 flex items-center justify-center bg-white/5 text-white/70 rounded-full hover:bg-white/20 hover:text-white transition-all border border-white/10">
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

        <div className="p-4 border-t border-white/5 text-center flex flex-col items-center gap-2">
          {hiddenCharacters.length > 0 && (
            <button 
              onClick={() => setHiddenCharacters([])}
              className="text-[10px] font-bold text-white/50 hover:text-white uppercase tracking-widest transition-colors"
            >
              Restore Default Character
            </button>
          )}
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
            Privacy First Roleplay
          </p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative atmosphere overflow-hidden">
        <header className="h-20 glass border-b border-white/10 flex items-center justify-between px-8 z-40">
          <div className="flex items-center gap-5">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 -ml-3 text-white/50 hover:text-white">
                <i className="fas fa-bars-staggered"></i>
              </button>
            )}
            {selectedCharacter && (
              <div className="flex items-center gap-4 animate-in fade-in duration-500">
                <div className="relative">
                  <img src={selectedCharacter.avatar} className="w-11 h-11 rounded-2xl object-cover shadow-sm ring-1 ring-white/20" alt="" />
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0a0a0a] ${isTyping ? 'bg-white animate-pulse' : 'bg-emerald-500'}`}></div>
                </div>
                <div>
                  <h2 className="text-lg font-serif font-semibold text-white leading-none mb-1">{selectedCharacter.name}</h2>
                  <div className="flex items-center h-4">
                    {isTyping ? (
                      <span className="text-[10px] font-bold text-white/70 animate-pulse flex items-center gap-1.5 uppercase tracking-wider">
                        <span className="flex gap-0.5">
                          <span className="w-1 h-1 bg-white/70 rounded-full animate-bounce"></span>
                          <span className="w-1 h-1 bg-white/70 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-1 h-1 bg-white/70 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        </span>
                        Thinking...
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{selectedCharacter.role}</span>
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
                  onClick={handleClearChat}
                  className="w-10 h-10 flex items-center justify-center rounded-2xl text-white/50 hover:text-rose-400 hover:bg-white/10 transition-all" 
                  title="Clear Chat History"
                >
                  <i className="fas fa-eraser text-sm"></i>
                </button>
                <button 
                  onClick={() => setAutoTalk(!autoTalk)}
                  className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all ${autoTalk ? 'text-white bg-white/20' : 'text-white/50 hover:bg-white/10'}`}
                  title={autoTalk ? "Disable Auto-Talk" : "Enable Auto-Talk"}
                >
                  <i className={`fas ${autoTalk ? 'fa-volume-high' : 'fa-volume-xmark'} text-sm`}></i>
                </button>
                <button onClick={() => setEditingCharacter(selectedCharacter)} className="w-10 h-10 flex items-center justify-center rounded-2xl text-white/50 hover:text-white hover:bg-white/10 transition-all" title="Customize Character">
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
                <h1 className="text-3xl font-serif font-light text-white/50 mb-6 tracking-tight">
                  No characters available.
                </h1>
                <button 
                  onClick={() => setIsCreating(true)}
                  className="px-6 py-3 bg-white text-black rounded-full font-bold text-sm hover:scale-105 transition-transform"
                >
                  Create Character
                </button>
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
                    <img src={selectedCharacter.avatar} className="w-9 h-9 rounded-full shadow-md border border-white/10" alt="" />
                    <div className="bg-transparent px-6 py-4 rounded-[28px] rounded-bl-sm border border-white/10 flex gap-2 items-center shadow-sm">
                      <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce"></div>
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
            <div className="max-w-3xl mx-auto flex flex-col gap-3 animate-in slide-in-from-bottom-6 duration-500">
              {selectedImage && (
                <div className="relative self-start mb-2">
                  <img src={`data:${selectedImage.mimeType};base64,${selectedImage.base64}`} alt="Selected" className="h-24 w-24 object-cover rounded-xl border border-white/20 shadow-lg" />
                  <button 
                    onClick={() => setSelectedImage(null)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-md hover:bg-rose-600 transition-colors"
                  >
                    <i className="fas fa-times text-xs"></i>
                  </button>
                </div>
              )}
              <div className="flex items-end gap-3">
                <div className="flex-1 glass rounded-[32px] shadow-2xl focus-within:ring-1 ring-white/30 transition-all flex items-center px-4 py-1.5">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 mr-2"
                    title="Upload Image"
                  >
                    <i className="fas fa-image text-lg"></i>
                  </button>
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
                    className="w-full bg-transparent py-4 focus:outline-none resize-none text-[16px] font-light text-white placeholder:text-white/30"
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
                  disabled={(!inputValue.trim() && !selectedImage) || chatState !== ChatState.IDLE}
                  className={`w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
                    (inputValue.trim() || selectedImage) && chatState === ChatState.IDLE
                      ? 'bg-white text-black shadow-xl hover:bg-white/90 hover:scale-105 active:scale-95'
                      : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10'
                  }`}
                >
                  <i className={`fas ${chatState === ChatState.LOADING ? 'fa-spinner fa-spin' : 'fa-paper-plane'} text-lg`}></i>
                </button>
              </div>
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

      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-serif font-semibold text-white mb-2">{confirmDialog.title}</h3>
            <p className="text-white/60 text-sm mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
