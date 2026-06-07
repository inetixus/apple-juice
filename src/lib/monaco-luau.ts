import type * as monaco from "monaco-editor";

export const luauConfiguration: monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: "--",
    blockComment: ["--[[", "]]"],
  },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  surroundingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
};

export const luauTokensProvider = {
  defaultToken: "",
  tokenPostfix: ".lua",

  keywords: [
    "and", "break", "do", "else", "elseif",
    "end", "false", "for", "function", "goto", "if",
    "in", "local", "nil", "not", "or",
    "repeat", "return", "then", "true", "until", "while",
    // Luau specifics
    "type", "typeof", "export", "continue"
  ],

  brackets: [
    { token: "delimiter.bracket", open: "{", close: "}" },
    { token: "delimiter.array", open: "[", close: "]" },
    { token: "delimiter.parenthesis", open: "(", close: ")" },
  ],

  operators: [
    "+", "-", "*", "/", "%", "^", "#",
    "==", "~=", "<=", ">=", "<", ">", "=",
    ";", ":", ",", ".", "..", "...",
    "+=", "-=", "*=", "/=", "%=", "^=", "..="
  ],

  symbols: /[=><!~?:&|+\-*\/\^%#]+/,

  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  tokenizer: {
    root: [
      [/[a-zA-Z_]\w*/, {
        cases: {
          "@keywords": "keyword",
          "@default": "identifier"
        }
      }],
      { include: "@whitespace" },
      [/[{}()\[\]]/, "@brackets"],
      [/[;,.]/, "delimiter"],
      [/@symbols/, {
        cases: {
          "@operators": "operator",
          "@default": ""
        }
      }],
      [/\d*\.\d+([eE][\-+]?\d+)?/, "number.float"],
      [/0[xX][0-9a-fA-F]+/, "number.hex"],
      [/\d+/, "number"],
      [/"([^"\\]|\\.)*$/, "string.invalid"],
      [/'([^'\\]|\\.)*$/, "string.invalid"],
      [/"/, "string", "@string_double"],
      [/'/, "string", "@string_single"],
      [/\[([=]*)\[/, "string", "@string_block"],
    ],

    whitespace: [
      [/[ \t\r\n]+/, ""],
      [/--\[([=]*)\[/, "comment", "@comment"],
      [/--.*$/, "comment"],
    ],

    comment: [
      [/[^\]]+/, "comment"],
      [/\]([=]*)\]/, {
        cases: {
          "$1==$S2": { token: "comment", next: "@pop" },
          "@default": "comment"
        }
      } as any],
      [/\]/, "comment"]
    ],

    string_double: [
      [/[^\\"]+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/"/, "string", "@pop"]
    ],

    string_single: [
      [/[^\\']+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/'/, "string", "@pop"]
    ],

    string_block: [
      [/[^\]]+/, "string"],
      [/\]([=]*)\]/, {
        cases: {
          "$1==$S2": { token: "string", next: "@pop" },
          "@default": "string"
        }
      } as any],
      [/\]/, "string"]
    ],
  },
};

export const appleJuiceTheme: monaco.editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "ccff00", fontStyle: "bold" },
    { token: "string", foreground: "10b981" },
    { token: "comment", foreground: "5b6270", fontStyle: "italic" },
    { token: "number", foreground: "fbbf24" },
    { token: "identifier", foreground: "ffffff" },
    { token: "operator", foreground: "888888" },
  ],
  colors: {
    "editor.background": "#0a0a0c",
    "editor.foreground": "#e5e7eb",
    "editor.lineHighlightBackground": "#ffffff05",
    "editorCursor.foreground": "#ccff00",
    "editor.selectionBackground": "#ccff0033",
  },
};
