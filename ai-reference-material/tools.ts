import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import axios from 'axios';
import { z } from 'zod';

const MARVIN_API_URL = 'https://serv.amazingmarvin.com/api';

// Zod Schemas for Tool Inputs
const CreateTaskSchema = z.object({
  title: z.string().describe('The title of the task.'),
  day: z.string().optional().describe('The day the task is scheduled for (YYYY-MM-DD).'),
  parentId: z.string().optional().describe('The ID of the parent project or category.'),
  labelIds: z.array(z.string()).optional().describe('An array of label IDs.'),
  dueDate: z.string().optional().describe('The due date of the task (YYYY-MM-DD).'),
  timeEstimate: z.number().optional().describe('The estimated time in milliseconds.'),
  note: z.string().optional().describe('A note for the task.'),
});

const MarkTaskDoneSchema = z.object({
  itemId: z.string().describe('The ID of the task to mark as done.'),
});

const TimeTrackingSchema = z.object({
  taskId: z.string().describe('The ID of the task to start or stop tracking.'),
});

const CreateProjectSchema = z.object({
    title: z.string().describe('The title of the project.'),
    day: z.string().optional().describe('The day the project is scheduled for (YYYY-MM-DD).'),
    parentId: z.string().optional().describe('The ID of the parent project or category.'),
    labelIds: z.array(z.string()).optional().describe('An array of label IDs.'),
    dueDate: z.string().optional().describe('The due date of the project (YYYY-MM-DD).'),
    timeEstimate: z.number().optional().describe('The estimated time in milliseconds.'),
    note: z.string().optional().describe('A note for the project.'),
});

const GetTodayItemsSchema = z.object({
  date: z.string().optional().describe('The date to get items for (YYYY-MM-DD). Defaults to today.'),
});

const GetDueItemsSchema = z.object({
  by: z.string().optional().describe('The date to get due items by (YYYY-MM-DD). Defaults to today.'),
});

const GetChildrenSchema = z.object({
  parentId: z.string().describe('The ID of the parent category or project to get children for.'),
});

const SetReminderSchema = z.object({
  itemId: z.string().describe('The ID of the task to set a reminder for.'),
  remindAt: z.number().describe('The unix timestamp (in milliseconds) to set the reminder for.'),
});

const DeleteReminderSchema = z.object({
  reminderId: z.string().describe('The ID of the reminder to delete.'),
});

const RecordHabitSchema = z.object({
  habitId: z.string().describe('The ID of the habit to record.'),
  value: z.number().optional().describe('The value to record for the habit.'),
});

const UndoHabitSchema = z.object({
  habitId: z.string().describe('The ID of the habit to undo.'),
});

const AddEventSchema = z.object({
  title: z.string().describe('The title of the event.'),
  start: z.string().describe('The start time of the event in ISO format.'),
  length: z.number().optional().describe('The length of the event in milliseconds.'),
  note: z.string().optional().describe('A note for the event.'),
});

const GetTodayTimeBlocksSchema = z.object({
  date: z.string().optional().describe('The date to get time blocks for (YYYY-MM-DD). Defaults to today.'),
});

const GetHabitSchema = z.object({
  id: z.string().describe('The ID of the habit to retrieve.'),
});

const ClaimRewardPointsSchema = z.object({
  points: z.number().describe('The number of points to claim.'),
  itemId: z.string().describe('The ID of the item to claim points for, or "MANUAL".'),
  date: z.string().optional().describe('The date to claim points for (YYYY-MM-DD).'),
});

const UnclaimRewardPointsSchema = z.object({
  itemId: z.string().describe('The ID of the item to unclaim points for.'),
  date: z.string().optional().describe('The date to unclaim points for (YYYY-MM-DD).'),
});

const SpendRewardPointsSchema = z.object({
  points: z.number().describe('The number of points to spend.'),
  date: z.string().optional().describe('The date to spend points for (YYYY-MM-DD).'),
});

const GetTracksSchema = z.object({
  taskIds: z.array(z.string()).describe('An array of task IDs to get time tracking info for.'),
});

const UpdateDocSchema = z.object({
  itemId: z.string().describe('The ID of the document to update.'),
  setters: z.array(z.object({
    key: z.string(),
    val: z.any(),
  })).describe('An array of key-value pairs to update.'),
});

const CreateDocSchema = z.object({
  doc: z.record(z.string(), z.any()).describe('The document to create. Must include `db` field.'),
});

const DeleteDocSchema = z.object({
  itemId: z.string().describe('The ID of the document to delete.'),
});


