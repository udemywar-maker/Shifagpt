
import React, { useState, useEffect, useMemo } from 'react';
import { Character, CharacterCustomization } from '../types.ts';
import { geminiService } from '../services/geminiService.ts';

interface CharacterEditorProps {
  character: Partial<Character>;
  onSave: (id: string, updates: CharacterCustomization & { gender?: 'male' | 'female', color?: string, voiceName: string }) => void;
  onCancel: () => void;
  isNew?: boolean;
}

const COLORS = [
  'bg-blue-500', 'bg-indigo-500', 'bg-rose-400', 'bg-slate-600', 
  'bg-teal-500', 'bg-orange-500', 'bg-purple-500', 'bg-emerald-500'
];

const ALL_VOICES = [
  { id: 'Zephyr', name: 'Zephyr (Male - Deep & Warm)', gender: 'male' },
  { id: 'Fenrir', name: 'Fenrir (Male - Sturdy & Deep)', gender: 'male' },
  { id: 'Puck', name: 'Puck (Male - Energetic)', gender: 'male' },
  { id: 'Charon', name: 'Charon (Male - Casual)', gender: 'male' },
  { id: 'Aoede', name: 'Aoede (Female - Wise & Warm)', gender: 'female' },
  { id: 'Kore', name: 'Kore (Female - Bright)', gender: 'female' },
];

