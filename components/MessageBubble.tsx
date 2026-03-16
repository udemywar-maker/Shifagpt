
import React, { useState } from 'react';
import { Message, Character } from '../types.ts';
import { geminiService } from '../services/geminiService.ts';

interface MessageBubbleProps {
  message: Message;
  character: Character;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, character }) => {
  const isUser = message.role === 'user';
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayAudio = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      await geminiService.speak(message.content, character.voiceName);
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <div className={`flex w-full mb-3 ${isUser ? 'justify-end' : 'justify-start'} message-in`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] group ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <div className="flex-shrink-0 mt-auto mb-1 mr-3">
            <img 
              src={character.avatar} 
              alt={character.name} 
              className="w-9 h-9 rounded-2xl shadow-md object-cover ring-1 ring-white/10"
              onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(character.name)}&background=random`; }}
            />
          </div>
        )}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div
            className={`relative px-6 py-3.5 text-[15px] font-light leading-relaxed whitespace-pre-wrap transition-all shadow-sm ${
              isUser
                ? 'bg-white/10 text-white rounded-[28px] rounded-br-sm border border-white/10'
                : 'bg-transparent text-white/90 rounded-[28px] rounded-bl-sm border border-white/10'
            }`}
          >
            {message.imageBase64 && message.mimeType && (
              <div className="mb-3">
                <img 
                  src={`data:${message.mimeType};base64,${message.imageBase64}`} 
                  alt="Uploaded content" 
                  className="max-w-full h-auto rounded-xl border border-white/10 shadow-md max-h-64 object-contain"
                />
              </div>
            )}
            {message.content}
            {!isUser && message.content && (
              <button 
                onClick={handlePlayAudio}
                className={`absolute -right-2 -bottom-2 w-8 h-8 rounded-full shadow-lg flex items-center justify-center transition-all bg-[#1a1a1a] border border-white/10 ${isPlaying ? 'text-white' : 'text-white/40 hover:text-white hover:scale-110'}`}
              >
                <i className={`fas ${isPlaying ? 'fa-volume-high animate-pulse' : 'fa-play text-[10px]'}`}></i>
              </button>
            )}
          </div>
          <div className={`flex items-center gap-2 mt-1.5 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${isUser ? 'flex-row-reverse' : ''}`}>
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {isUser && message.status && (
              <div className="flex items-center gap-1">
                 {message.status === 'seen' ? (
                   <i className="fas fa-check-double text-[8px] text-white/50"></i>
                 ) : (
                   <i className="fas fa-check text-[8px] text-white/20"></i>
                 )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
