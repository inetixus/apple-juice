"use client";

import { Highlight, Prism, themes } from "prism-react-renderer";
import { useEffect, useMemo } from "react";

/**
 * Syntax-highlighted, read-only code viewer with integrated line numbers.
 * Replaces the plain <pre> in the IDE so the editor actually looks like an IDE.
 *
 * prism-react-renderer ships a small language set; Lua is included but Luau
 * (Roblox's dialect) is not. We extend the Lua grammar at runtime with Luau
 * extras (type annotations, continue, compound operators, common Roblox globals)
 * so generated scripts highlight sensibly.
 */

let luauRegistered = false;
function ensureLuau() {
  if (luauRegistered) return;
  luauRegistered = true;
  try {
    const P = Prism as unknown as { languages: Record<string, unknown> };
    if (P.languages.luau) return;

    // prism-react-renderer v2 doesn't bundle Lua, so define a Luau grammar
    // directly. Ordering matters — comments/strings first so keywords inside
    // them aren't mis-tokenized.
    P.languages.luau = {
      comment: [
        { pattern: /--\[(=*)\[[\s\S]*?\]\1\]/, greedy: true }, // block comment
        { pattern: /--.*/, greedy: true }, // line comment
      ],
      string: [
        { pattern: /\[(=*)\[[\s\S]*?\]\1\]/, greedy: true }, // long string
        { pattern: /(["'])(?:\\.|(?!\1)[^\\\r\n])*\1/, greedy: true },
        { pattern: /`(?:\\.|\{[^}]*\}|[^`\\])*`/, greedy: true }, // interpolated
      ],
      "class-name": {
        // Roblox globals / common services + types.
        pattern:
          /\b(?:game|workspace|script|Enum|Instance|Vector3|Vector2|CFrame|UDim2|UDim|Color3|BrickColor|TweenInfo|task|Ray|Region3|NumberSequence|ColorSequence|Random|RaycastParams|number|string|boolean|table|any|nil)\b/,
      },
      keyword:
        /\b(?:and|break|continue|do|else|elseif|end|export|for|function|if|in|local|not|or|repeat|return|then|type|typeof|until|while)\b/,
      boolean: /\b(?:true|false|nil)\b/,
      function: {
        pattern: /(?!\d)\w+(?=\s*(?:[({]|`))/,
      },
      number:
        /\b0x[a-fA-F0-9]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\.\d+/,
      operator:
        /[+\-*/%^#=~<>]=?|\.\.\.?=?|::|[:;.,]|&&|\|\||\bnot\b/,
      punctuation: /[{}[\]()]/,
    };
  } catch {
    /* fall back to plain text */
  }
}

export function CodeViewer({
  code,
  language = "luau",
  className = "",
}: {
  code: string;
  language?: string;
  className?: string;
}) {
  useEffect(() => {
    ensureLuau();
  }, []);

  // Resolve the grammar: luau → plain. ensureLuau registers luau lazily.
  const lang = useMemo(() => {
    ensureLuau();
    const P = Prism as unknown as { languages: Record<string, unknown> };
    if (!P.languages[language]) return "plain";
    return language;
  }, [language]);

  return (
    <Highlight theme={themes.vsDark} code={code} language={lang}>
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={`text-[13px] font-mono leading-[21px] m-0 ${className}`}
          style={{ ...style, background: "transparent" }}
        >
          {tokens.map((line, i) => {
            const lineProps = getLineProps({ line });
            return (
              <div
                key={i}
                {...lineProps}
                className={`table-row ${lineProps.className || ""}`}
              >
                <span className="table-cell pr-4 text-right select-none text-white/15 w-10 tabular-nums">
                  {i + 1}
                </span>
                <span className="table-cell whitespace-pre-wrap break-words">
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </span>
              </div>
            );
          })}
        </pre>
      )}
    </Highlight>
  );
}