const CharacterEditor: React.FC<CharacterEditorProps> = ({ character, onSave, onCancel, isNew = false }) => {
  const [formData, setFormData] = useState({
    name: character.name || '',
    role: character.role || '',
    avatar: character.avatar || '',
    description: character.description || '',
    systemPrompt: character.systemPrompt || '',
    gender: character.gender || 'male',
    color: character.color || COLORS[0],
    voiceName: character.voiceName || (character.gender === 'female' ? 'Aoede' : 'Fenrir')
  });

  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);

  // Filter voices based on current gender
  const filteredVoices = useMemo(() => {
    return ALL_VOICES.filter(v => v.gender === formData.gender);
  }, [formData.gender]);

  // Sync voice if gender changes and current voice doesn't match new gender
  useEffect(() => {
    const currentVoice = ALL_VOICES.find(v => v.id === formData.voiceName);
    if (!currentVoice || currentVoice.gender !== formData.gender) {
      setFormData(prev => ({
        ...prev,
        voiceName: formData.gender === 'female' ? 'Aoede' : 'Fenrir'
      }));
    }
  }, [formData.gender]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePreviewVoice = async () => {
    if (isPreviewing) return;
    setIsPreviewing(true);
    try {
      const previewText = formData.gender === 'male' 
        ? "Hello there, I am ready to talk to you." 
        : "Hi sweetheart, I'm so glad to hear from you.";
      await geminiService.speak(previewText, formData.voiceName);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleGenerateAvatar = async () => {
    if (!formData.name || !formData.role) {
      alert("Please enter a name and role first to generate a matching avatar.");
      return;
    }
    
    setIsGeneratingAvatar(true);
    try {
      const avatarUrl = await geminiService.generateAvatar(formData.name, formData.role, formData.gender);
      if (avatarUrl) {
        setFormData(prev => ({ ...prev, avatar: avatarUrl }));
      } else {
        alert("Failed to generate avatar. Please try again.");
      }
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalAvatar = formData.avatar.trim();
    if (!finalAvatar) {
      const bgColor = formData.gender === 'male' ? '6366f1' : 'f43f5e';
      const nameParam = encodeURIComponent(formData.name || formData.role || 'AI');
      finalAvatar = `https://ui-avatars.com/api/?name=${nameParam}&background=${bgColor}&color=fff&size=512&bold=true`;
    }

    onSave(character.id || 'new-' + Date.now(), { ...formData, avatar: finalAvatar });
  };

  const avatarPreview = formData.avatar.trim() || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || 'AI')}&background=${formData.gender === 'male' ? '6366f1' : 'f43f5e'}&color=fff&size=512&bold=true`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#050505]/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#0a0a0a] w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/10">
        <div className="px-8 py-6 border-b border-white/10 flex justify-between items-center bg-[#141414]">
          <div>
            <h2 className="text-2xl font-serif font-bold text-white">{isNew ? 'Create New Character' : `Customize ${formData.role || character.role}`}</h2>
            <p className="text-xs text-white/50">{isNew ? 'Bring a new personality to life.' : 'Tailor the persona to your preference.'}</p>
          </div>
          <button onClick={onCancel} className="p-2 text-white/40 hover:text-white transition-colors">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5 ml-1">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-2xl border border-white/10 bg-[#1a1a1a] text-white focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/30 transition-all font-medium placeholder-white/20"
                  required
                  placeholder="e.g., Alex"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5 ml-1">Relationship Role</label>
                <input
                  type="text"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-2xl border border-white/10 bg-[#1a1a1a] text-white focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/30 transition-all font-medium placeholder-white/20"
                  required
                  placeholder="e.g., Husband"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5 ml-1">Character Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-2xl border border-white/10 bg-[#1a1a1a] text-white focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/30 transition-all font-semibold"
                >
                  <option value="male">Male Voice Type</option>
                  <option value="female">Female Voice Type</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5 ml-1">Voice Personality</label>
                <div className="flex gap-2">
                  <select
                    name="voiceName"
                    value={formData.voiceName}
                    onChange={handleChange}
                    className="flex-1 px-4 py-3 rounded-2xl border border-white/10 bg-[#1a1a1a] text-[#c4a977] focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/30 transition-all font-semibold"
                  >
                    {filteredVoices.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handlePreviewVoice}
                    className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all border border-white/10 ${isPreviewing ? 'bg-white/10 text-white' : 'bg-[#1a1a1a] text-white/50 hover:bg-white/5 hover:text-white'}`}
                    title="Test Voice"
                  >
                    <i className={`fas ${isPreviewing ? 'fa-spinner fa-spin' : 'fa-play'}`}></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-[#141414] rounded-2xl border border-dashed border-white/20">
            <div className="relative group">
              <img 
                src={avatarPreview} 
                alt="Preview" 
                className="w-16 h-16 rounded-full object-cover shadow-sm bg-[#1a1a1a]" 
                onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || 'AI')}&background=random`; }} 
              />
              {isGeneratingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/60 rounded-full">
                  <i className="fas fa-spinner fa-spin text-white"></i>
                </div>
              )}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex justify-between items-end mb-1">
                <label className="text-[10px] text-white/40 uppercase font-bold ml-1">Avatar URL</label>
                <button
                  type="button"
                  onClick={handleGenerateAvatar}
                  disabled={isGeneratingAvatar}
                  className="text-[10px] font-bold text-[#c4a977] hover:text-white uppercase tracking-wider flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  <i className={`fas ${isGeneratingAvatar ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                  {isGeneratingAvatar ? 'Generating...' : 'AI Generate'}
                </button>
              </div>
              <input
                type="url"
                name="avatar"
                value={formData.avatar}
                onChange={handleChange}
                className="w-full px-3 py-1.5 text-xs text-[#c4a977] bg-[#1a1a1a] border border-white/10 rounded-lg focus:outline-none focus:border-white/30 placeholder-white/20"
                placeholder="Leave blank for auto-generated avatar"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5 ml-1">AI Behavior Instructions</label>
            <textarea
              name="systemPrompt"
              value={formData.systemPrompt}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-3 rounded-2xl border border-white/10 bg-[#1a1a1a] text-white focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/30 transition-all text-sm leading-relaxed resize-none placeholder-white/20"
              placeholder="e.g., 'You are Ethan, my caring husband...'"
              required
            />
          </div>
        </form>

        <div className="px-8 py-6 bg-[#141414] border-t border-white/10 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="px-6 py-3 rounded-2xl text-sm font-semibold text-white/60 hover:bg-white/5 hover:text-white transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} className="px-8 py-3 rounded-2xl bg-white text-[#0a0a0a] text-sm font-bold shadow-lg shadow-white/10 hover:bg-gray-200 active:scale-95 transition-all">
            {isNew ? 'Create Character' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CharacterEditor;