// Create the MCP Server Instance
export const createServer = (apiToken: string, fullAccessToken: string) => {
  const server = new McpServer(
    {
      name: 'marvin-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register Tools
  server.registerTool(
    'createTask',
    {
      description: 'Creates a new task in Amazing Marvin.',
      inputSchema: CreateTaskSchema.shape,
    },
    async (params) => {
      const task = CreateTaskSchema.parse(params);
      const response = await axios.post(`${MARVIN_API_URL}/addTask`, task, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'markTaskDone',
    {
      description: 'Marks a task as done.',
      inputSchema: MarkTaskDoneSchema.shape,
    },
    async (params) => {
      const { itemId } = MarkTaskDoneSchema.parse(params);
      const response = await axios.post(`${MARVIN_API_URL}/markDone`, { itemId }, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
      'createProject',
      {
          description: 'Creates a new project.',
          inputSchema: CreateProjectSchema.shape,
      },
      async (params) => {
          const project = CreateProjectSchema.parse(params);
          const response = await axios.post(`${MARVIN_API_URL}/addProject`, project, {
              headers: { 'X-API-Token': apiToken },
          });
          return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
      }
  );

  server.registerTool(
    'getTodayItems',
    {
      description: 'Gets tasks and projects scheduled for today.',
      inputSchema: GetTodayItemsSchema.shape,
    },
    async (params) => {
      const { date } = GetTodayItemsSchema.parse(params);
      const response = await axios.get(`${MARVIN_API_URL}/todayItems`, {
        headers: { 'X-API-Token': apiToken },
        params: { date },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'getDueItems',
    {
      description: 'Gets open tasks and projects that are due today, or earlier.',
      inputSchema: GetDueItemsSchema.shape,
    },
    async (params) => {
      const { by } = GetDueItemsSchema.parse(params);
      const response = await axios.get(`${MARVIN_API_URL}/dueItems`, {
        headers: { 'X-API-Token': apiToken },
        params: { by },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'getCategories',
    {
      description: 'Gets a list of all categories.',
      inputSchema: z.object({}).shape,
    },
    async () => {
      const response = await axios.get(`${MARVIN_API_URL}/categories`, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'getLabels',
    {
      description: 'Gets a list of all labels.',
      inputSchema: z.object({}).shape,
    },
    async () => {
      const response = await axios.get(`${MARVIN_API_URL}/labels`, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'getChildren',
    {
      description: 'Gets child tasks and projects of a category or project.',
      inputSchema: GetChildrenSchema.shape,
    },
    async (params) => {
      const { parentId } = GetChildrenSchema.parse(params);
      const response = await axios.get(`${MARVIN_API_URL}/children`, {
        headers: { 'X-API-Token': apiToken },
        params: { parentId },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'startTracking',
    {
      description: 'Starts time tracking for a task.',
      inputSchema: TimeTrackingSchema.shape,
    },
    async (params) => {
      const { taskId } = TimeTrackingSchema.parse(params);
      const response = await axios.post(`${MARVIN_API_URL}/track`, { taskId, action: 'START' }, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'stopTracking',
    {
      description: 'Stops time tracking for a task.',
      inputSchema: TimeTrackingSchema.shape,
    },
    async (params) => {
      const { taskId } = TimeTrackingSchema.parse(params);
      const response = await axios.post(`${MARVIN_API_URL}/track`, { taskId, action: 'STOP' }, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'getTrackedItem',
    {
      description: 'Gets the currently tracked task.',
      inputSchema: z.object({}).shape,
    },
    async () => {
      const response = await axios.get(`${MARVIN_API_URL}/trackedItem`, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'getReminders',
    {
      description: 'Gets a list of all reminders.',
      inputSchema: z.object({}).shape,
    },
    async () => {
      const response = await axios.get(`${MARVIN_API_URL}/reminders`, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'setReminder',
    {
      description: 'Sets a reminder for a task.',
      inputSchema: SetReminderSchema.shape,
    },
    async (params) => {
      const reminder = SetReminderSchema.parse(params);
      const response = await axios.post(`${MARVIN_API_URL}/reminders`, reminder, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'deleteReminder',
    {
      description: 'Deletes a reminder.',
      inputSchema: DeleteReminderSchema.shape,
    },
    async (params) => {
      const { reminderId } = DeleteReminderSchema.parse(params);
      const response = await axios.delete(`${MARVIN_API_URL}/reminders/${reminderId}`, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'recordHabit',
    {
      description: 'Records a habit.',
      inputSchema: RecordHabitSchema.shape,
    },
    async (params) => {
      const habit = RecordHabitSchema.parse(params);
      const response = await axios.post(`${MARVIN_API_URL}/updateHabit`, { ...habit, updateDB: true }, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'undoHabit',
    {
      description: 'Undoes the last recording of a habit.',
      inputSchema: UndoHabitSchema.shape,
    },
    async (params) => {
      const { habitId } = UndoHabitSchema.parse(params);
      const response = await axios.post(`${MARVIN_API_URL}/updateHabit`, { habitId, undo: true, updateDB: true }, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'getMe',
    {
      description: 'Gets information about your account.',
      inputSchema: z.object({}).shape,
    },
    async () => {
      const response = await axios.get(`${MARVIN_API_URL}/me`, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'addEvent',
    {
      description: 'Creates a new event.',
      inputSchema: AddEventSchema.shape,
    },
    async (params) => {
      const event = AddEventSchema.parse(params);
      const response = await axios.post(`${MARVIN_API_URL}/addEvent`, event, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'getTodayTimeBlocks',
    {
      description: "Gets a list of today's time blocks.",
      inputSchema: GetTodayTimeBlocksSchema.shape,
    },
    async (params) => {
      const { date } = GetTodayTimeBlocksSchema.parse(params);
      const response = await axios.get(`${MARVIN_API_URL}/todayTimeBlocks`, {
        headers: { 'X-API-Token': apiToken },
        params: { date },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'getGoals',
    {
      description: 'Gets a list of all goals.',
      inputSchema: z.object({}).shape,
    },
    async () => {
      const response = await axios.get(`${MARVIN_API_URL}/goals`, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'getHabit',
    {
      description: 'Gets a habit by ID.',
      inputSchema: GetHabitSchema.shape,
    },
    async (params) => {
      const { id } = GetHabitSchema.parse(params);
      const response = await axios.get(`${MARVIN_API_URL}/habit`, {
        headers: { 'X-API-Token': apiToken },
        params: { id },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'listHabits',
    {
      description: 'Gets a list of all habits.',
      inputSchema: z.object({}).shape,
    },
    async () => {
      const response = await axios.get(`${MARVIN_API_URL}/habits`, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'getKudos',
    {
      description: 'Gets Marvin Kudos info.',
      inputSchema: z.object({}).shape,
    },
    async () => {
      const response = await axios.get(`${MARVIN_API_URL}/kudos`, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'claimRewardPoints',
    {
      description: 'Claims reward points.',
      inputSchema: ClaimRewardPointsSchema.shape,
    },
    async (params) => {
      const data = ClaimRewardPointsSchema.parse(params);
      const response = await axios.post(`${MARVIN_API_URL}/claimRewardPoints`, { ...data, op: 'CLAIM' }, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'unclaimRewardPoints',
    {
      description: 'Unclaims reward points.',
      inputSchema: UnclaimRewardPointsSchema.shape,
    },
    async (params) => {
      const data = UnclaimRewardPointsSchema.parse(params);
      const response = await axios.post(`${MARVIN_API_URL}/unclaimRewardPoints`, { ...data, op: 'UNCLAIM' }, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'spendRewardPoints',
    {
      description: 'Spends reward points.',
      inputSchema: SpendRewardPointsSchema.shape,
    },
    async (params) => {
      const data = SpendRewardPointsSchema.parse(params);
      const response = await axios.post(`${MARVIN_API_URL}/spendRewardPoints`, { ...data, op: 'SPEND' }, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'resetRewardPoints',
    {
      description: 'Resets reward points.',
      inputSchema: z.object({}).shape,
    },
    async () => {
      const response = await axios.post(`${MARVIN_API_URL}/resetRewardPoints`, {}, {
        headers: { 'X-Full-Access-Token': fullAccessToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'getTracks',
    {
      description: 'Gets time tracking info for tasks.',
      inputSchema: GetTracksSchema.shape,
    },
    async (params) => {
      const { taskIds } = GetTracksSchema.parse(params);
      const response = await axios.post(`${MARVIN_API_URL}/tracks`, { taskIds }, {
        headers: { 'X-API-Token': apiToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'deleteAllReminders',
    {
      description: 'Deletes all reminders.',
      inputSchema: z.object({}).shape,
    },
    async () => {
      const response = await axios.post(`${MARVIN_API_URL}/reminder/deleteAll`, {}, {
        headers: { 'X-Full-Access-Token': fullAccessToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'updateDoc',
    {
      description: 'Updates any document. Use with caution.',
      inputSchema: UpdateDocSchema.shape,
    },
    async (params) => {
      const data = UpdateDocSchema.parse(params);
      const response = await axios.post(`${MARVIN_API_URL}/doc/update`, data, {
        headers: { 'X-Full-Access-Token': fullAccessToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'createDoc',
    {
      description: 'Creates any document. Use with caution.',
      inputSchema: CreateDocSchema.shape,
    },
    async (params) => {
      const { doc } = CreateDocSchema.parse(params);
      const response = await axios.post(`${MARVIN_API_URL}/doc/create`, { ...doc, createdAt: Date.now() }, {
        headers: { 'X-Full-Access-Token': fullAccessToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  server.registerTool(
    'deleteDoc',
    {
      description: 'Deletes any document. Use with caution.',
      inputSchema: DeleteDocSchema.shape,
    },
    async (params) => {
      const data = DeleteDocSchema.parse(params);
      const response = await axios.post(`${MARVIN_API_URL}/doc/delete`, data, {
        headers: { 'X-Full-Access-Token': fullAccessToken },
      });
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
    }
  );

  return server;
};