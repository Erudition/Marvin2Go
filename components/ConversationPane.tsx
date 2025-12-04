import React, { useEffect, useRef, useState } from 'react';
import { TranscriptItem } from '../types';
import { Bot, User, Wrench, ChevronDown, ChevronRight, Terminal, X, Settings } from 'lucide-react';

interface ConversationPaneProps {
  transcripts: TranscriptItem[];
  systemInstruction?: string;
  onClose?: () => void;
}

export const ConversationPane: React.FC<ConversationPaneProps> = ({ transcripts, systemInstruction, onClose }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [showSystemInstruction, setShowSystemInstruction] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const toggleTool = (id: string) => {
    setExpandedTools(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 w-full border-l border-slate-800">
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center justify-between flex-shrink-0">
        <h2 className="text-lg font-semibold text-slate-200 flex items-center">
          <Terminal size={18} className="mr-2 text-blue-400" />
          Live Transcript
        </h2>
        {onClose && (
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* System Instruction Collapsible */}
        {systemInstruction && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden">
                <button 
                  onClick={() => setShowSystemInstruction(!showSystemInstruction)}
                  className="w-full flex items-center justify-between p-3 text-xs font-medium text-slate-400 hover:bg-slate-800 transition-colors"
                >
                    <div className="flex items-center space-x-2">
                        <Settings size={14} />
                        <span>System Instruction</span>
                    </div>
                    {showSystemInstruction ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {showSystemInstruction && (
                    <div className="p-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-500 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {systemInstruction}
                    </div>
                )}
            </div>
        )}

        {transcripts.length === 0 ? (
          <div className="text-center text-slate-600 mt-10">
            <p className="text-sm">History is empty.</p>
          </div>
        ) : (
          transcripts.map((item) => {
            if (item.role === 'tool' && item.toolDetails) {
              const isExpanded = expandedTools[item.id];
              return (
                <div key={item.id} className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
                  <button 
                    onClick={() => toggleTool(item.id)}
                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-800 transition-colors text-xs text-slate-400"
                  >
                     <div className="flex items-center space-x-2">
                       <Wrench size={14} className="text-purple-400" />
                       <span>Used Tools ({item.toolDetails.functionCalls.length})</span>
                     </div>
                     {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  
                  {isExpanded && (
                    <div className="p-3 bg-slate-950/50 text-xs font-mono border-t border-slate-800">
                      {item.toolDetails.functionCalls.map((call, idx) => (
                         <div key={idx} className="mb-3 last:mb-0">
                           <div className="text-purple-300 font-bold mb-1">
                             {call.name}({JSON.stringify(call.args)})
                           </div>
                           <div className="text-slate-500 pl-2 border-l-2 border-slate-700">
                              {item.toolDetails?.functionResponses?.find(r => r.id === call.id)?.response?.result 
                               ? JSON.stringify(item.toolDetails.functionResponses.find(r => r.id === call.id)?.response.result)
                               : <span className="italic">Running...</span>
                              }
                           </div>
                         </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={item.id} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`flex max-w-[85%] ${item.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`
                      flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 shadow-lg
                      ${item.role === 'user' ? 'ml-3 bg-blue-600' : 'mr-3 bg-emerald-600'}
                    `}>
                      {item.role === 'user' ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
                    </div>
                    
                    <div className={`
                      p-3 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap
                      ${item.role === 'user' 
                        ? 'bg-blue-600/20 text-blue-100 rounded-tr-none border border-blue-500/20' 
                        : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                      }
                    `}>
                      {item.text || <span className="animate-pulse">...</span>}
                    </div>
                 </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};