



import { Task, TaskStatus, Category, Label, SyncConfig } from '../types';

// Use a public CORS proxy to bypass browser restrictions in the sandbox.
const BASE_URL = 'https://corsproxy.io/?https://serv.amazingmarvin.com/api';
// We also need to proxy the Cloudant requests because of strict CORS on localhost
const PROXY_PREFIX = 'https://corsproxy.io/?';

export class MarvinClient {
  private apiToken: string;
  private fullAccessToken: string;
  private syncConfig?: SyncConfig;
  private isSyncing: boolean = false;
  private abortController: AbortController | null = null;

  constructor(apiToken: string, fullAccessToken: string, syncConfig?: SyncConfig) {
    this.apiToken = apiToken;
    this.fullAccessToken = fullAccessToken;
    this.syncConfig = syncConfig;
  }

  // Header helpers
  private get apiHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-API-Token': this.apiToken,
    };
  }

  private get fullAccessHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-Full-Access-Token': this.fullAccessToken,
    };
  }

  private get syncAuthHeaders() {
    if (!this.syncConfig || !this.syncConfig.user || !this.syncConfig.password) return {};
    return {
        'Authorization': 'Basic ' + btoa(`${this.syncConfig.user}:${this.syncConfig.password}`),
        'Content-Type': 'application/json'
    };
  }

  private async request(endpoint: string, options: RequestInit) {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`[MARVIN API] Request: ${options.method || 'GET'} ${url}`);
    
    try {
      const res = await fetch(url, options);
      
      // Handle 204 No Content (e.g., from getTrackedItem when no task is tracked)
      if (res.status === 204) {
          console.log(`[MARVIN API] Response 204 (No Content) for ${endpoint}`);
          return null;
      }

      const text = await res.text();
      
      console.log(`[MARVIN API] Response ${res.status} for ${endpoint}:`, text.substring(0, 500));

      if (!res.ok) {
        throw new Error(`API Error ${res.status}: ${text}`);
      }

      try {
        if (!text.trim()) return null;
        return JSON.parse(text);
      } catch (e) {
        // Some endpoints might return "OK" as a plain string, handle that.
        if (text.trim() === '"OK"' || text.trim() === 'OK') {
            return "OK";
        }
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
      }
    } catch (e) {
      console.error(`[MARVIN API] Network/Parse Error for ${endpoint}:`, e);
      throw e;
    }
  }

  // --- Sync Methods ---

  async startSync(
    onDocsUpdate: (docs: any[]) => void, 
    onDocsDelete: (ids: string[]) => void
  ) {
    if (!this.syncConfig) {
        console.warn("Cannot start sync: Missing sync credentials");
        return;
    }
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.abortController = new AbortController();

    console.log("[MARVIN SYNC] Starting real-time sync...");
    
    // Start from 'now' to receive only new changes since the app loaded
    let since = 'now'; 

    const { server, database } = this.syncConfig;
    // Remove trailing slash if present
    const cleanServer = server.replace(/\/$/, '');
    
    while (this.isSyncing) {
        try {
            const signal = this.abortController.signal;
            const changesUrl = `${PROXY_PREFIX}${cleanServer}/${database}/_changes?style=all_docs&feed=longpoll&heartbeat=10000&filter=app%2FnoArchive&since=${since}&limit=499`;
            
            console.log(`[MARVIN SYNC] Long polling: ${since}`);
            const response = await fetch(changesUrl, {
                headers: this.syncAuthHeaders,
                signal
            });

            if (!response.ok) {
                // If 401/403, stop trying
                if (response.status === 401 || response.status === 403) {
                    console.error("[MARVIN SYNC] Auth error, stopping sync.");
                    this.isSyncing = false;
                    break;
                }
                throw new Error(`Changes feed error: ${response.status}`);
            }

            const data = await response.json();
            since = data.last_seq; // Update cursor

            if (data.results && data.results.length > 0) {
                const results = data.results as any[];
                
                // Handle deletions
                const deletedIds = results.filter(r => r.deleted).map(r => r.id);
                if (deletedIds.length > 0) {
                    onDocsDelete(deletedIds);
                }

                // Handle updates
                const updatedIds = results.filter(r => !r.deleted).map(r => r.id);
                if (updatedIds.length > 0) {
                    const docs = await this.fetchBulkDocs(updatedIds);
                    onDocsUpdate(docs);
                }
            }
        } catch (e: any) {
            if (e.name === 'AbortError') {
                console.log("[MARVIN SYNC] Sync aborted.");
                break;
            }
            console.error("[MARVIN SYNC] Error in sync loop, retrying in 5s...", e);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
  }

  stopSync() {
    this.isSyncing = false;
    if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
    }
  }

  private async fetchBulkDocs(ids: string[]): Promise<any[]> {
    if (!this.syncConfig || ids.length === 0) return [];
    
    const { server, database } = this.syncConfig;
    const cleanServer = server.replace(/\/$/, '');
    const url = `${PROXY_PREFIX}${cleanServer}/${database}/_bulk_get?revs=true&latest=true`;

    try {
        const payload = { docs: ids.map(id => ({ id })) };
        const res = await fetch(url, {
            method: 'POST',
            headers: this.syncAuthHeaders,
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`Bulk get failed: ${res.status}`);
        
        const data = await res.json();
        // Structure: { results: [ { id, docs: [ { ok: DOC } | { error: ... } ] } ] }
        
        const docs: any[] = [];
        if (data.results) {
            for (const result of data.results) {
                if (result.docs) {
                    for (const d of result.docs) {
                        if (d.ok) {
                            docs.push(d.ok);
                        }
                    }
                }
            }
        }
        return docs;
    } catch (e) {
        console.error("[MARVIN SYNC] Fetch bulk docs error", e);
        return [];
    }
  }

  async debugDbAccess() {
    if (!this.syncConfig) {
        console.warn("Cannot debug DB: Missing sync credentials");
        return;
    }
    const { server, database } = this.syncConfig;
    const cleanServer = server.replace(/\/$/, '');
    
    // Fetch a sample of all docs
    const url = `${PROXY_PREFIX}${cleanServer}/${database}/_all_docs?limit=5&include_docs=true`;
    
    try {
        console.log("[DEBUG DB] Fetching 5 docs via _all_docs...");
        const res = await fetch(url, {
            headers: this.syncAuthHeaders
        });
        const data = await res.json();
        console.log("[DEBUG DB] _all_docs response:", data);
        
        if (data.rows && data.rows.length > 0) {
            console.log("[DEBUG DB] Sample Doc:", data.rows[0].doc);
        }
    } catch (e) {
        console.error("[DEBUG DB] Error fetching docs", e);
    }
  }

  // --- CRUD Methods ---

  async createTask(title: string, parentId?: string): Promise<any> {
    const timezoneOffset = -new Date().getTimezoneOffset();
    return this.request('/addTask', {
      method: 'POST',
      headers: this.apiHeaders,
      body: JSON.stringify({
        title,
        parentId: parentId || 'unassigned',
        day: null,
        timeZoneOffset: timezoneOffset
      })
    });
  }

  async markDone(itemId: string): Promise<any> {
    return this.request('/markDone', {
      method: 'POST',
      headers: this.apiHeaders,
      body: JSON.stringify({ itemId })
    });
  }

  async updateDoc(itemId: string, updates: Record<string, any>): Promise<any> {
    if (!this.fullAccessToken) {
        throw new Error("Full Access Token required for updates (renaming).");
    }
    
    // Automatically manage fieldUpdates
    const now = Date.now();
    const setters = [];

    for (const [key, val] of Object.entries(updates)) {
        setters.push({ key, val });
        setters.push({ key: `fieldUpdates.${key}`, val: now });
    }
    setters.push({ key: 'updatedAt', val: now });

    return this.request('/doc/update', {
      method: 'POST',
      headers: this.fullAccessHeaders,
      body: JSON.stringify({
        itemId,
        setters
      })
    });
  }

  async deleteDoc(itemId: string): Promise<any> {
    if (!this.fullAccessToken) {
        throw new Error("Full Access Token required for deletion.");
    }
    return this.request('/doc/delete', {
      method: 'POST',
      headers: this.fullAccessHeaders,
      body: JSON.stringify({ itemId })
    });
  }

  async startTracking(taskId: string): Promise<any> {
    return this.request('/track', {
      method: 'POST',
      headers: this.apiHeaders,
      body: JSON.stringify({ taskId, action: 'START' })
    });
  }

  async stopTracking(taskId: string): Promise<any> {
    return this.request('/track', {
      method: 'POST',
      headers: this.apiHeaders,
      body: JSON.stringify({ taskId, action: 'STOP' })
    });
  }

  async getInbox(): Promise<Task[]> {
    try {
      const data = await this.request('/children?parentId=unassigned', {
        headers: this.apiHeaders
      });
      
      if (!Array.isArray(data)) return [];

      return data
        .filter((item: any) => !item.done && item.day === 'unassigned')
        .map(this.mapToTask);
    } catch (e) {
      console.error("Failed to fetch inbox", e);
      return [];
    }
  }

  async getToday(): Promise<Task[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await this.request(`/todayItems?date=${today}`, {
        headers: this.apiHeaders
      });
      
      if (!Array.isArray(data)) return [];

      return data
        .filter((item: any) => !item.done)
        .map(this.mapToTask);
    } catch (e) {
      console.error("Failed to fetch today items", e);
      return [];
    }
  }

  async getTrackedItem(): Promise<any> {
    try {
      return await this.request('/trackedItem', {
        headers: this.apiHeaders
      });
    } catch (e) {
      return null;
    }
  }

  async getAllCategories(): Promise<Category[]> {
    try {
      const data = await this.request('/categories', {
        headers: this.apiHeaders
      });
      if (!Array.isArray(data)) return [];
      return data.map((item: any) => ({
        id: item._id,
        title: item.title,
        type: item.type,
        parentId: item.parentId,
        color: item.color
      }));
    } catch (e) {
      console.error("Failed to fetch categories", e);
      return [];
    }
  }

  async getLabels(): Promise<Label[]> {
    try {
      const data = await this.request('/labels', {
        headers: this.apiHeaders
      });
      if (!Array.isArray(data)) return [];
      return data.map((item: any) => ({
        id: item._id,
        title: item.title,
        color: item.color
      }));
    } catch (e) {
      console.error("Failed to fetch labels", e);
      return [];
    }
  }

  public mapToTask(item: any): Task {
    let totalMs = item.duration || 0;
    const timeSpentSeconds = Math.floor(totalMs / 1000);

    return {
      id: item._id,
      title: item.title,
      status: item.done ? TaskStatus.DONE : (item.day !== 'unassigned' ? TaskStatus.NEXT : TaskStatus.INBOX),
      createdAt: item.createdAt,
      completedAt: item.completedAt || (item.done ? item.doneAt : undefined),
      timeSpent: timeSpentSeconds,
      timeEstimate: item.timeEstimate,
      project: (item.parentId && item.parentId !== 'unassigned') ? item.parentId : undefined,
      note: item.note,
      dueDate: item.dueDate,
      db: item.db,
      type: item.type,
      day: item.day,
      labelIds: item.labelIds
    };
  }
}