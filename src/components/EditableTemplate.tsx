"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Copy, Check } from "lucide-react";

interface TemplateVariable {
  key: string;
  defaultValue: string;
  startIndex: number;
  endIndex: number;
  editable: boolean;
}

interface EditableTemplateProps {
  template: string;
  className?: string;
  inputClassName?: string;
  onVariableChange?: (key: string, value: string) => void;
  showCopyButton?: boolean;
}

export default function EditableTemplate({
  template,
  className = "",
  inputClassName = "",
  onVariableChange,
  showCopyButton = true,
}: EditableTemplateProps) {
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const processedTemplate = useRef<string>(template);

  // Parse template variables from the template string
  const parseTemplate = (templateString: string): TemplateVariable[] => {
    const variables: TemplateVariable[] = [];

    // First, parse editable variables from the original template
    const editableRegex = /\{\{([^=}]+)="([^"]*)"\}\}/g;
    let match;

    while ((match = editableRegex.exec(templateString)) !== null) {
      variables.push({
        key: match[1].trim(),
        defaultValue: match[2],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        editable: true,
      });
    }

    // Then handle non-editable variables like {{baseUrl}}
    const nonEditableRegex = /\{\{baseUrl\}\}/g;

    while ((match = nonEditableRegex.exec(templateString)) !== null) {
      const baseUrl =
        typeof window !== "undefined"
          ? `${window.location.protocol}//${window.location.host}`
          : "http://localhost:3000";
      variables.push({
        key: "baseUrl",
        defaultValue: baseUrl,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        editable: false,
      });
    }

    return variables.sort((a, b) => a.startIndex - b.startIndex);
  };

  // Initialize variables from template
  useEffect(() => {
    const templateVars = parseTemplate(template);
    const initialVariables: Record<string, string> = {};

    templateVars.forEach(variable => {
      if (!(variable.key in variables)) {
        initialVariables[variable.key] = variable.defaultValue;
      }
    });

    if (Object.keys(initialVariables).length > 0) {
      setVariables(prev => ({ ...prev, ...initialVariables }));
    }
  }, [template]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingKey && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingKey]);

  const handleVariableClick = (key: string) => {
    setEditingKey(key);
    setTempValue(variables[key] || "");
  };

  const handleVariableBlur = () => {
    if (editingKey) {
      setVariables(prev => ({ ...prev, [editingKey]: tempValue }));
      onVariableChange?.(editingKey, tempValue);
      setEditingKey(null);
    }
  };

  const handleVariableKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setVariables(prev => ({ ...prev, [editingKey!]: tempValue }));
      onVariableChange?.(editingKey!, tempValue);
      setEditingKey(null);
    } else if (e.key === "Escape") {
      setTempValue(variables[editingKey!] || "");
      setEditingKey(null);
    }
  };

  // Get the resolved template with all variables replaced
  const getResolvedTemplate = (): string => {
    const templateVars = parseTemplate(template);
    let resolvedTemplate = template;

    // Replace baseUrl first
    const baseUrlVar = templateVars.find(v => v.key === "baseUrl");
    if (baseUrlVar) {
      resolvedTemplate = resolvedTemplate.replace(`{{baseUrl}}`, baseUrlVar.defaultValue);
    }

    // Replace editable variables
    templateVars.forEach(variable => {
      if (variable.editable) {
        const pattern = `{{${variable.key}="${variable.defaultValue}"}}`;
        const value = variables[variable.key] || variable.defaultValue;
        resolvedTemplate = resolvedTemplate.replace(pattern, value);
      }
    });

    return resolvedTemplate;
  };

  const handleCopy = async () => {
    try {
      const resolvedTemplate = getResolvedTemplate();
      await navigator.clipboard.writeText(resolvedTemplate);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const renderTemplate = () => {
    const templateVars = parseTemplate(template);
    const parts: React.ReactNode[] = [];

    // Step 1: Replace baseUrl first
    let step1Template = template;
    const baseUrlVar = templateVars.find(v => v.key === "baseUrl");
    if (baseUrlVar) {
      step1Template = step1Template.replace(`{{baseUrl}}`, baseUrlVar.defaultValue);
    }

    // Step 2: Process editable variables
    const editableRegex = /\{\{([^=]+)="([^"]*)"\}\}/g;
    const segments: Array<{ type: "text" | "variable"; content: string; variable?: TemplateVariable }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = editableRegex.exec(step1Template)) !== null) {
      // Add text before the variable
      if (match.index > lastIndex) {
        segments.push({
          type: "text",
          content: step1Template.slice(lastIndex, match.index),
        });
      }

      // Add the variable
      const variable = templateVars.find(v => v.editable && v.key === match![1].trim());
      if (variable) {
        segments.push({
          type: "variable",
          content: match[0],
          variable,
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < step1Template.length) {
      segments.push({
        type: "text",
        content: step1Template.slice(lastIndex),
      });
    }

    // Render segments
    segments.forEach((segment, index) => {
      if (segment.type === "text") {
        parts.push(<span key={`text-${index}`}>{segment.content}</span>);
      } else if (segment.type === "variable" && segment.variable) {
        if (editingKey === segment.variable.key) {
          parts.push(
            <input
              key={`input-${segment.variable.key}`}
              ref={inputRef}
              type="text"
              value={tempValue}
              onChange={e => setTempValue(e.target.value)}
              onBlur={handleVariableBlur}
              onKeyDown={handleVariableKeyDown}
              className={`text-white bg-slate-600 border border-sky-400 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-sky-400 ${inputClassName}`}
            />
          );
        } else {
          parts.push(
            <span
              key={`variable-${segment.variable.key}`}
              className="text-sky-500 underline font-bold inline-flex items-center gap-1 decoration-dotted cursor-pointer hover:text-sky-400"
              onClick={() => handleVariableClick(segment.variable!.key)}
            >
              {variables[segment.variable.key] || segment.variable.defaultValue}
              <Pencil className="h-4 w-4" />
            </span>
          );
        }
      }
    });

    return parts;
  };

  return (
    <div className={`relative group ${className}`}>
      {renderTemplate()}
      {showCopyButton && (
        <button
          onClick={handleCopy}
          className="absolute top-0 right-0 p-2 bg-neutral-500 dark:bg-neutral-600 hover:bg-neutral-400 dark:hover:bg-neutral-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
          title="Copy to clipboard"
        >
          {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
