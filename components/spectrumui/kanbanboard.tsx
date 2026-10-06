'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, GripVertical, MessageCircle, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  assignee?: {
    name: string;
    avatar: string;
  };
  tags?: string[];
  dueDate?: string;
  attachments?: number;
  comments?: number;
}

export interface KanbanColumn {
  id: string;
  title: string;
  tasks: KanbanTask[];
  color?: string;
}

export interface KanbanBoardProps {
  columns: KanbanColumn[];
  title?: string;
  subtitle?: string;
  onTaskClick?: (task: KanbanTask) => void;
  className?: string;
}

export default function KanbanBoard({
  columns: initialColumns,
  title,
  subtitle,
  onTaskClick,
  className,
}: KanbanBoardProps) {
  const [columns, setColumns] = useState<KanbanColumn[]>(initialColumns);
  const [prevInitial, setPrevInitial] = useState(initialColumns);
  if (initialColumns !== prevInitial) {
    setPrevInitial(initialColumns);
    setColumns(initialColumns);
  }

  const handleDragStart = (e: React.DragEvent, task: KanbanTask, columnId: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ task, sourceColumnId: columnId }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    const { task, sourceColumnId } = data;

    if (sourceColumnId === targetColumnId) return;

    setColumns((prev) =>
      prev.map((col) => {
        if (col.id === sourceColumnId) {
          return { ...col, tasks: col.tasks.filter((t) => t.id !== task.id) };
        }
        if (col.id === targetColumnId) {
          return { ...col, tasks: [...col.tasks, task] };
        }
        return col;
      }),
    );
  };

  return (
    <div className={className}>
      {(title || subtitle) && (
        <div className="mb-6">
          {title && (
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{subtitle}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((column) => (
          <div
            key={column.id}
            className="bg-white/60 dark:bg-neutral-900/40 backdrop-blur-xl rounded-2xl p-4 border border-border dark:border-neutral-700/50"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: column.color ?? '#94a3b8' }}
              />
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {column.title}
              </h3>
              <Badge className="bg-neutral-100/80 dark:bg-neutral-800/80 text-neutral-800 dark:text-neutral-200 border-neutral-200/50 dark:border-neutral-600/50">
                {column.tasks.length}
              </Badge>
            </div>

            <div className="space-y-3">
              {column.tasks.length === 0 && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 px-1 py-3 text-center">
                  No deals
                </p>
              )}
              {column.tasks.map((task) => (
                <Card
                  key={task.id}
                  className={cn(
                    'transition-all duration-300 border bg-white/80 dark:bg-neutral-800/60 backdrop-blur-xs hover:bg-white dark:hover:bg-neutral-700/70',
                    onTaskClick ? 'cursor-pointer' : 'cursor-move'
                  )}
                  draggable={!onTaskClick}
                  onDragStart={(e) => handleDragStart(e, task, column.id)}
                  onClick={() => onTaskClick?.(task)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">
                          {task.title}
                        </h4>
                        {!onTaskClick && (
                          <GripVertical className="w-4 h-4 text-neutral-400 dark:text-neutral-500 cursor-move shrink-0" />
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      {task.tags && task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {task.tags.map((tag) => (
                            <Badge
                              key={tag}
                              className="text-[10px] bg-neutral-100/60 dark:bg-neutral-700/60 text-neutral-800 dark:text-neutral-200 border-neutral-200/50 dark:border-neutral-600/50 backdrop-blur-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-neutral-200/30 dark:border-neutral-700/30">
                        <div className="flex items-center gap-3 text-neutral-600 dark:text-neutral-400">
                          {task.dueDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-medium tabular-nums">
                                {task.dueDate}
                              </span>
                            </div>
                          )}
                          {task.comments ? (
                            <div className="flex items-center gap-1">
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-medium">{task.comments}</span>
                            </div>
                          ) : null}
                          {task.attachments ? (
                            <div className="flex items-center gap-1">
                              <Paperclip className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-medium">{task.attachments}</span>
                            </div>
                          ) : null}
                        </div>

                        {task.assignee && (
                          <Avatar className="w-6 h-6 ring-2 ring-white/50 dark:ring-neutral-700/50">
                            <AvatarImage src={task.assignee.avatar} />
                            <AvatarFallback className="bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-[10px]">
                              {task.assignee.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
