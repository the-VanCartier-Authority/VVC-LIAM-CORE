/**
 * Firebase Firestore Synchronization Service
 * Manages persistent state sync between local applet state and cloud Firestore
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './googleAuth';
import type { TaskItem, CalendarEvent } from '../types';

/**
 * Save user profile and preferences to Firestore
 */
export async function syncUserProfileToFirestore(
  userId: string,
  data: {
    email?: string | null;
    displayName?: string | null;
    theme?: string;
    activeAgentId?: string;
  }
) {
  if (!userId) return;
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(
      userRef,
      {
        uid: userId,
        email: data.email || '',
        displayName: data.displayName || '',
        theme: data.theme || 'liam-core-official',
        activeAgentId: data.activeAgentId || 'exclusive-vladimir',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Error saving user profile to Firestore:', err);
  }
}

/**
 * Save or update a task in user's Firestore collection
 */
export async function saveTaskToFirestore(userId: string, task: TaskItem) {
  if (!userId || !task.id) return;
  try {
    const taskRef = doc(db, 'users', userId, 'tasks', task.id);
    await setDoc(
      taskRef,
      {
        id: task.id,
        userId,
        title: task.title,
        category: task.category || 'general',
        priority: task.priority || 'medium',
        isCompleted: Boolean(task.isCompleted),
        dueDate: task.dueDate || '',
        timeDue: task.timeDue || '',
        timeZone: task.timeZone ?? null,
        dueAt: task.dueAt ?? null,
        snoozedUntil: task.snoozedUntil ?? null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn(`Error syncing task ${task.id} to Firestore:`, err);
  }
}

/**
 * Delete a task from Firestore
 */
export async function deleteTaskFromFirestore(userId: string, taskId: string) {
  if (!userId || !taskId) return;
  try {
    const taskRef = doc(db, 'users', userId, 'tasks', taskId);
    await deleteDoc(taskRef);
  } catch (err) {
    console.warn(`Error deleting task ${taskId} from Firestore:`, err);
  }
}

/**
 * Save or update a calendar event in user's Firestore collection
 */
export async function saveEventToFirestore(userId: string, event: CalendarEvent) {
  if (!userId || !event.id) return;
  try {
    const eventRef = doc(db, 'users', userId, 'events', event.id);
    await setDoc(
      eventRef,
      {
        id: event.id,
        userId,
        title: event.title,
        date: event.date,
        time: event.time || '',
        endTime: event.endTime ?? null,
        endDate: event.endDate ?? null,
        timeZone: event.timeZone ?? null,
        allDay: Boolean(event.allDay),
        category: event.category || 'general',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn(`Error syncing event ${event.id} to Firestore:`, err);
  }
}

/**
 * Delete a calendar event from Firestore
 */
export async function deleteEventFromFirestore(userId: string, eventId: string) {
  if (!userId || !eventId) return;
  try {
    const eventRef = doc(db, 'users', userId, 'events', eventId);
    await deleteDoc(eventRef);
  } catch (err) {
    console.warn(`Error deleting event ${eventId} from Firestore:`, err);
  }
}

/**
 * Real-time subscription to user's Firestore tasks
 */
export function subscribeToUserTasks(
  userId: string,
  onTasksUpdated: (tasks: TaskItem[]) => void
) {
  if (!userId) return () => {};
  const tasksCol = collection(db, 'users', userId, 'tasks');
  return onSnapshot(
    tasksCol,
    (snapshot) => {
      const items: TaskItem[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: d.id || docSnap.id,
          title: d.title || d.text || 'Tarea sin título',
          isCompleted: Boolean(d.isCompleted ?? d.completed),
          category: d.category || 'general',
          priority: d.priority || 'medium',
          dueDate: d.dueDate || '',
          timeDue: d.timeDue || '',
          timeZone: d.timeZone || undefined,
          dueAt: d.dueAt || undefined,
          snoozedUntil: d.snoozedUntil || undefined,
          recurrence: d.recurrence || 'none',
          subtasks: d.subtasks || [],
          createdAt: d.createdAt || Date.now(),
          updatedAt: d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now(),
        });
      });
      if (items.length > 0) {
        onTasksUpdated(items);
      }
    },
    (err) => {
      console.warn('Firestore tasks snapshot error:', err);
    }
  );
}

/**
 * Real-time subscription to user's Firestore calendar events
 */
export function subscribeToUserEvents(
  userId: string,
  onEventsUpdated: (events: CalendarEvent[]) => void
) {
  if (!userId) return () => {};
  const eventsCol = collection(db, 'users', userId, 'events');
  return onSnapshot(
    eventsCol,
    (snapshot) => {
      const items: CalendarEvent[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: d.id || docSnap.id,
          title: d.title,
          date: d.date,
          time: d.time || '',
          endTime: d.endTime || undefined,
          endDate: d.endDate || undefined,
          timeZone: d.timeZone || undefined,
          allDay: Boolean(d.allDay),
          category: d.category || 'general',
        });
      });
      if (items.length > 0) {
        onEventsUpdated(items);
      }
    },
    (err) => {
      console.warn('Firestore events snapshot error:', err);
    }
  );
}
