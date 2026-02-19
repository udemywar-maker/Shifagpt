
import React from 'react';
import { Character } from '../types.ts';

interface CharacterCardProps {
  character: Character;
  onSelect: (character: Character) => void;
  onEdit: (character: Character) => void;
  onDelete?: (id: string) => void;
  isSelected: boolean;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ character, onSelect, onEdit, onDelete, isSelected }) => {
  return (
    <div className="relative group px-1">
      <button
        onClick={() => onSelect(character)}
        className={`w-full flex items-center gap-3.5 p-3 rounded-[20px] transition-all duration-300 text-left ${
          isSelected 
            ? 'bg-indigo-600 shadow-lg shadow-indigo-200 text-white translate-x-1 scale-[1.02]' 
            : 'hover:bg-slate-50 text-slate-700'
        }`}
      >
        <div className="relative flex-shrink-0">
          <img
            src={character.avatar}
            alt={character.name}
            className={`w-11 h-11 rounded-2xl object-cover shadow-sm transition-all duration-300 ${isSelected ? 'ring-2 ring-white/50' : 'group-hover:scale-105'}`}
            onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(character.name)}&background=random&color=fff&size=128`; }}
          />
          {!isSelected && (
            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[2.5px] border-white shadow-sm ${character.color}`}></div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className={`text-[15px] font-black truncate leading-tight ${isSelected ? 'text-white' : 'text-slate-800'}`}>
            {character.name}
          </h3>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
            {character.role}
          </p>
        </div>

        {isSelected && (
          <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-white shadow-glow"></div>
        )}
      </button>

      <div className={`absolute top-1/2 -translate-y-1/2 right-4 flex items-center gap-1.5 transition-all duration-300 ${isSelected ? 'opacity-0 translate-x-4 pointer-events-none' : 'opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0'}`}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(character);
          }}
          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl shadow-xl border border-slate-100 transition-all bg-white/90"
        >
          <i className="fas fa-gear text-xs"></i>
        </button>

        {character.isUserAdded && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(character.id);
            }}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-white rounded-xl shadow-xl border border-slate-100 transition-all bg-white/90"
          >
            <i className="fas fa-trash text-xs"></i>
          </button>
        )}
      </div>
    </div>
  );
};

export default CharacterCard;