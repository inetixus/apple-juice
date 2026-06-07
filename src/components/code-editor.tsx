"use client";

import { useEffect } from "react";
import Editor, { DiffEditor, useMonaco } from "@monaco-editor/react";
import { luauTokensProvider, luauConfiguration, appleJuiceTheme } from "@/lib/monaco-luau";

export function CodeEditor({
  code,
  language = "luau",
  readOnly = true,
  height = "400px",
  originalCode,
}: {
  code: string;
  language?: string;
  readOnly?: boolean;
  height?: string;
  originalCode?: string;
}) {
  const monaco = useMonaco();

  useEffect(() => {
    if (monaco) {
      if (!monaco.languages.getLanguages().some((l) => l.id === "luau")) {
        monaco.languages.register({ id: "luau" });
        monaco.languages.setMonarchTokensProvider("luau", luauTokensProvider as any);
        monaco.languages.setLanguageConfiguration("luau", luauConfiguration as any);
      }
      monaco.editor.defineTheme("apple-juice-theme", appleJuiceTheme);
      monaco.editor.setTheme("apple-juice-theme");
    }
  }, [monaco]);

  if (originalCode) {
    return (
      <div style={{ height, borderRadius: "0.5rem", overflow: "hidden" }}>
        <DiffEditor
          height={height}
          language={language}
          original={originalCode}
          modified={code}
          theme="apple-juice-theme"
          options={{
            readOnly,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 12,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            renderSideBySide: false, // Inline diff for compactness
            lineNumbersMinChars: 3,
            padding: { top: 12, bottom: 12 }
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ height, borderRadius: "0.5rem", overflow: "hidden" }}>
      <Editor
        height={height}
        language={language}
        value={code}
        theme="apple-juice-theme"
        options={{
          readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 12,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          lineNumbersMinChars: 3,
          padding: { top: 12, bottom: 12 }
        }}
      />
    </div>
  );
}
