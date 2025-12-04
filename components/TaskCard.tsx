

import React from 'react';
import { Task, TaskStatus, Category, Label } from '../types';
import { CheckCircle2, Circle, Clock, Play, Pause, Trash2, Folder, Square, ChevronRight, Tag } from 'lucide-react';
import { formatDurationCompact } from '../utils/time';

interface TaskCardProps {
  task: Task;
  categoryPath: Category[];
  labels: Label[];
  isActive: boolean;
  onToggleStatus: (id: string) => void;
  onToggleTimer: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  categoryPath,
  labels,
  isActive, 
  onToggleStatus, 
  onToggleTimer, 
  onDelete 
}) => {
  const isDone = task.status === TaskStatus.DONE;
  const isProject = task.type === 'project';

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
  };

  return (
    <div className={`
      group flex items-center p-4 mb-3 rounded-xl border transition-all duration-200
      ${isActive 
        ? 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
      }
      ${isDone ? 'opacity-60' : 'opacity-100'}
    `}>
      <button 
        onClick={() => onToggleStatus(task.id)}
        className={`mr-4 transition-colors ${isDone ? 'text-green-500' : 'text-slate-400 hover:text-blue-400'}`}
      >
        {isProject ? (
            isDone ? <Square size={24} className="fill-current" /> : <Square size={24} />
        ) : (
            isDone ? <CheckCircle2 size={24} /> : <Circle size={24} />
        )}
      </button>

      <div className="flex-1 min-w-0">
        
        {/* Project Breadcrumbs */}
        {categoryPath.length > 0 && (
          <div className="flex flex-wrap items-center text-xs mb-1">
             {categoryPath.map((cat, i) => {
               const isLast = i === categoryPath.length - 1;
               return (
                 <React.Fragment key={cat.id}>
                    <span 
                      style={{ color: cat.color }}
                      className={`font-medium ${!isLast ? 'opacity-70' : ''}`}
                    >
                      {cat.title}
                    </span>
                    {!isLast && <ChevronRight size={12} className="mx-1 text-slate-600" />}
                 </React.Fragment>
               );
             })}
          </div>
        )}

        <div className="flex items-center">
             {isProject && <Folder size={16} className="text-amber-500 mr-2 flex-shrink-0" />}
             <h3 className={`text-base font-medium truncate ${isDone ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                {task.title}
             </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {/* Tags */}
          {labels.length > 0 && labels.map(label => (
             <span 
               key={label.id}
               className="flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-white/10"
               style={{ 
                   backgroundColor: label.color ? `${label.color}33` : '#475569', 
                   color: label.color || '#cbd5e1'
               }}
             >
                <Tag size={10} className="mr-1" />
                {label.title}
             </span>
          ))}

          <div className="flex items-center space-x-3 text-xs text-slate-400">
            {task.context && (
                <span className="bg-slate-700/50 px-2 py-0.5 rounded text-emerald-300">
                {task.context}
                </span>
            )}
            {!isProject && (
                <span className="flex items-center">
                    <Clock size={12} className="mr-1" />
                    {formatTime(task.timeSpent)}
                    {task.timeEstimate ? ` / ${formatDurationCompact(task.timeEstimate / 1000)}` : ''}
                </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isDone && !isProject && (
          <button
            onClick={() => onToggleTimer(task.id)}
            className={`p-2 rounded-full transition-colors ${
              isActive 
                ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
            }`}
            title={isActive ? "Stop Timer" : "Start Timer"}
          >
            {isActive ? <Pause size={18} /> : <Play size={18} />}
          </button>
        )}
        <button 
          onClick={() => onDelete(task.id)}
          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-full transition-colors"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
};