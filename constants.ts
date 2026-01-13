
import { FunctionDeclaration, Type } from '@google/genai';

export const GEMINI_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';

export const TOOLS: FunctionDeclaration[] = [
  {
    name: 'addTask',
    description: 'Add a new task to Amazing Marvin.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'The title of the task. Can include #Project or @Label or +date.' },
        parentId: { type: Type.STRING, description: 'The ID of the parent Project or Category. Use "unassigned" for Inbox.' },
        timeEstimate: { type: Type.NUMBER, description: 'Estimated duration in milliseconds. Guess generously if unknown.' },
        reason: { type: Type.STRING, description: 'Brief reason starting with "you said..." referencing the user input.' },
      },
      required: ['title', 'parentId', 'timeEstimate', 'reason'],
    },
  },
  {
    name: 'addProject',
    description: 'Add a new project to Amazing Marvin.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'The title of the project.' },
        parentId: { type: Type.STRING, description: 'The ID of the parent Project or Category. Use "unassigned" for top level.' },
        reason: { type: Type.STRING, description: 'Brief reason starting with "you said..." referencing the user input.' },
      },
      required: ['title', 'parentId', 'reason'],
    },
  },
  {
    name: 'moveTask',
    description: 'Change the project/category of a task (move it).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemId: { type: Type.STRING, description: 'The ID or Title of the task to move.' },
        newParentId: { type: Type.STRING, description: 'The ID of the new parent Project or Category.' },
        reason: { type: Type.STRING, description: 'Brief reason starting with "you said..." referencing the user input.' },
      },
      required: ['itemId', 'newParentId', 'reason'],
    },
  },
  {
    name: 'renameTask',
    description: 'Rename an existing task in Marvin.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemId: { type: Type.STRING, description: 'The ID or Title of the task to rename.' },
        newTitle: { type: Type.STRING, description: 'The new title for the task.' },
        reason: { type: Type.STRING, description: 'Brief reason starting with "you said..." referencing the user input.' },
      },
      required: ['itemId', 'newTitle', 'reason'],
    },
  },
  {
    name: 'deleteTask',
    description: 'Permanently delete a task from Marvin.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemId: { type: Type.STRING, description: 'The ID or Title of the task to delete.' },
        reason: { type: Type.STRING, description: 'Brief reason starting with "you said..." referencing the user input.' },
      },
      required: ['itemId', 'reason'],
    },
  },
  {
    name: 'getTasks',
    description: 'Get the list of current tasks (Inbox or Today) from Marvin.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filter: { type: Type.STRING, description: 'Filter by "INBOX" or "TODAY"' },
      },
    },
  },
  {
    name: 'search',
    description: 'Search for tasks, projects, or categories by keyword. Use eagerly when items are not found in context.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'The search keyword(s).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'getCurrentTask',
    description: 'Get the currently active (tracked) task in Marvin.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'markTaskDone',
    description: 'Mark a task as completed in Marvin.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemId: { type: Type.STRING, description: 'The ID or Title of the task.' },
        since: { type: Type.STRING, description: 'Required. Time when it was done, e.g. "10m" (ago), "14:30", or "now".' },
        reason: { type: Type.STRING, description: 'Brief reason starting with "you said..." referencing the user input.' },
      },
      required: ['itemId', 'since', 'reason'],
    },
  },
  {
    name: 'getTaskSessions',
    description: 'Get the time tracking sessions for a task.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemId: { type: Type.STRING, description: 'The ID or Title of the task.' },
      },
      required: ['itemId'],
    },
  },
  {
    name: 'updateTaskSessions',
    description: 'Update the time tracking sessions for a task. Overwrites existing sessions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemId: { type: Type.STRING, description: 'The ID or Title of the task.' },
        sessions: { 
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              start: { type: Type.NUMBER, description: 'Start timestamp (ms)' },
              end: { type: Type.NUMBER, description: 'End timestamp (ms)' }
            },
            required: ['start', 'end']
          },
          description: 'List of session objects with start and end timestamps.'
        },
        reason: { type: Type.STRING, description: 'Reason for update.' }
      },
      required: ['itemId', 'sessions', 'reason']
    }
  },
  {
    name: 'startTimer',
    description: 'Start time tracking for a specific task in Marvin.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemId: { type: Type.STRING, description: 'The ID or Title of the task to work on.' },
        reason: { type: Type.STRING, description: 'Brief reason starting with "you said..." referencing the user input.' },
      },
      required: ['itemId', 'reason'],
    },
  },
  {
    name: 'stopTimer',
    description: 'Stop the currently running timer in Marvin.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemId: { type: Type.STRING, description: 'The ID or Title of the task to stop (optional, otherwise stops current).' },
        reason: { type: Type.STRING, description: 'Brief reason starting with "you said..." referencing the user input.' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'endSession',
    description: 'End the voice session. Call this when the user says goodbye or indicates they are done.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];
