/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ListTodo, Plus, Trash2 } from 'lucide-react';
import { CustomTask, ActivityCardItem } from '../types.js';

interface TodoNotesCartoucheProps {
  todos?: ActivityCardItem[];
  onAddTodo?: (titre: string) => void;
  onToggleDone?: (id: number, fait: boolean) => void;
  onDeleteTodo?: (id: number) => void;
  isUnlocked?: boolean;
}

export const TodoNotesCartouche: React.FC<TodoNotesCartoucheProps> = ({
  todos,
  onAddTodo,
  onDeleteTodo,
  isUnlocked = false,
}) => {
  const [tasks, setTasks] = useState<CustomTask[]>([]);
  const [newText, setNewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Récupération des tâches depuis la table Neon custom_tasks
  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/custom-tasks?teacher_id=JulieCB');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des tâches custom_tasks:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Synchroniser si le parent recharge le journal
  useEffect(() => {
    if (todos) {
      fetchTasks();
    }
  }, [todos]);

  // Ajouter une nouvelle tâche
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newText.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);
    setNewText('');
    try {
      const res = await fetch('/api/custom-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_text: text, teacher_id: 'JulieCB' }),
      });
      if (res.ok) {
        const createdTask = await res.json();
        setTasks((prev) => [...prev, createdTask]);
      }
      if (onAddTodo) {
        onAddTodo(text);
      }
    } catch (err) {
      console.error('Erreur lors de la création de la tâche:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cocher = Supprimer définitivement de la base de données
  const handleDeleteTask = async (id: number) => {
    // Mise à jour optimiste de l'interface
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch(`/api/custom-tasks/${id}`, {
        method: 'DELETE',
      });
      if (onDeleteTodo) {
        onDeleteTodo(id);
      }
    } catch (err) {
      console.error('Erreur lors de la suppression de la tâche:', err);
      fetchTasks(); // Récupérer l'état réel en cas d'échec
    }
  };

  return (
    <section className="bg-amber-100/95 border-2 border-amber-300/90 rounded-xl p-2.5 shadow-xs flex flex-col gap-2 relative select-none shrink-0 w-full hover:shadow-sm transition-all duration-200">
      {/* Visual Tape / Pin strip decoration */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-3.5 bg-amber-200/80 border border-amber-300/80 rounded shadow-2xs rotate-1 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-amber-300/60 pb-1.5 pt-0.5">
        <div className="flex items-center gap-1.5">
          <div className="p-1 bg-amber-200/80 text-amber-900 rounded-md shadow-2xs">
            <ListTodo className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-[11px] font-black text-amber-950 uppercase tracking-wider">
              À ne pas oublier
            </h3>
          </div>
        </div>
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-200/90 text-amber-900 border border-amber-300 shadow-2xs">
          {tasks.length}
        </span>
      </div>

      {/* Form Add (Only when unlocked) */}
      {isUnlocked && (
        <form onSubmit={handleSubmit} className="flex gap-1.5">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Note rapide..."
            className="flex-1 px-2 py-1 text-xs bg-amber-50/90 border border-amber-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white text-amber-950 font-medium placeholder:text-amber-700/50 shadow-2xs"
          />
          <button
            type="submit"
            disabled={!newText.trim()}
            className="px-2 py-1 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-bold rounded-md disabled:opacity-50 transition-colors flex items-center justify-center shrink-0 shadow-2xs cursor-pointer"
            title="Ajouter au pense-bête"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      {/* Task List */}
      <div className="space-y-1 max-h-28 overflow-y-auto pr-0.5">
        {tasks.length === 0 ? (
          <p className="text-[10px] text-amber-800/60 italic py-1.5 text-center font-medium">
            Aucune note en attente.
          </p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-1.5 rounded-md bg-amber-50/90 border border-amber-200/90 text-amber-950 hover:border-amber-400 transition-all shadow-2xs group"
            >
              {isUnlocked ? (
                <>
                  <label
                    className="flex items-center gap-1.5 cursor-pointer flex-1 min-w-0"
                    title="Cocher pour valider et supprimer définitivement"
                  >
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => handleDeleteTask(task.id)}
                      className="w-3 h-3 text-amber-600 rounded border-amber-400 focus:ring-amber-500 cursor-pointer accent-amber-600 shrink-0"
                    />
                    <span className="text-[11px] font-semibold text-amber-950 truncate">
                      {task.task_text}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task.id)}
                    title="Supprimer la note"
                    className="p-0.5 text-amber-700/60 hover:text-red-700 hover:bg-amber-200/60 rounded transition-colors ml-1 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <span className="text-[11px] font-semibold text-amber-950 truncate px-1">
                  • {task.task_text}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
};

