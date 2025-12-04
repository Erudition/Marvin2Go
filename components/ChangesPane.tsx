import React from 'react';
import { ChangeLogEntry } from '../types';
import { History, X, User, Bot, Plus, Trash2, CheckCircle2, Clock, Play, Pause } from 'lucide-react';
import { format } from 'date-fns';

interface ChangesPaneProps {
  changes: ChangeLogEntry[];
  onClose?: () => void;
}

export const ChangesPane: React.FC<ChangesPaneProps> = ({ changes, onClose }) => {
  const getIconForAction = (action: string) => {
    if (action.includes('Add Task')) return <Plus size={14} className="text-emerald-400" />;
    if (action.includes('Delete')) return <Trash2 size={14} className="text-red-400" />;
    if (action.includes('Complete')) return <CheckCircle2 size={14} className="text-green-400" />;
    if (action.includes('Start Timer')) return <Play size={14} className="text-amber-400" />;
    if (action.includes('Stop Timer')) return <Pause size={14} className="text-slate-400" />;
    if (action.includes('Add Time')) return <Clock size={14} className="text-blue-400" />;
    return <History size={14} className="text-slate-400" />;
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 w-full">
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-200 flex items-center">
          <History size={18} className="mr-2 text-amber-500" />
          Change Log
        </h2>
        {onClose && (
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {changes.length === 0 ? (
          <div className="text-center text-slate-600 mt-20">
            <p className="text-sm">No changes recorded yet.</p>
          </div>
        ) : (
          [...changes].reverse().map((change) => (
            <div key={change.id} className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 text-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                   <span className={`p-1 rounded-full ${change.actor === 'ai' ? 'bg-purple-900/50 text-purple-300' : 'bg-blue-900/50 text-blue-300'}`}>
                      {change.actor === 'ai' ? <Bot size={12} /> : <User size={12} />}
                   </span>
                   <span className="text-slate-500 text-xs">
                     {format(change.timestamp, 'HH:mm:ss')}
                   </span>
                </div>
                <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                  {getIconForAction(change.action)}
                  <span className="text-xs font-medium text-slate-300">{change.action}</span>
                </div>
              </div>
              
              <div className="text-slate-200 font-medium">
                {change.details}
                {change.actor === 'ai' && change.reason && (
                  <span className="text-slate-500 italic font-normal ml-1">
                    because {change.reason.replace(/^you said\s*/i, '').replace(/^"|"$/g, '')}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};