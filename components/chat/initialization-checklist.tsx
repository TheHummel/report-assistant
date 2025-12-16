'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import {
  REPORT_QUESTIONS,
  ReportInitializationState,
} from '@/types/report-initialization';

interface InitializationChecklistProps {
  state: ReportInitializationState;
  onStartQuestioning: () => void;
  onGenerateSuggestions: () => void;
  onUpdateField: (key: string, value: string, category: string) => void;
  isGenerating?: boolean;
}

export function InitializationChecklist({
  state,
  onStartQuestioning,
  onGenerateSuggestions,
  onUpdateField,
  isGenerating = false,
}: InitializationChecklistProps) {
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const requiredFieldKeys = [
      'test_facility',
      'test_date',
      'report_author',
      'devices_under_test',
      'dut_types',
      'dut_manufacturer',
      'dut_package',
    ] as const;

    const completed = requiredFieldKeys.filter(
      (key) => state.required_fields[key]
    ).length;

    setCompletedCount(completed);
    setTotalCount(requiredFieldKeys.length);
  }, [state]);

  const handleEditClick = (key: string, category: string) => {
    setEditingField(key);

    // get current value
    if (category === 'required_fields') {
      setEditValue(
        state.required_fields[key as keyof typeof state.required_fields] || ''
      );
    } else if (category === 'sections') {
      setEditValue(
        state.sections[key as keyof typeof state.sections]?.content || ''
      );
    } else if (category === 'other') {
      setEditValue(state.other[key as keyof typeof state.other] || '');
    }
  };

  const handleSaveEdit = (key: string, category: string) => {
    if (editValue.trim()) {
      onUpdateField(key, editValue.trim(), category);
    }
    setEditingField(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const getFieldStatus = (key: string) => {
    if (key in state.required_fields) {
      return state.required_fields[
        key as keyof typeof state.required_fields
      ] ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <Circle className="h-4 w-4 text-slate-300" />
      );
    }

    if (key in state.sections) {
      const section = state.sections[key as keyof typeof state.sections];
      if (section.status === 'complete') {
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      } else if (section.status === 'partial') {
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      }
      return <Circle className="h-4 w-4 text-slate-300" />;
    }

    return <Circle className="h-4 w-4 text-slate-300" />;
  };

  const canGenerateSuggestions = completedCount >= 3;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Report Initialization</CardTitle>
          <Badge
            variant={completedCount === totalCount ? 'default' : 'secondary'}
          >
            {completedCount} / {totalCount} complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Required Fields</h4>
          <div className="space-y-1">
            {REPORT_QUESTIONS.filter(
              (q) => q.category === 'required_fields'
            ).map((question) => {
              const hasValue =
                state.required_fields[
                  question.key as keyof typeof state.required_fields
                ];
              const isEditing = editingField === question.key;

              return (
                <div key={question.key}>
                  {isEditing ? (
                    <div className="flex items-center gap-2 px-1 py-0.5">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEdit(question.key, question.category);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        className="h-7 flex-1 text-sm"
                        autoFocus
                        placeholder={question.topic}
                      />
                      <button
                        onClick={() =>
                          handleSaveEdit(question.key, question.category)
                        }
                        className="rounded p-1 text-green-600 hover:bg-green-100"
                        title="Save"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="rounded p-1 text-red-600 hover:bg-red-100"
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="group flex items-center justify-between gap-2 rounded px-1 py-0.5 text-sm transition-colors hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        {getFieldStatus(question.key)}
                        <span className="text-slate-700">{question.topic}</span>
                      </div>
                      {hasValue && (
                        <button
                          onClick={() =>
                            handleEditClick(question.key, question.category)
                          }
                          className="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-200"
                          title="Edit this field"
                        >
                          <Pencil className="h-3 w-3 text-slate-600" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Sections</h4>
          <div className="space-y-1">
            {REPORT_QUESTIONS.filter((q) => q.category === 'sections').map(
              (question) => {
                const section =
                  state.sections[question.key as keyof typeof state.sections];
                const hasContent = section?.content;
                const isEditing = editingField === question.key;

                return (
                  <div key={question.key}>
                    {isEditing ? (
                      <div className="flex items-start gap-2 px-1 py-0.5">
                        <Textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) {
                              handleSaveEdit(question.key, question.category);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          className="min-h-[60px] flex-1 text-sm"
                          autoFocus
                          placeholder={question.topic}
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() =>
                              handleSaveEdit(question.key, question.category)
                            }
                            className="rounded p-1 text-green-600 hover:bg-green-100"
                            title="Save (Ctrl+Enter)"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="rounded p-1 text-red-600 hover:bg-red-100"
                            title="Cancel (Esc)"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="group flex items-center justify-between gap-2 rounded px-1 py-0.5 text-sm transition-colors hover:bg-slate-50">
                        <div className="flex items-center gap-2">
                          {getFieldStatus(question.key)}
                          <span className="text-slate-700">
                            {question.topic}
                          </span>
                        </div>
                        {hasContent && (
                          <button
                            onClick={() =>
                              handleEditClick(question.key, question.category)
                            }
                            className="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-200"
                            title="Edit this field"
                          >
                            <Pencil className="h-3 w-3 text-slate-600" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-4">
          {completedCount === 0 ? (
            <Button onClick={onStartQuestioning} className="w-full">
              Start Initialization
            </Button>
          ) : (
            <>
              <Button
                onClick={onStartQuestioning}
                variant="outline"
                className="w-full"
              >
                Continue Answering Questions
              </Button>
              {canGenerateSuggestions && (
                <Button
                  onClick={onGenerateSuggestions}
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Suggestions...
                    </>
                  ) : (
                    'Generate Report Suggestions'
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
