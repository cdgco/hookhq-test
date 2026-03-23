"use client";

import { useState, useRef, useEffect } from "react";
import { Copy, Check } from "lucide-react";

interface CopyableCodeProps {
  children: React.ReactNode;
  className?: string;
  copyText?: string;
  showCopyButton?: boolean;
}

export default function CopyableCode({ children, className = "", copyText, showCopyButton = true }: CopyableCodeProps) {
  const [copied, setCopied] = useState(false);
  const [isSingleLine, setIsSingleLine] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkLineCount = () => {
      if (containerRef.current) {
        const element = containerRef.current;
        const lineHeight = parseInt(getComputedStyle(element).lineHeight);
        const height = element.offsetHeight;
        const lineCount = Math.round(height / lineHeight);
        setIsSingleLine(lineCount <= 1);
      }
    };

    checkLineCount();

    // Check again after a short delay to ensure content is rendered
    const timeoutId = setTimeout(checkLineCount, 100);

    return () => clearTimeout(timeoutId);
  }, [children]);

  const handleCopy = async () => {
    try {
      const textToCopy = copyText || (typeof children === "string" ? children : "");
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div ref={containerRef} className={`relative group ${className}`}>
      {children}
      {showCopyButton && (
        <button
          onClick={handleCopy}
          className={`absolute bg-neutral-600 hover:bg-neutral-500 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-sky-400 ${
            isSingleLine ? "top-1 right-1 p-1 rounded-sm" : "top-2 right-2 p-2 rounded-md"
          }`}
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className={`text-green-400 ${isSingleLine ? "h-3 w-3" : "h-4 w-4"}`} />
          ) : (
            <Copy className={isSingleLine ? "h-3 w-3" : "h-4 w-4"} />
          )}
        </button>
      )}
    </div>
  );
}
