import React from 'react';
import { Task } from '../types';
import { Play, Pause, Clock } from 'lucide-react';
import { formatDurationCompact } from '../utils/time';

interface FocusBarProps {
  task: Task;
  isActive: boolean;
  onToggle: () => void;
}

export const FocusBar: React.FC<FocusBarProps> = ({ task, isActive, onToggle }) => {
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m < 10 && h > 0 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  };

  const progress = task.timeEstimate 
    ? Math.min((task.timeSpent * 1000) / task.timeEstimate, 1) * 100 
    : 0;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 bg-slate-900/90 backdrop-blur-md border-t border-slate-700/50">
      {/* Progress Line */}
      {task.timeEstimate && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-slate-800">
           <div 
             className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
             style={{ width: `${progress}%` }}
           />
        </div>
      )}

      <div className="flex items-center justify-between p-4 pr-24 max-w-7xl mx-auto">
        <div className="flex-1 min-w-0 mr-4">
           <div className="flex items-center text-xs text-amber-500 font-medium uppercase tracking-wider mb-0.5">
              <Clock size={12} className="mr-1.5" />
              {isActive ? 'Focusing' : 'Paused'}
           </div>
           <div className="text-slate-200 font-medium truncate text-sm">
             {task.title}
           </div>
        </div>

        <div className="flex items-center space-x-4">
           <div className="text-right">
             <div className="text-slate-200 font-mono text-sm font-medium">
               {formatTime(task.timeSpent)}
             </div>
             {task.timeEstimate && (
               <div className="text-slate-500 text-xs">
                 / {formatDurationCompact(task.timeEstimate / 1000)}
               </div>
             )}
           </div>

           <button
             onClick={onToggle}
             className={`p-3 rounded-full transition-all ${
                isActive 
                  ? 'bg-amber-500 text-slate-900 hover:bg-amber-400' 
                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600 hover:text-white'
             }`}
           >
             {isActive ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current" />}
           </button>
        </div>
      </div>
    </div>
  );
};
