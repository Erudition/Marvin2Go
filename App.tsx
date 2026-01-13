
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  Task, 
  TaskStatus, 
  Category,
  Label,
  TimerState,
  ConnectionState,
  VoiceMode,
  ChangeLogEntry,
  TranscriptItem
} from './types';
import { TaskCard } from './components/TaskCard';
import { FocusBar } from './components/FocusBar';
import { ConversationPane } from './components/ConversationPane';
import { ChangesPane } from './components/ChangesPane';
import { useLiveClient } from './hooks/useLiveClient';
import { formatDurationCompact, getCurrentTimeStr, parseNaturalLanguageTime, formatSessionHistory } from './utils/time';
import { getLevenshteinDistance } from './utils/text';
import { MarvinClient } from './utils/marvin';
import { 
  Layout, CheckSquare, Inbox, Calendar as CalendarIcon, Archive, Plus, Mic, MicOff, 
  PanelLeftClose, PanelLeftOpen, MessageSquare, AlertCircle, History,
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Moon, Settings, Key, Database,
  CookingPot, ArrowUpDown
} from 'lucide-react';

type SortOption = 'default' | 'title' | 'estimate' | 'duration' | 'created';

const App: React.FC = () => {
  // --- Marvin Auth State ---
  // Defaults set for development speed as requested
  const [apiToken, setApiToken] = useState<string>(() => localStorage.getItem('marvinApiToken') || 'm47dqHEwdJy56/j8tyAcXARlADg=');
  const [fullAccessToken, setFullAccessToken] = useState<string>(() => localStorage.getItem('marvinFullAccessToken') || '7o0b6/c0i+zXgWx5eheuM7Eob7w=');
  
  // Gemini Auth State
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => localStorage.getItem('geminiApiKey') || process.env.API_KEY || '');

  // Sync Credentials State
  const [syncServer, setSyncServer] = useState<string>(() => localStorage.getItem('marvinSyncServer') || 'https://512940bf-6e0c-4d7b-884b-9fc66185836b-bluemix.cloudant.com');
  const [syncDatabase, setSyncDatabase] = useState<string>(() => localStorage.getItem('marvinSyncDatabase') || 'u32410002');
  const [syncUser, setSyncUser] = useState<string>(() => localStorage.getItem('marvinSyncUser') || 'tuddereartheirceirleacco');
  const [syncPassword, setSyncPassword] = useState<string>(() => localStorage.getItem('marvinSyncPassword') || '3c749548fd996396c2bfefdb44bd140fc9d25de8');

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const marvinClientRef = useRef<MarvinClient | null>(null);

  // --- App State ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [labels, setLabels] = useState<Record<string, Label>>({});
  
  const [timer, setTimer] = useState<TimerState>({ taskId: null, startTime: null, baseTime: 0 });
  const [lastTrackedTaskId, setLastTrackedTaskId] = useState<string | null>(null);

  const [transcripts, setTranscripts] = useState<TranscriptItem[]>(() => {
    const saved = localStorage.getItem('transcripts');
    return saved ? JSON.parse(saved) : [];
  });

  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<TaskStatus>(TaskStatus.INBOX);
  const [manualInput, setManualInput] = useState('');
  
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  // Layout State
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelContent, setRightPanelContent] = useState<'conversation' | 'changes' | null>(null);

  // System Instructions State
  const [baseInstruction, setBaseInstruction] = useState<string>('');
  const [environmentInfo, setEnvironmentInfo] = useState<string>('');
  const [systemInstruction, setSystemInstruction] = useState<string>('');
  
  // Weather UI State
  const [weatherData, setWeatherData] = useState<{ temp: number, code: number, isDay: number, condition: string } | null>(null);

  // --- Initialization ---
  
  const initClient = useCallback(() => {
    const syncConfig = (syncServer && syncDatabase && syncUser) ? {
        server: syncServer,
        database: syncDatabase,
        user: syncUser,
        password: syncPassword
    } : undefined;
    
    marvinClientRef.current = new MarvinClient(apiToken, fullAccessToken, syncConfig);
  }, [apiToken, fullAccessToken, syncServer, syncDatabase, syncUser, syncPassword]);

  useEffect(() => {
    // If we have tokens in storage (or defaults), try to init. Ensure Gemini Key is present.
    if (apiToken && geminiApiKey) {
        initClient();
        setIsAuthenticated(true);
        refreshTasks();
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      if (apiToken && geminiApiKey) {
          localStorage.setItem('marvinApiToken', apiToken);
          localStorage.setItem('marvinFullAccessToken', fullAccessToken);
          localStorage.setItem('geminiApiKey', geminiApiKey);
          
          localStorage.setItem('marvinSyncServer', syncServer);
          localStorage.setItem('marvinSyncDatabase', syncDatabase);
          localStorage.setItem('marvinSyncUser', syncUser);
          localStorage.setItem('marvinSyncPassword', syncPassword);

          initClient();
          setIsAuthenticated(true);
          refreshTasks();
      }
  };

  const handleLogout = () => {
      if (marvinClientRef.current) {
          marvinClientRef.current.stopSync();
      }
      localStorage.removeItem('marvinApiToken');
      localStorage.removeItem('marvinFullAccessToken');
      localStorage.removeItem('geminiApiKey');
      localStorage.removeItem('marvinSyncServer');
      localStorage.removeItem('marvinSyncDatabase');
      localStorage.removeItem('marvinSyncUser');
      localStorage.removeItem('marvinSyncPassword');
      
      setApiToken('');
      setFullAccessToken('');
      setGeminiApiKey('');
      
      // Reset defaults for dev convenience upon logout/re-login interaction
      setSyncServer('https://512940bf-6e0c-4d7b-884b-9fc66185836b-bluemix.cloudant.com');
      setSyncDatabase('u32410002');
      setSyncUser('tuddereartheirceirleacco');
      setSyncPassword('3c749548fd996396c2bfefdb44bd140fc9d25de8');

      setIsAuthenticated(false);
      setTasks([]);
      setCategories({});
      setLabels({});
      setTimer({ taskId: null, startTime: null, baseTime: 0 });
      setLastTrackedTaskId(null);
  };

  // --- Sync Handling ---

  const handleSyncDocs = useCallback((docs: any[]) => {
      if (!marvinClientRef.current) return;
      const client = marvinClientRef.current;
      
      let tasksUpdated = false;
      let categoriesUpdated = false;

      setTasks(prevTasks => {
        let newTasks = [...prevTasks];
        docs.forEach(doc => {
            // Handle Tasks AND Projects (which are in Categories db)
            const isTask = doc.db === 'Tasks';
            const isProject = doc.db === 'Categories' && doc.type === 'project';

            if (isTask || isProject) {
                tasksUpdated = true;
                const task = client.mapToTask(doc);
                const existingIndex = newTasks.findIndex(t => t.id === task.id);
                if (existingIndex >= 0) {
                    newTasks[existingIndex] = task;
                } else {
                    // Add new items
                    newTasks.push(task);
                }
            }
        });
        return tasksUpdated ? newTasks : prevTasks;
      });

      setCategories(prevCats => {
          let newCats = { ...prevCats };
          docs.forEach(doc => {
              if (doc.db === 'Categories') {
                  categoriesUpdated = true;
                  newCats[doc._id] = {
                      id: doc._id,
                      title: doc.title,
                      type: doc.type,
                      parentId: doc.parentId,
                      color: doc.color,
                      backburner: doc.backburner,
                      done: doc.done,
                      doneDate: doc.doneDate,
                  } as any;
              }
          });
          return categoriesUpdated ? newCats : prevCats;
      });

      if (tasksUpdated || categoriesUpdated) {
          console.log(`[SYNC] Processed ${docs.length} updates (Tasks/Projects: ${tasksUpdated}, Categories: ${categoriesUpdated})`);
      }
  }, []);

  const handleSyncDelete = useCallback((ids: string[]) => {
      setTasks(prev => prev.filter(t => !ids.includes(t.id)));
      setCategories(prev => {
          const next = { ...prev };
          let changed = false;
          ids.forEach(id => {
              if (next[id]) {
                  delete next[id];
                  changed = true;
              }
          });
          return changed ? next : prev;
      });
      console.log(`[SYNC] Deleted ${ids.length} items.`);
  }, []);

  // Effect to start sync
  useEffect(() => {
      if (isAuthenticated && marvinClientRef.current) {
          marvinClientRef.current.startSync(handleSyncDocs, handleSyncDelete);
      }
      return () => {
          if (marvinClientRef.current) marvinClientRef.current.stopSync();
      };
  }, [isAuthenticated, handleSyncDocs, handleSyncDelete]);


  const refreshTasks = async () => {
      if (!marvinClientRef.current) return;
      try {
          const [inbox, today, allCats, allLabels, profile, trackedItem] = await Promise.all([
              marvinClientRef.current.getInbox(),
              marvinClientRef.current.getToday(),
              marvinClientRef.current.getAllCategories(),
              marvinClientRef.current.getLabels(),
              marvinClientRef.current.getProfile(),
              marvinClientRef.current.getTrackedItem()
          ]);

          // Build Categories Map (includes projects)
          const catMap: Record<string, Category> = {};
          allCats.forEach(c => catMap[c.id] = c);
          setCategories(catMap);

          // Build Labels Map
          const labelMap: Record<string, Label> = {};
          allLabels.forEach(l => labelMap[l.id] = l);
          setLabels(labelMap);

          // Merge lists.
          const allTasks = [...today, ...inbox];
          // Remove duplicates based on ID (just in case)
          const uniqueTasks = Array.from(new Map(allTasks.map(item => [item.id, item])).values());
          
          // Check for active tracker using User Profile (which has authoritative start time)
          if (profile && profile.tracking) {
             const tId = profile.tracking;
             let task = uniqueTasks.find(t => t.id === tId);
             
             // If currently tracked task isn't in inbox or today, try to use the one from getTrackedItem
             if (!task && trackedItem && trackedItem._id === tId) {
                 task = marvinClientRef.current.mapToTask(trackedItem);
                 uniqueTasks.push(task); // Add to local list so it renders
             }

             if (task) {
                 if (timer.taskId !== tId) {
                     setTimer({ 
                         taskId: tId, 
                         startTime: profile.trackingSince || Date.now(), 
                         baseTime: task.timeSpent 
                     });
                 }
             } else {
                 // Should technically fetch via ID if not returned by trackedItem (edge case), 
                 // but trackedItem endpoint usually returns it if active.
                 setTimer({ taskId: tId, startTime: profile.trackingSince || Date.now(), baseTime: 0 }); 
             }
          } else {
             setTimer({ taskId: null, startTime: null, baseTime: 0 });
          }

          setTasks(uniqueTasks);
          
      } catch (e) {
          console.error("Error refreshing tasks", e);
      }
  };

  const handleDebugDb = () => {
      if (marvinClientRef.current) {
          marvinClientRef.current.debugDbAccess();
      }
  };

  // 1. Fetch Base Instructions
  useEffect(() => {
    fetch('/INSTRUCTIONS.md')
      .then(r => r.text())
      .then(setBaseInstruction)
      .catch(console.error);
  }, []);

  // 2. Fetch Environment Data (IP & Weather)
  useEffect(() => {
    const fetchEnvData = async () => {
      try {
        const ipRes = await fetch('https://api.seeip.org/geoip');
        const ipData = await ipRes.json();
        const { latitude, longitude, city, region, country } = ipData;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code&daily=sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=${encodeURIComponent(timezone)}&forecast_days=1`;
        
        const weatherRes = await fetch(weatherUrl);
        const weatherJson = await weatherRes.json();
        
        const current = weatherJson.current;
        
        const wmo: Record<number, string> = {
            0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
            45: 'Fog', 48: 'Depositing rime fog',
            51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
            61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
            71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
            95: 'Thunderstorm'
        };
        const condition = wmo[current.weather_code] || 'Unknown';

        setWeatherData({
          temp: current.temperature_2m,
          code: current.weather_code,
          isDay: current.is_day,
          condition
        });

        const info = `
--- USER LOCATION & WEATHER ---
Location: ${city}, ${region}, ${country}
Timezone: ${timezone}
Current Time: ${new Date().toLocaleString()}
Condition: ${condition}
Temperature: ${current.temperature_2m}°F
`;
        setEnvironmentInfo(info);
      } catch (e) {
        console.warn("Could not fetch environment data", e);
        setEnvironmentInfo(`--- USER ENVIRONMENT ---\nCurrent Time: ${new Date().toLocaleString()}`);
      }
    };
    fetchEnvData();
  }, []);

  // 3. Helper for Context Minimization
  const cleanForContext = (obj: any) => {
    const res: any = {};
    // Only keep essential fields and strip defaults/empty
    if (obj.id) res.id = obj.id;
    if (obj.title) res.title = obj.title;
    if (obj.type && obj.type !== 'task') res.type = obj.type; // Tasks implied by position
    
    if (obj.timeEstimate && obj.timeEstimate > 0) res.est = Math.round(obj.timeEstimate / 60000) + 'm';
    if (obj.timeSpent && obj.timeSpent > 0) res.tracked = Math.round(obj.timeSpent / 60) + 'm';
    
    if (obj.dueDate) res.due = obj.dueDate;
    if (obj.note) res.note = obj.note.substring(0, 50); // Truncate notes

    // Children arrays
    if (obj.active && obj.active.length > 0) res.active = obj.active;
    if (obj.backburner && obj.backburner.length > 0) res.backburner = obj.backburner;
    if (obj.recentDone && obj.recentDone.length > 0) res.recentDone = obj.recentDone;
    if (obj.oldDone && obj.oldDone.length > 0) res.oldDone = obj.oldDone;

    return res;
  };

  // 4. Build Hierarchical Tree for Context
  const buildContextTree = useCallback(() => {
    // 1. Group all items by parentId
    const childrenMap = new Map<string, any[]>();
    
    const addToMap = (pid: string, item: any) => {
        const key = pid || 'unassigned';
        if (!childrenMap.has(key)) childrenMap.set(key, []);
        childrenMap.get(key)?.push(item);
    };

    // Add Categories & Projects
    Object.values(categories).forEach(cat => {
        // Normalize parentId: Main cats have 'root', others have IDs
        // Orphaned items might have IDs not in map, effectively roots or unassigned.
        addToMap(cat.parentId, { ...cat, kind: 'container' });
    });

    // Add Loaded Tasks
    tasks.forEach(task => {
        // Skip projects if they appear in tasks list (sync/api overlap)
        if (task.type === 'project') return;
        addToMap(task.project || 'unassigned', { ...task, kind: 'task' });
    });

    // 2. Recursive function to build tree node
    const serializeNode = (nodeId: string): any => {
        const items = childrenMap.get(nodeId) || [];
        
        const active: any[] = [];
        const backburnerTitles: string[] = [];
        const recentDone: any[] = [];
        const oldDoneTitles: string[] = [];
        
        items.forEach(item => {
            if (item.kind === 'task') {
                // Process Task
                // Tasks in 'tasks' list are usually active (Inbox/Today).
                // If we eventually load done tasks, we might filter here.
                // Assuming loaded tasks are active for now unless status=DONE
                if (item.status === TaskStatus.DONE) return; // Skip done tasks in context unless requested?

                // Tasks are leaves
                active.push(cleanForContext(item));
            } else {
                // Process Category/Project
                if (item.backburner && !item.done) {
                    backburnerTitles.push(item.title);
                } else if (item.done) {
                    const doneTime = item.doneDate ? new Date(item.doneDate).getTime() : 0;
                    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                    if (doneTime > sevenDaysAgo) {
                         // Full object for recent done
                         const node = cleanForContext(item);
                         // Recurse? Usually done projects hide children, but maybe useful.
                         // Let's keep it shallow for done projects to save tokens.
                         recentDone.push(node);
                    } else {
                        oldDoneTitles.push(item.title);
                    }
                } else {
                    // Active Category/Project
                    const children = serializeNode(item.id);
                    const node = cleanForContext({ ...item, ...children });
                    active.push(node);
                }
            }
        });
        
        const result: any = {};
        if (active.length > 0) result.active = active;
        if (backburnerTitles.length > 0) result.backburner = backburnerTitles;
        if (recentDone.length > 0) result.recentDone = recentDone;
        if (oldDoneTitles.length > 0) result.oldDone = oldDoneTitles;
        
        return result;
    };

    // 3. Build Root and Inbox
    const rootStructure = serializeNode('root');
    const inboxStructure = serializeNode('unassigned').active || []; // Inbox items usually in 'unassigned'

    // Calculate total count for stats
    const totalLoaded = Object.keys(categories).length + tasks.length;

    return {
        root: rootStructure,
        inbox: inboxStructure,
        totalCount: totalLoaded
    };
  }, [categories, tasks]);

  // 5. Combine Static Data with Dynamic App State
  useEffect(() => {
    const { 
        root,
        inbox,
        totalCount
    } = buildContextTree();
    
    // Explicit subset message
    const subsetMsg = `Showing subset of ${totalCount} items loaded in memory. Tasks shown are limited to Inbox and Today/Active contexts. Projects/Categories are fully loaded. Use the 'search' tool to find items not visible here.`;

    const contextSnapshot = `
--- MARVIN APP STATE SNAPSHOT ---
Stats: ${subsetMsg}
Active Timer Task ID: ${timer.taskId || "None"}

DATA STRUCTURE:
{
  "root": { 
     "active": [ ...Recursive Tree... ],
     "backburner": [ ...Titles... ],
     "recentDone": [ ...Objects... ],
     "oldDone": [ ...Titles... ]
  },
  "inbox": [ ...Flat list of tasks... ]
}

CURRENT STATE JSON:
${JSON.stringify({
    root,
    inbox
}, null, 2)}

----------------------------------
IMPORTANT INSTRUCTION: 
- The JSON above defines the project/category structure implicitly via nesting.
- 'active' contains open tasks and projects.
- 'backburner' contains titles of backburner projects.
- 'recentDone' contains full objects of recently completed projects.
- 'oldDone' contains titles of older completed projects.
- When adding a task, guess the 'parentId' from the tree. If it doesn't fit, use 'unassigned'.
- Guess 'timeEstimate' generously (in ms) if unknown.
- If a task ID fails to be found in a tool call, try using the exact Title of the task instead.
`;

    const history = transcripts
      .slice(-15) // Keep last 15 turns for context
      .map(t => {
          if (t.role === 'user') return `User: ${t.text}`;
          if (t.role === 'model') return `Model: ${t.text}`;
          if (t.role === 'tool' && t.toolDetails) {
              const calls = t.toolDetails.functionCalls.map(fc => `${fc.name}(${JSON.stringify(fc.args)})`).join(', ');
              const responses = t.toolDetails.functionResponses?.map(fr => JSON.stringify(fr.response)).join(', ');
              return `Tool Call: ${calls}\nTool Response: ${responses || 'Pending...'}`;
          }
          return '';
      }).join('\n');

    setSystemInstruction(`${environmentInfo}\n${baseInstruction}\n${contextSnapshot}\n\n--- CONVERSATION HISTORY (for context on reconnect) ---\n${history}`);
  }, [baseInstruction, environmentInfo, timer, transcripts, buildContextTree]);

  // Persist Transcripts
  useEffect(() => { localStorage.setItem('transcripts', JSON.stringify(transcripts)); }, [transcripts]);

  // Track Last Active Task
  useEffect(() => {
    if (timer.taskId) {
        setLastTrackedTaskId(timer.taskId);
    }
  }, [timer.taskId]);

  // Timer Logic: Wall-clock based update
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timer.taskId && timer.startTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - timer.startTime!) / 1000);
        // If baseTime is undefined, assume 0
        const newTotal = (timer.baseTime || 0) + elapsed;
        
        setTasks(prev => prev.map(t => {
          if (t.id === timer.taskId) {
            return { ...t, timeSpent: newTotal };
          }
          return t;
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // --- Change Logging ---
  const logChange = useCallback((actor: 'user' | 'ai', action: string, details: string, reason?: string) => {
    setChangeLog(prev => [...prev, {
      id: uuidv4(),
      timestamp: Date.now(),
      actor,
      action,
      details,
      reason
    }]);
  }, []);

  // --- Helper: Robust Task Lookup ---
  const findTask = useCallback((identifier: string): Task | null => {
      if (!identifier) return null;
      const normalizedId = identifier.trim();
      const lowerId = normalizedId.toLowerCase();

      // 1. Exact ID Match
      const exactId = tasks.find(t => t.id === normalizedId);
      if (exactId) return exactId;

      // 2. Fuzzy ID Match (Handle hallucinated IDs where chars are dropped)
      // Only check if identifier looks somewhat like a UUID or Marvin ID (alphanumeric, long)
      if (normalizedId.length > 10) {
        const fuzzyId = tasks.find(t => {
            const dist = getLevenshteinDistance(t.id, normalizedId);
            return dist < 4; // Allow small errors
        });
        if (fuzzyId) {
            console.log(`[FindTask] Fuzzy ID match: '${identifier}' -> '${fuzzyId.id}' (Dist: ${getLevenshteinDistance(fuzzyId.id, normalizedId)})`);
            return fuzzyId;
        }
      }

      // 3. Exact Title Match (Case insensitive)
      const exactTitle = tasks.find(t => t.title.toLowerCase() === lowerId);
      if (exactTitle) return exactTitle;

      // 4. Partial Title Match (High confidence)
      const partialTitle = tasks.find(t => t.title.toLowerCase().includes(lowerId));
      if (partialTitle) return partialTitle;
      
      return null;
  }, [tasks]);

  // --- Task Actions (Marvin API Wrappers) ---

  const addTask = useCallback(async (title: string, parentId?: string, timeEstimate?: number, reason?: string, actor: 'user' | 'ai' = 'user') => {
    if (!marvinClientRef.current) return null;
    try {
        const newTask = await marvinClientRef.current.createTask(title, parentId, timeEstimate);
        const parentName = parentId && parentId !== 'unassigned' ? (categories[parentId]?.title || 'Unknown') : 'Inbox';
        const est = timeEstimate ? ` (~${Math.round(timeEstimate / 60000)}m)` : '';
        logChange(actor, 'Add Task', `Added "${title}" to ${parentName}${est}`, reason);
        // refreshTasks(); // Sync should handle this
        return newTask;
    } catch (e) {
        console.error("Failed to add task", e);
        return null;
    }
  }, [logChange, categories]);

  const addProject = useCallback(async (title: string, parentId?: string, reason?: string, actor: 'user' | 'ai' = 'user') => {
    if (!marvinClientRef.current) return;
    try {
        await marvinClientRef.current.createProject(title, parentId);
        const parentName = parentId && parentId !== 'unassigned' ? (categories[parentId]?.title || 'Unknown') : 'Root';
        logChange(actor, 'Add Project', `Added project "${title}" to ${parentName}`, reason);
    } catch (e) {
        console.error("Failed to add project", e);
    }
  }, [logChange, categories]);

  const moveTask = useCallback(async (itemId: string, newParentId: string, reason?: string, actor: 'user' | 'ai' = 'user') => {
    if (!marvinClientRef.current) return;
    const task = tasks.find(t => t.id === itemId);
    const newParent = categories[newParentId]?.title || (newParentId === 'unassigned' ? 'Inbox' : newParentId);
    
    try {
        await marvinClientRef.current.updateDoc(itemId, { parentId: newParentId });
        logChange(actor, 'Move Task', `Moved "${task?.title || 'task'}" to ${newParent}`, reason);
    } catch (e) {
        console.error("Failed to move task", e);
    }
  }, [tasks, categories, logChange]);

  const markDone = useCallback(async (id: string, reason?: string, actor: 'user' | 'ai' = 'user') => {
    if (!marvinClientRef.current) return;
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const isDone = task.status === TaskStatus.DONE;
    const newDone = !isDone;
    const isProject = task.type === 'project';

    try {
        if (isProject) {
            // Projects must use updateDoc, not /api/markDone
            const updates: any = { done: newDone };
            if (newDone) {
                 updates.doneDate = new Date().toISOString().split('T')[0];
            } else {
                 updates.doneDate = null;
            }
            const updatedDoc = await marvinClientRef.current.updateDoc(id, updates);
            // Optimistic/Immediate update via sync handler
            if (updatedDoc) handleSyncDocs([updatedDoc]);

            logChange(actor, isDone ? 'Uncomplete Project' : 'Complete Project', `${isDone ? 'Unmarked' : 'Marked'} project "${task.title}" done`, reason);
        } else {
            // Tasks
            if (newDone) {
                await marvinClientRef.current.markDone(id);
                
                // Stop timer locally if running on this task
                if (timer.taskId === id) {
                    setTimer({ taskId: null, startTime: null, baseTime: 0 });
                }

                // Optimistic update for tasks
                setTasks(prev => prev.map(t => t.id === id ? { ...t, status: TaskStatus.DONE } : t));
                logChange(actor, 'Complete Task', `Marked "${task.title}" done`, reason);
            } else {
                // To un-mark done, we must use updateDoc as there is no /api/markUndone
                const updatedDoc = await marvinClientRef.current.updateDoc(id, { done: false, completedAt: null, doneAt: null });
                if (updatedDoc) handleSyncDocs([updatedDoc]);
                logChange(actor, 'Uncomplete Task', `Unmarked "${task.title}" done`, reason);
            }
        }
    } catch (e) {
        console.error("Failed to mark done", e);
    }
  }, [tasks, logChange, handleSyncDocs, timer.taskId]);

  const renameTask = useCallback(async (id: string, newTitle: string, reason?: string, actor: 'user' | 'ai' = 'user') => {
    if (!marvinClientRef.current) return;
    const task = tasks.find(t => t.id === id);
    try {
        await marvinClientRef.current.updateDoc(id, { title: newTitle });
        logChange(actor, 'Rename Task', `Renamed "${task?.title}" to "${newTitle}"`, reason);
        // refreshTasks(); // Sync handles this
    } catch (e) {
        console.error("Failed to rename", e);
    }
  }, [tasks, logChange]);

  const deleteTask = useCallback(async (id: string, reason?: string, actor: 'user' | 'ai' = 'user') => {
    if (!marvinClientRef.current) return;
    const task = tasks.find(t => t.id === id);
    try {
        await marvinClientRef.current.deleteDoc(id);
        logChange(actor, 'Delete Task', `Deleted "${task?.title}"`, reason);
        if (timer.taskId === id) setTimer({ taskId: null, startTime: null, baseTime: 0 });
        // refreshTasks(); // Sync handles this
    } catch (e) {
        console.error("Failed to delete", e);
    }
  }, [tasks, timer, logChange]);

  const updateTaskEstimate = useCallback(async (id: string, estimate: number) => {
    if (!marvinClientRef.current) return;
    try {
        await marvinClientRef.current.updateDoc(id, { timeEstimate: estimate });
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === id ? { ...t, timeEstimate: estimate } : t));
    } catch (e) {
        console.error("Failed to update estimate", e);
    }
  }, []);

  const toggleTimer = useCallback(async (id: string, reason?: string, actor: 'user' | 'ai' = 'user') => {
    if (!marvinClientRef.current) return;
    const task = tasks.find(t => t.id === id);
    
    if (timer.taskId === id) {
        // Stop
        try {
            await marvinClientRef.current.stopTracking(id);
            
            // IMPORTANT: Manually update the document's time tracking history and duration.
            // Marvin API's stopTracking returns the stop times, but the UI relies on the full document being updated.
            // We calculate the new times array locally and push the update to ensure persistence.
            if (task && timer.startTime) {
                const now = Date.now();
                const newTimes = [...(task.times || []), timer.startTime, now];
                
                // Calculate new cumulative duration
                let newDuration = 0;
                for(let i=0; i < newTimes.length - 1; i+=2) {
                    newDuration += (newTimes[i+1] - newTimes[i]);
                }

                // Update local state immediately for UI responsiveness
                setTasks(prev => prev.map(t => {
                    if (t.id === id) {
                        return { 
                            ...t, 
                            times: newTimes,
                            timeSpent: Math.floor(newDuration / 1000)
                        };
                    }
                    return t;
                }));

                // Persist to DB so it survives refresh
                await marvinClientRef.current.updateDoc(id, { times: newTimes, duration: newDuration });
            }

            logChange(actor, 'Stop Timer', 'Stopped timer', reason);
            setTimer({ taskId: null, startTime: null, baseTime: 0 });
        } catch(e) { console.error("Failed to stop timer", e); }
    } else {
        // Start
        try {
            // Stop previous if any (using the same logic to persist)
            if (timer.taskId) {
                const prevTask = tasks.find(t => t.id === timer.taskId);
                await marvinClientRef.current.stopTracking(timer.taskId);
                 if (prevTask && timer.startTime) {
                    const now = Date.now();
                    const newTimes = [...(prevTask.times || []), timer.startTime, now];
                    
                    let newDuration = 0;
                    for(let i=0; i < newTimes.length - 1; i+=2) {
                        newDuration += (newTimes[i+1] - newTimes[i]);
                    }

                    await marvinClientRef.current.updateDoc(timer.taskId, { times: newTimes, duration: newDuration });
                }
            }
            
            await marvinClientRef.current.startTracking(id);
            logChange(actor, 'Start Timer', `Started timer for "${task?.title || 'Unknown'}"`, reason);
            setTimer({ taskId: id, startTime: Date.now(), baseTime: task ? task.timeSpent : 0 });
        } catch(e) { console.error("Failed to start timer", e); }
    }
  }, [timer, tasks, logChange]);


  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      addTask(manualInput.trim(), 'unassigned', undefined, 'Manual input via UI');
      setManualInput('');
    }
  };

  // --- Voice Integration Logic ---

  const handleToolCall = useCallback(async (name: string, args: any) => {
    console.log('App executing tool:', name, args);
    const currentTimeContext = `Current Time: ${getCurrentTimeStr()}`;

    switch (name) {
      case 'addTask':
        const createdTask = await addTask(args.title, args.parentId, args.timeEstimate, args.reason, 'ai');
        if (createdTask) {
            const missingFields = [];
            if (!args.parentId || args.parentId === 'unassigned') missingFields.push('Project');
            if (!args.timeEstimate) missingFields.push('Time Estimate');

            let resultMsg = `Task created successfully with ID: ${createdTask._id}.`;
            if (missingFields.length > 0) {
                resultMsg += ` The following fields are unspecified: ${missingFields.join(', ')}.`;
            }
            return { result: resultMsg };
        }
        return { result: "Failed to add task." };

      case 'addProject':
        await addProject(args.title, args.parentId, args.reason, 'ai');
        return { result: `Project "${args.title}" added.` };

      case 'moveTask':
        const taskToMove = findTask(args.itemId);
        if (taskToMove) {
            await moveTask(taskToMove.id, args.newParentId, args.reason, 'ai');
            return { result: `Moved "${taskToMove.title}" to new parent.` };
        }
        return { result: "Task not found." };

      case 'renameTask':
        const taskToRename = findTask(args.itemId);
        if (taskToRename) {
             await renameTask(taskToRename.id, args.newTitle, args.reason, 'ai');
             return { result: `Task renamed to "${args.newTitle}".` };
        }
        return { result: "Task not found. Make sure you use the exact ID or a unique title part." };

      case 'deleteTask':
        const taskToDelete = findTask(args.itemId);
        if (taskToDelete) {
             await deleteTask(taskToDelete.id, args.reason, 'ai');
             return { result: `Task "${taskToDelete.title}" deleted.` };
        }
        return { result: "Task not found." };

      case 'getTasks':
        const filter = args.filter || 'INBOX';
        const filtered = tasks.filter(t => 
          filter === 'TODAY' ? t.status === TaskStatus.NEXT : t.status === TaskStatus.INBOX
        );
        const summary = filtered.map(t => {
            const projName = t.project ? (categories[t.project]?.title || t.project) : '';
            return `- ${t.title} [ID: ${t.id}]${projName ? ` (Project: ${projName})` : ''}`;
        }).join('\n');
        return { result: summary || "No tasks found." };
      
      case 'search':
        const query = (args.query || '').toLowerCase();
        const results = [];
        // Search in local tasks
        tasks.forEach(t => {
            if (t.title.toLowerCase().includes(query)) {
                results.push({ type: 'task', title: t.title, id: t.id, project: t.project });
            }
        });
        // Search in local categories/projects
        Object.values(categories).forEach(c => {
             if (c.title.toLowerCase().includes(query)) {
                 results.push({ type: c.type, title: c.title, id: c.id });
             }
        });
        // Slice to avoid token overflow
        return { result: JSON.stringify(results.slice(0, 25)) };

      case 'getCurrentTask':
        if (timer.taskId && timer.startTime) {
            const currentTask = tasks.find(t => t.id === timer.taskId);
            if (currentTask) {
                const sessionDuration = Math.floor((Date.now() - timer.startTime) / 1000);
                return { 
                    result: `Currently working on "${currentTask.title}". Session duration: ${formatDurationCompact(sessionDuration)}.`,
                    currentTime: currentTimeContext
                };
            }
        }
        return { result: "No active task timer running.", currentTime: currentTimeContext };

      case 'markTaskDone':
        const taskToUpdate = findTask(args.itemId);
        if (!taskToUpdate) return { result: "Task not found." };
        
        // 1. Check existing time if no explicit "since" is provided
        // Calculate current total time including active timer if running
        const activeSession = timer.taskId === taskToUpdate.id && timer.startTime 
            ? (Date.now() - timer.startTime) / 1000 
            : 0;
        const totalTimeSeconds = taskToUpdate.timeSpent + activeSession;

        // If very little time (<30s) and no 'since' logic provided (e.g. user didn't say when they did it),
        // prompt for clarification. Note: 'since' is required in the tool definition now, so the model 
        // should have asked or inferred 'now'. If 'now' is inferred and time is low, we still warn.
        
        let doneTime = Date.now();
        let parsedSince = null;
        if (args.since) {
            parsedSince = parseNaturalLanguageTime(args.since);
            if (parsedSince) doneTime = parsedSince;
        }

        const isTimeVeryShort = totalTimeSeconds < 30;
        // If the model defaulted to 'now' (implicit or explicit) and time is short, reject
        if (isTimeVeryShort && (!args.since || args.since.toLowerCase() === 'now')) {
            const history = formatSessionHistory(taskToUpdate.times);
            return {
                result: `Error: This task has very little tracked time (${formatDurationCompact(totalTimeSeconds)}). Please specify when you worked on it or how long it took (e.g. "since 10m ago" or "for 1h"). Current history: ${history}`
            };
        }

        let message = `Task "${taskToUpdate.title}" marked as completed.`;

        // 2. Handle Session Updates based on 'since'
        if (timer.taskId === taskToUpdate.id) {
            // Task was actively running.
            // Stop it first.
            await marvinClientRef.current?.stopTracking(taskToUpdate.id);
            setTimer({ taskId: null, startTime: null, baseTime: 0 });

            // If 'since' implies a time significantly different from now (> 1 minute),
            // update the session we just stopped.
            if (Math.abs(doneTime - Date.now()) > 60000) {
                 // We need to retroactively fix the end time of the last session
                 // Since we just stopped it, it should be the last pair in `times`
                 // Fetch fresh to be safe, or just append locally and push update
                 const currentTimes = [...(taskToUpdate.times || [])];
                 // Add the session that stopTracking just added (approx 'now')
                 // But we don't have the updated doc from stopTracking yet unless we wait for sync.
                 // Better approach: Calculate the new times array entirely and overwrite.
                 
                 // If timer was running, start was timer.startTime.
                 // We want session: [startTime, doneTime]
                 if (timer.startTime) {
                     currentTimes.push(timer.startTime);
                     currentTimes.push(doneTime);
                     await marvinClientRef.current?.updateDoc(taskToUpdate.id, { times: currentTimes });
                     message += ` Active session adjusted to end at ${new Date(doneTime).toLocaleTimeString()}.`;
                 }
            } else {
                 message += ` Tracking stopped.`;
            }
        } else {
            // Task was NOT running.
            // If the user said "since 10m ago", they imply they were working on it.
            // We should add a session [doneTime - duration?, doneTime]? 
            // The prompt says: "calculate whether the task was running at that time."
            
            // Check if this task had an open session? (Unlikely if timer.taskId !== id)
            // Check if another task was running at doneTime?
            const otherTask = tasks.find(t => {
                if (!t.times) return false;
                for (let i=0; i<t.times.length; i+=2) {
                    const start = t.times[i];
                    const end = t.times[i+1] || Date.now();
                    if (doneTime >= start && doneTime <= end) return true;
                }
                return false;
            });

            if (otherTask) {
                message += ` Warning: Task "${otherTask.title}" was tracked at that time.`;
            } else {
                 // If 'since' is in the past, maybe we should add a session?
                 // Prompt doesn't explicitly ask to *add* a session if missing, 
                 // just "modify the timetracking session so that it ends at that time".
                 // This implies modifying an *existing* session.
                 // If no session exists, we just mark done.
            }
        }

        // 3. Mark Done
        await markDone(taskToUpdate.id, args.reason, 'ai');
        
        // 4. Return history
        // We need the updated times to show history accurately. 
        // We'll approximate local update or use existing.
        return { result: `${message} History: ${formatSessionHistory(taskToUpdate.times)}` };


      case 'startTimer':
         const taskToStart = findTask(args.itemId);
        if (taskToStart) {
          if (taskToStart.status === TaskStatus.DONE) {
              return { result: "Error: Cannot start timer on a completed task." };
          }
          if (timer.taskId === taskToStart.id) {
              return { result: `Timer is already running for "${taskToStart.title}".` };
          }
          await toggleTimer(taskToStart.id, args.reason, 'ai');
          return { result: `Timer started for "${taskToStart.title}".`, currentTime: currentTimeContext };
        }
        return { result: "Task not found." };

      case 'stopTimer':
        // If itemId is provided, verify match (or stop generic if no ID but only one running)
        // If args.itemId is provided, try to find it
        if (args.itemId) {
             const taskToStop = findTask(args.itemId);
             if (taskToStop) {
                 if (timer.taskId !== taskToStop.id) {
                     return { result: `Timer is not running for "${taskToStop.title}". Currently running: "${timer.taskId ? (tasks.find(t=>t.id===timer.taskId)?.title || 'Unknown') : 'None'}"` };
                 }
                 await toggleTimer(taskToStop.id, args.reason, 'ai');
                 return { result: `Timer stopped for "${taskToStop.title}".`, currentTime: currentTimeContext };
             } else {
                 // ID was provided but not found.
                 return { result: "Task not found." };
             }
        } else {
            // No itemId provided, stop current
            if (timer.taskId) {
                const taskName = tasks.find(t => t.id === timer.taskId)?.title || "Unknown Task";
                await toggleTimer(timer.taskId, args.reason, 'ai');
                return { result: `Timer stopped for "${taskName}".`, currentTime: currentTimeContext };
            }
            return { result: "No timer running." };
        }
      
      case 'getTaskSessions':
        const taskForSessions = findTask(args.itemId);
        if (!taskForSessions) return { result: "Task not found." };
        return { result: `Sessions for "${taskForSessions.title}": ${formatSessionHistory(taskForSessions.times)}` };

      case 'updateTaskSessions':
        const taskToEdit = findTask(args.itemId);
        if (!taskToEdit) return { result: "Task not found." };
        
        // Validate sessions
        const newSessions: any[] = args.sessions || [];
        for (const s of newSessions) {
            if (s.start >= s.end) return { result: `Error: Invalid session [${s.start}, ${s.end}]. Start must be before end.` };
        }
        
        // Flatten to times array [start, end, start, end...]
        const flattenedTimes: number[] = [];
        newSessions.forEach((s: any) => {
            flattenedTimes.push(s.start);
            flattenedTimes.push(s.end);
        });

        if (marvinClientRef.current) {
            await marvinClientRef.current.updateDoc(taskToEdit.id, { times: flattenedTimes });
            return { result: `Sessions updated for "${taskToEdit.title}". New history: ${formatSessionHistory(flattenedTimes)}` };
        }
        return { result: "Failed to update sessions." };

      case 'endSession':
        return { result: "Session ended." };

      default:
        return { result: "Tool not found." };
    }
  }, [addTask, addProject, moveTask, tasks, markDone, toggleTimer, timer, deleteTask, renameTask, categories, updateTaskEstimate, findTask]);

  const { 
    connect, 
    disconnect, 
    connectionState, 
    volume, 
    voiceMode, 
    setVoiceMode, 
    isPttPressed, 
    setIsPttPressed,
    error
  } = useLiveClient({ 
    apiKey: geminiApiKey, 
    onToolCall: handleToolCall,
    systemInstruction
  });
  
  const handleConnect = () => {
      connect(setTranscripts);
  };

  // --- Microphone Logic ---
  const interactionStartRef = useRef<number>(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMicPointerDown = (e: React.PointerEvent) => {
    e.preventDefault(); 
    if (connectionState !== ConnectionState.CONNECTED) {
      if (connectionState === ConnectionState.DISCONNECTED || connectionState === ConnectionState.ERROR) {
        handleConnect();
      }
      return;
    }

    interactionStartRef.current = Date.now();
    holdTimerRef.current = setTimeout(() => {
       setVoiceMode(VoiceMode.PTT);
       setIsPttPressed(true);
    }, 300);
  };

  const handleMicPointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (connectionState !== ConnectionState.CONNECTED) return;
    const duration = Date.now() - interactionStartRef.current;
    if (duration < 300) {
      if (voiceMode === VoiceMode.VAD) {
          disconnect();
      } else {
          setVoiceMode(VoiceMode.VAD);
          setIsPttPressed(false);
      }
    } else {
      setIsPttPressed(false);
    }
  };

  const date = {
    month: new Date().toLocaleString('default', { month: 'short' }).toUpperCase(),
    day: new Date().getDate()
  };

  const getWeatherIcon = (code: number, isDay: number) => {
    if (code >= 95) return <CloudLightning size={24} className="text-yellow-400" />;
    if (code >= 71) return <CloudSnow size={24} className="text-white" />;
    if (code >= 51) return <CloudRain size={24} className="text-blue-400" />;
    if (code >= 45) return <CloudFog size={24} className="text-slate-400" />;
    if (code >= 2) return <Cloud size={24} className="text-slate-400" />;
    return isDay ? <Sun size={24} className="text-amber-400" /> : <Moon size={24} className="text-indigo-300" />;
  };

  // --- Filtering & Sorting ---

  const filteredTasks = tasks.filter(t => {
    if (activeTab === TaskStatus.BACKBURNER) {
        // Backburner items are explicitly marked OR inherited (inheritance not fully implemented here yet)
        return t.backburner === true && !t.status.includes('DONE'); 
    }
    
    // For other tabs, exclude explicit backburner items
    if (t.backburner) return false;

    if (activeTab === TaskStatus.INBOX) return t.status === TaskStatus.INBOX;
    if (activeTab === TaskStatus.NEXT) return t.status === TaskStatus.NEXT;
    return false;
  }).sort((a, b) => {
      switch (sortBy) {
          case 'title':
              return a.title.localeCompare(b.title);
          case 'estimate':
              return (b.timeEstimate || 0) - (a.timeEstimate || 0);
          case 'duration':
              return b.timeSpent - a.timeSpent;
          case 'created':
              return b.createdAt - a.createdAt;
          default:
              // Default sort (approx rank)
              return 0; 
      }
  });

  const toggleRightPanel = (content: 'conversation' | 'changes') => {
      setRightPanelContent(prev => prev === content ? null : content);
  };

  const getCategoryPath = (parentId?: string): Category[] => {
      const path: Category[] = [];
      let currentId = parentId;
      // Prevent infinite loops with simple depth check or visited set
      const visited = new Set<string>();
      
      while (currentId && currentId !== 'unassigned' && currentId !== 'root' && categories[currentId]) {
          if (visited.has(currentId)) break;
          visited.add(currentId);
          
          const cat = categories[currentId];
          path.unshift(cat);
          currentId = cat.parentId;
      }
      return path;
  };

  // Determine which task to show in FocusBar
  const trackedTask = timer.taskId 
    ? tasks.find(t => t.id === timer.taskId) 
    : (lastTrackedTaskId ? tasks.find(t => t.id === lastTrackedTaskId) : null);

  // --- Render ---

  if (!isAuthenticated) {
      return (
          <div className="h-screen bg-slate-950 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl max-w-md w-full shadow-2xl">
                  <h1 className="text-2xl font-bold text-white mb-6 flex items-center">
                      <Layout className="mr-3 text-blue-500" /> Marvin Go
                  </h1>
                  <p className="text-slate-400 mb-6 text-sm">
                      Enter your Amazing Marvin tokens. 
                      You can find these in <b>Strategy Settings &gt; API</b>.
                  </p>
                  <form onSubmit={handleLogin}>
                      <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Gemini API Key (Required)</label>
                            <input 
                              type="password" 
                              value={geminiApiKey}
                              onChange={(e) => setGeminiApiKey(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:border-blue-500 focus:outline-none"
                              placeholder="Gemini API Key"
                              required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">API Token (Required)</label>
                            <input 
                              type="password" 
                              value={apiToken}
                              onChange={(e) => setApiToken(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:border-blue-500 focus:outline-none"
                              placeholder="Marvin API Token"
                              required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center">
                                Full Access Token 
                                <span className="ml-2 text-xs normal-case text-slate-600 bg-slate-800 px-2 py-0.5 rounded">Optional</span>
                            </label>
                            <input 
                              type="password" 
                              value={fullAccessToken}
                              onChange={(e) => setFullAccessToken(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:border-blue-500 focus:outline-none"
                              placeholder="fullAccessToken (for delete/rename)"
                            />
                            <p className="text-xs text-slate-500 mt-2">
                                Required only if you want to rename or delete tasks via this app.
                            </p>
                        </div>

                        <div className="pt-4 border-t border-slate-800">
                           <h3 className="text-sm font-semibold text-slate-400 mb-3">Sync Credentials (Optional)</h3>
                           <div className="space-y-3">
                              <div>
                                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Sync Server</label>
                                   <input 
                                     type="text" 
                                     value={syncServer} 
                                     onChange={(e) => setSyncServer(e.target.value)}
                                     className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                                   />
                              </div>
                               <div>
                                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Sync Database</label>
                                   <input 
                                     type="text" 
                                     value={syncDatabase} 
                                     onChange={(e) => setSyncDatabase(e.target.value)}
                                     className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                                   />
                              </div>
                               <div>
                                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Sync User</label>
                                   <input 
                                     type="text" 
                                     value={syncUser} 
                                     onChange={(e) => setSyncUser(e.target.value)}
                                     className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                                   />
                              </div>
                               <div>
                                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Sync Password</label>
                                   <input 
                                     type="password" 
                                     value={syncPassword} 
                                     onChange={(e) => setSyncPassword(e.target.value)}
                                     className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                                   />
                              </div>
                           </div>
                        </div>

                        <button 
                          type="submit" 
                          disabled={!apiToken || !geminiApiKey}
                          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors mt-4"
                        >
                            Connect
                        </button>
                      </div>
                  </form>
              </div>
          </div>
      );
  }

  return (
    <div className="h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden flex flex-col">
      {/* Top Header */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-20 flex-shrink-0">
          <div className="flex items-center space-x-4">
              <button onClick={() => setLeftPanelOpen(!leftPanelOpen)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
                  {leftPanelOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
              </button>
              
              <div className="flex items-center space-x-4 pl-2 border-l border-slate-800">
                  <div className="flex flex-col items-center justify-center bg-slate-800 border border-slate-700 rounded w-9 h-9 leading-none shadow-sm">
                    <span className="text-[0.5rem] font-bold text-red-400 tracking-wider mt-0.5">{date.month}</span>
                    <span className="text-sm font-bold text-slate-200 -mt-0.5">{date.day}</span>
                  </div>

                  {weatherData && (
                    <div className="flex items-center space-x-2" title={`${weatherData.condition}, ${weatherData.temp}°F`}>
                      {getWeatherIcon(weatherData.code, weatherData.isDay)}
                      <span className="text-sm font-medium text-slate-300 hidden sm:inline">{Math.round(weatherData.temp)}°</span>
                    </div>
                  )}
              </div>
          </div>
          
          <div className="flex items-center space-x-2">
               <button 
                  onClick={handleDebugDb}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 mr-2"
                  title="Debug DB (Console Log)"
               >
                   <Database size={20} />
               </button>

               <button 
                  onClick={refreshTasks}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 mr-2"
                  title="Refresh Tasks"
               >
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
               </button>
               <button 
                  onClick={() => toggleRightPanel('changes')}
                  className={`p-2 rounded-lg transition-colors ${rightPanelContent === 'changes' ? 'bg-amber-900/50 text-amber-400' : 'hover:bg-slate-800 text-slate-400'}`}
                  title="Change Log"
               >
                   <History size={20} />
               </button>
               <button 
                  onClick={() => toggleRightPanel('conversation')}
                  className={`p-2 rounded-lg transition-colors ${rightPanelContent === 'conversation' ? 'bg-blue-900/50 text-blue-400' : 'hover:bg-slate-800 text-slate-400'}`}
                  title="Conversation"
               >
                   <MessageSquare size={20} />
               </button>
               <button
                  onClick={handleLogout}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"
                  title="Logout"
               >
                  <Key size={20} />
               </button>
          </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative min-h-0">
        
        {/* Left Sidebar */}
        {leftPanelOpen && (
          <aside className="w-64 bg-slate-900/50 border-r border-slate-800 flex flex-col flex-shrink-0 absolute md:static h-full z-10 transition-all backdrop-blur-md md:backdrop-blur-none">
            <div className="px-6 py-5 flex items-center">
                <Layout className="w-5 h-5 mr-2 text-blue-400" />
                <span className="font-bold text-lg text-slate-200">Marvin Go</span>
            </div>
            <nav className="flex-1 px-4 py-2 space-y-2">
              {[
                { id: TaskStatus.INBOX, icon: Inbox, label: 'Inbox', count: tasks.filter(t => t.status === TaskStatus.INBOX && !t.backburner).length },
                { id: TaskStatus.NEXT, icon: CheckSquare, label: 'Today', count: tasks.filter(t => t.status === TaskStatus.NEXT && !t.backburner).length },
                { id: TaskStatus.BACKBURNER, icon: CookingPot, label: 'Backburner', count: tasks.filter(t => t.backburner && !t.status.includes('DONE')).length },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TaskStatus)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                    activeTab === item.id 
                      ? 'bg-blue-600/20 text-blue-400' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <item.icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {item.count > 0 && (
                    <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full text-slate-400">
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </aside>
        )}

        {/* Center */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-slate-950 min-w-0">
          <div className="flex-1 overflow-y-auto pb-32">
             <div className="p-6 pb-0 max-w-3xl mx-auto w-full sticky top-0 bg-slate-950 z-10 pt-8">
               <form onSubmit={handleManualAdd} className="relative">
                 <input
                   type="text"
                   value={manualInput}
                   onChange={(e) => setManualInput(e.target.value)}
                   placeholder="Add a new task to Marvin..."
                   className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 pl-11 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-slate-200 placeholder-slate-500 transition-all shadow-lg"
                 />
                 <Plus className="absolute left-3 top-3.5 text-slate-500" size={20} />
                 <button 
                   type="submit"
                   disabled={!manualInput.trim()}
                   className="absolute right-2 top-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   Add
                 </button>
               </form>
             </div>

             <div className="p-6 max-w-3xl mx-auto">
               <div className="flex items-center justify-between mb-6">
                   <h2 className="text-xl font-semibold text-slate-200 capitalize flex items-center">
                     {activeTab === TaskStatus.NEXT ? 'Today' : (activeTab === TaskStatus.BACKBURNER ? 'Backburner' : 'Inbox')}
                     <span className="ml-2 text-xs bg-slate-800 text-slate-500 px-2 py-1 rounded-full font-normal">
                        {filteredTasks.length}
                     </span>
                   </h2>

                   {/* Sort Menu */}
                   <div className="relative">
                       <button 
                        onClick={() => setShowSortMenu(!showSortMenu)}
                        className="flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-300 transition-colors bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-800"
                       >
                           <ArrowUpDown size={14} />
                           <span>Sort</span>
                       </button>
                       {showSortMenu && (
                           <>
                           <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)}></div>
                           <div className="absolute right-0 mt-2 w-32 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
                               <button 
                                onClick={() => { setSortBy('default'); setShowSortMenu(false); }}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 ${sortBy === 'default' ? 'text-blue-400' : 'text-slate-400'}`}
                               >
                                   Default
                               </button>
                               <button 
                                onClick={() => { setSortBy('title'); setShowSortMenu(false); }}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 ${sortBy === 'title' ? 'text-blue-400' : 'text-slate-400'}`}
                               >
                                   Title
                               </button>
                               <button 
                                onClick={() => { setSortBy('estimate'); setShowSortMenu(false); }}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 ${sortBy === 'estimate' ? 'text-blue-400' : 'text-slate-400'}`}
                               >
                                   Time Estimate
                               </button>
                               <button 
                                onClick={() => { setSortBy('duration'); setShowSortMenu(false); }}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 ${sortBy === 'duration' ? 'text-blue-400' : 'text-slate-400'}`}
                               >
                                   Tracked Time
                               </button>
                               <button 
                                onClick={() => { setSortBy('created'); setShowSortMenu(false); }}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 ${sortBy === 'created' ? 'text-blue-400' : 'text-slate-400'}`}
                               >
                                   Created Date
                               </button>
                           </div>
                           </>
                       )}
                   </div>
               </div>
               
               {filteredTasks.length === 0 ? (
                 <div className="text-center py-20 text-slate-600">
                   {activeTab === TaskStatus.BACKBURNER ? <CookingPot size={48} className="mx-auto mb-4 opacity-50" /> : <Inbox size={48} className="mx-auto mb-4 opacity-50" />}
                   <p>No tasks here.</p>
                 </div>
               ) : (
                 filteredTasks.map(task => (
                   <TaskCard
                     key={task.id}
                     task={task}
                     categoryPath={getCategoryPath(task.project)}
                     labels={(task.labelIds || []).map(id => labels[id]).filter(Boolean)}
                     isActive={timer.taskId === task.id}
                     onToggleStatus={(id) => markDone(id, 'User clicked checkbox', 'user')}
                     onToggleTimer={(id) => toggleTimer(id, 'User clicked timer', 'user')}
                     onDelete={(id) => deleteTask(id, 'User clicked delete', 'user')}
                     onUpdateEstimate={updateTaskEstimate}
                   />
                 ))
               )}
             </div>
          </div>
          
          {/* Bottom Focus Bar */}
          {trackedTask && (
             <FocusBar 
               task={trackedTask} 
               isActive={!!timer.taskId} 
               onToggle={() => toggleTimer(trackedTask.id, 'User clicked focus bar', 'user')} 
             />
          )}

        </main>

        {/* Right Sidebar */}
        {rightPanelContent && (
          <aside className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col flex-shrink-0 absolute lg:static h-full right-0 z-10 shadow-2xl lg:shadow-none">
            {rightPanelContent === 'conversation' ? (
              <ConversationPane transcripts={transcripts} systemInstruction={systemInstruction} onClose={() => setRightPanelContent(null)} />
            ) : (
              <ChangesPane changes={changeLog} onClose={() => setRightPanelContent(null)} />
            )}
          </aside>
        )}
      </div>

      {/* FAB */}
      <button
        onPointerDown={handleMicPointerDown}
        onPointerUp={handleMicPointerUp}
        onPointerLeave={handleMicPointerUp}
        className={`
          fixed bottom-8 right-8 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 z-50
          ${connectionState === ConnectionState.CONNECTED
              ? (voiceMode === VoiceMode.PTT && isPttPressed 
                ? 'bg-blue-500 scale-110 shadow-blue-500/50' 
                : (voiceMode === VoiceMode.VAD ? 'bg-red-500' : 'bg-slate-700 text-slate-400'))
              : (connectionState === ConnectionState.ERROR ? 'bg-red-900/50 border-2 border-red-500' : 'bg-blue-600 hover:bg-blue-500')
          }
        `}
      >
        {connectionState === ConnectionState.CONNECTING ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          connectionState === ConnectionState.CONNECTED ? (
              voiceMode === VoiceMode.VAD ? (
                 <>
                   <Mic size={28} className="text-white relative z-10" />
                   <span className="absolute -top-2 -right-2 flex h-4 w-4">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                   </span>
                 </>
              ) : <Mic size={28} className={isPttPressed ? "text-white" : "text-slate-400"} />
          ) : (
             connectionState === ConnectionState.ERROR ? <AlertCircle size={28} className="text-red-500" /> : <MicOff size={28} className="text-white" />
          )
        )}
        
        {connectionState === ConnectionState.CONNECTED && (
            <div 
              className="absolute inset-0 rounded-full border-2 border-white/30 pointer-events-none transition-transform duration-75"
              style={{ transform: `scale(${1 + volume * 1.5})`, opacity: 0.5 }}
            />
        )}
        
        {error && connectionState === ConnectionState.ERROR && (
           <div className="absolute bottom-20 right-0 bg-red-900 text-white text-xs p-2 rounded w-48 shadow-lg pointer-events-none">
             {error}
           </div>
        )}
      </button>

    </div>
  );
};

export default App;
