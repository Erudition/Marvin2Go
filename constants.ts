
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
        reason: { type: Type.STRING, description: 'Brief reason starting with "you said..." referencing the user input.' },
      },
      required: ['title', 'reason'],
    },
  },
  {
    name: 'renameTask',
    description: 'Rename an existing task in Marvin.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemId: { type: Type.STRING, description: 'The exact ID of the task to rename.' },
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
        itemId: { type: Type.STRING, description: 'The exact ID of the task to delete.' },
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
        itemId: { type: Type.STRING, description: 'The exact ID of the task.' },
        reason: { type: Type.STRING, description: 'Brief reason starting with "you said..." referencing the user input.' },
      },
      required: ['itemId', 'reason'],
    },
  },
  {
    name: 'startTimer',
    description: 'Start time tracking for a specific task in Marvin.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemId: { type: Type.STRING, description: 'The exact ID of the task to work on.' },
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
        itemId: { type: Type.STRING, description: 'The exact ID of the task to stop (optional, otherwise stops current).' },
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
