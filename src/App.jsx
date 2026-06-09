import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const STORAGE_KEYS = {
  problems: "problems",
  notes: "notes",
};

const LANGUAGE_OPTIONS = [
  { label: "Java", slug: "java" },
  { label: "Python", slug: "python" },
  { label: "Python3", slug: "python3" },
];
const SOURCE_OPTIONS = [
  { label: "All", value: "all" },
  { label: "LeetCode", value: "leetcode" },
  { label: "Image Upload", value: "image" },
];
const ROUTES = ["track", "search", "topics", "add"];
const REMOVED_DEFAULT_PROBLEM_IDS = new Set([1, 2, 3, 1001]);
const KNOWN_PROBLEM_NUMBERS = {
  "Two Sum": 1,
  "Valid Parentheses": 20,
};

function readStoredValue(key, fallback) {
  try {
    const savedValue = localStorage.getItem(key);
    return savedValue ? JSON.parse(savedValue) : fallback;
  } catch {
    return fallback;
  }
}

function getInitialProblems() {
  const storedProblems = readStoredValue(STORAGE_KEYS.problems, null);
  const startingProblems = Array.isArray(storedProblems) ? storedProblems : [];
  const mergedProblems = startingProblems.filter((problem) => {
    return !REMOVED_DEFAULT_PROBLEM_IDS.has(problem.id);
  });

  return mergedProblems.map(normalizeProblem);
}

function normalizeProblem(problem) {
  const topicTags =
    problem.topicTags?.length > 0
      ? problem.topicTags.map((topic) => {
          return typeof topic === "string" ? topic : topic.name;
        })
      : [problem.topic ?? "General"];
  const normalizedProblem = {
    title: problem.title ?? "",
    description: problem.description ?? "",
    topic: problem.topic ?? topicTags[0] ?? "General",
  };

  return {
    id: problem.id ?? Date.now(),
    number: problem.number ?? KNOWN_PROBLEM_NUMBERS[problem.title] ?? "",
    title: normalizedProblem.title,
    difficulty: problem.difficulty ?? "Easy",
    topic: normalizedProblem.topic,
    topicTags,
    source: problem.source === "image" ? "image" : "leetcode",
    status: problem.status ?? "Not Started",
    description: normalizedProblem.description,
    descriptionHtml: problem.descriptionHtml ?? "",
    exampleTestcases: problem.exampleTestcases ?? "",
    titleSlug: problem.titleSlug ?? "",
    codeTemplates:
      Object.keys(problem.codeTemplates ?? {}).length > 0
        ? problem.codeTemplates
        : getGeneratedCodeTemplates(normalizedProblem),
    language: problem.language ?? "python3",
    lastRunResult: problem.lastRunResult ?? "",
    runFeedback: problem.runFeedback ?? null,
    submissionStatus: problem.submissionStatus ?? "",
    link: problem.link ?? "",
    lastSolvedAt: problem.lastSolvedAt ?? "",
  };
}

function getRouteFromHash() {
  const hashRoute = window.location.hash.replace("#/", "");
  return ROUTES.includes(hashRoute) ? hashRoute : "track";
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getNextProblemId(problems) {
  return (
    Math.max(
      0,
      ...problems.map((problem) => {
        return Number(problem.id) || 0;
      }),
    ) + 1
  );
}

function getTopicNames(problem) {
  return problem.topicTags?.length > 0 ? problem.topicTags : [problem.topic];
}

function getSourceLabel(source) {
  return (
    SOURCE_OPTIONS.find((option) => {
      return option.value === source;
    })?.label ?? "Image Upload"
  );
}

function toFunctionName(title) {
  const words = title
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim()
    .split(/\s+/);

  if (words.length === 0) {
    return "solve";
  }

  return words
    .map((word, index) => {
      const normalizedWord = word.toLowerCase();

      if (index === 0) {
        return normalizedWord;
      }

      return normalizedWord.charAt(0).toUpperCase() + normalizedWord.slice(1);
    })
    .join("");
}

function inferParameterNames(description) {
  const candidates = [
    "nums",
    "target",
    "arr",
    "grid",
    "matrix",
    "s",
    "t",
    "k",
    "x",
    "n",
    "m",
    "prices",
    "intervals",
    "root",
    "head",
  ];
  const foundParameters = candidates.filter((candidate) => {
    return new RegExp(`\\b${candidate}\\b`, "i").test(description);
  });

  return foundParameters.length > 0 ? foundParameters : ["input"];
}

function inferJavaType(parameterName) {
  if (["nums", "arr", "prices"].includes(parameterName)) {
    return "int[]";
  }

  if (["grid", "matrix", "intervals"].includes(parameterName)) {
    return "int[][]";
  }

  if (["s", "t"].includes(parameterName)) {
    return "String";
  }

  if (parameterName === "root") {
    return "TreeNode";
  }

  if (parameterName === "head") {
    return "ListNode";
  }

  if (["target", "k", "x", "n", "m"].includes(parameterName)) {
    return "int";
  }

  return "Object";
}

function inferReturnTypes(description) {
  const normalizedDescription = description.toLowerCase();

  if (
    normalizedDescription.includes("return true") ||
    normalizedDescription.includes("return false") ||
    normalizedDescription.includes("boolean")
  ) {
    return {
      java: "boolean",
      python: "",
    };
  }

  if (
    normalizedDescription.includes("return indices") ||
    normalizedDescription.includes("return the indices") ||
    normalizedDescription.includes("return an array") ||
    normalizedDescription.includes("return a list")
  ) {
    return {
      java: "int[]",
      python: "List[int]",
    };
  }

  if (
    normalizedDescription.includes("return the index") ||
    normalizedDescription.includes("minimum number") ||
    normalizedDescription.includes("maximum number") ||
    normalizedDescription.includes("return -1") ||
    normalizedDescription.includes("return the number")
  ) {
    return {
      java: "int",
      python: "int",
    };
  }

  return {
    java: "Object",
    python: "",
  };
}

function getGeneratedCodeTemplates(problem) {
  const functionName = toFunctionName(problem.title);
  const parameterNames = inferParameterNames(problem.description);
  const returnTypes = inferReturnTypes(problem.description);
  const javaParameters = parameterNames
    .map((parameterName) => {
      return `${inferJavaType(parameterName)} ${parameterName}`;
    })
    .join(", ");
  const pythonParameters = ["self", ...parameterNames].join(", ");
  const python3Return = returnTypes.python ? ` -> ${returnTypes.python}` : "";

  return {
    java: `class Solution {
    public ${returnTypes.java} ${functionName}(${javaParameters}) {
        
    }
}`,
    python: `class Solution(object):
    def ${functionName}(${pythonParameters}):
        """
        :type ${parameterNames[0]}: object
        :rtype: object
        """
        pass`,
    python3: `class Solution:
    def ${functionName}(${pythonParameters})${python3Return}:
        pass`,
  };
}

function getFallbackCode(problem, language) {
  return getGeneratedCodeTemplates(problem)[language];
}

function getNoteKey(problemId, language) {
  return `${problemId}:${language}`;
}

function getProblemDefaultCode(problem) {
  return cleanDefaultCode(
    problem.codeTemplates?.[problem.language] ??
      getFallbackCode(problem, problem.language),
  );
}

function isWrongLanguageTemplate(code, language) {
  if (!code) {
    return false;
  }

  const looksLikeJavaScript =
    code.includes("@param") ||
    /\bvar\s+\w+\s*=\s*function\b/.test(code) ||
    /\bfunction\s+\w+\s*\(/.test(code);

  if (language !== "javascript" && looksLikeJavaScript) {
    return true;
  }

  if (language === "java" && code.includes("def ")) {
    return true;
  }

  if (language.startsWith("python") && code.includes("public ")) {
    return true;
  }

  return false;
}

function getProblemCode(problem, notes) {
  const noteKey = getNoteKey(problem.id, problem.language);
  const savedCode = notes[noteKey];

  if (savedCode && !isWrongLanguageTemplate(savedCode, problem.language)) {
    return savedCode;
  }

  return getProblemDefaultCode(problem);
}

function cleanDefaultCode(code) {
  return code
    .replace(/^\s*\/\/\s*TODO:.*$/gim, "")
    .replace(/^\s*#\s*TODO:.*$/gim, "")
    .replace(/^\s*return\s+(null|-1|false|new int\[0\]);\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n");
}

function getProblemStatus(problem, notes) {
  const code = getProblemCode(problem, notes).trim();
  const defaultCode = getProblemDefaultCode(problem).trim();

  if (problem.submissionStatus === "Accepted") {
    return "Solved";
  }

  if (problem.lastRunResult === "Needs Review") {
    return "Need Review";
  }

  if (code !== "" && code !== defaultCode) {
    return "In Progress";
  }

  return "Not Started";
}

function getStatusClass(status) {
  return status.replace(/\s+/g, "-").toLowerCase();
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlightPlainCode(code, language) {
  const keywords =
    language === "java"
      ? new Set([
          "class",
          "public",
          "private",
          "protected",
          "static",
          "final",
          "void",
          "return",
          "if",
          "else",
          "for",
          "while",
          "do",
          "switch",
          "case",
          "break",
          "continue",
          "new",
          "try",
          "catch",
          "throw",
          "throws",
          "extends",
          "implements",
          "import",
          "package",
          "true",
          "false",
          "null",
        ])
      : new Set([
          "class",
          "def",
          "return",
          "if",
          "elif",
          "else",
          "for",
          "while",
          "in",
          "not",
          "and",
          "or",
          "is",
          "None",
          "True",
          "False",
          "from",
          "import",
          "pass",
          "break",
          "continue",
          "lambda",
          "with",
          "as",
          "try",
          "except",
          "finally",
          "raise",
        ]);
  const types =
    language === "java"
      ? new Set([
          "int",
          "long",
          "double",
          "float",
          "boolean",
          "char",
          "String",
          "Object",
          "List",
          "ArrayList",
          "Map",
          "HashMap",
          "Set",
          "HashSet",
          "TreeNode",
          "ListNode",
        ])
      : new Set([
          "List",
          "Dict",
          "Set",
          "Tuple",
          "Optional",
          "int",
          "str",
          "bool",
          "float",
          "object",
          "self",
        ]);
  const tokenPattern = /\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b/g;
  const parts = [];
  let lastIndex = 0;
  let match = tokenPattern.exec(code);

  while (match) {
    const token = match[0];
    const tokenEnd = match.index + token.length;
    const nextCharacter = code.slice(tokenEnd).trimStart()[0];
    let tokenClass = "";

    parts.push(escapeHtml(code.slice(lastIndex, match.index)));

    if (/^\d/.test(token)) {
      tokenClass = "syntax-number";
    } else if (keywords.has(token)) {
      tokenClass = "syntax-keyword";
    } else if (types.has(token)) {
      tokenClass = "syntax-type";
    } else if (nextCharacter === "(") {
      tokenClass = "syntax-function";
    }

    parts.push(
      tokenClass
        ? `<span class="${tokenClass}">${escapeHtml(token)}</span>`
        : escapeHtml(token),
    );
    lastIndex = tokenEnd;
    match = tokenPattern.exec(code);
  }

  parts.push(escapeHtml(code.slice(lastIndex)));

  return parts.join("");
}

function highlightCode(code, language) {
  const tokenPattern =
    language === "java"
      ? /(\/\/.*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g
      : /(#.*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
  const parts = [];
  let lastIndex = 0;
  let match = tokenPattern.exec(code);

  while (match) {
    parts.push(highlightPlainCode(code.slice(lastIndex, match.index), language));

    const token = match[0];
    const isComment =
      token.startsWith("//") ||
      token.startsWith("/*") ||
      token.startsWith("#");
    parts.push(
      `<span class="${isComment ? "syntax-comment" : "syntax-string"}">${escapeHtml(
        token,
      )}</span>`,
    );
    lastIndex = match.index + token.length;
    match = tokenPattern.exec(code);
  }

  parts.push(highlightPlainCode(code.slice(lastIndex), language));

  return parts.join("") || "\n";
}

function getTemplateParameterNames(code) {
  const pythonMatch = code?.match(/def\s+\w+\(([^)]*)\)/);

  if (pythonMatch) {
    return pythonMatch[1]
      .split(",")
      .map((parameter) => {
        return parameter.trim().split(":")[0].trim();
      })
      .filter((parameter) => {
        return parameter && parameter !== "self";
      });
  }

  const javaMatch = code?.match(/public\s+.+?\s+\w+\(([^)]*)\)/);

  if (!javaMatch) {
    return [];
  }

  return javaMatch[1]
    .split(",")
    .map((parameter) => {
      const parts = parameter.trim().split(/\s+/);
      return parts[parts.length - 1]?.replace("[]", "");
    })
    .filter(Boolean);
}

function getTestcaseParameterNames(problem) {
  const templateNames = [
    getTemplateParameterNames(problem.codeTemplates?.python3),
    getTemplateParameterNames(problem.codeTemplates?.python),
    getTemplateParameterNames(problem.codeTemplates?.java),
  ].find((parameterNames) => {
    return parameterNames.length > 0;
  });

  if (templateNames.length > 0) {
    return templateNames;
  }

  return inferParameterNames(problem.description);
}

function getProblemTestcases(problem) {
  const parameterNames = getTestcaseParameterNames(problem);
  const testcaseLines = problem.exampleTestcases
    ?.split("\n")
    .map((line) => {
      return line.trim();
    })
    .filter(Boolean);

  if (!testcaseLines || testcaseLines.length === 0) {
    return [
      {
        name: "Case 1",
        fields: parameterNames.map((parameterName) => {
          return {
            name: parameterName,
            value: "",
          };
        }),
      },
    ];
  }

  if (parameterNames.length === 0 || testcaseLines.length < parameterNames.length) {
    return [
      {
        name: "Case 1",
        fields: [
          {
            name: "input",
            value: testcaseLines.join("\n"),
          },
        ],
      },
    ];
  }

  const testcases = [];

  for (let index = 0; index < testcaseLines.length; index += parameterNames.length) {
    const testcaseValues = testcaseLines.slice(index, index + parameterNames.length);

    if (testcaseValues.length !== parameterNames.length) {
      break;
    }

    testcases.push({
      name: `Case ${testcases.length + 1}`,
      fields: parameterNames.map((parameterName, parameterIndex) => {
        return {
          name: parameterName,
          value: testcaseValues[parameterIndex],
        };
      }),
    });
  }

  return testcases;
}

function formatCode(code) {
  return code
    .split("\n")
    .map((line) => {
      return line.replace(/\s+$/g, "");
    })
    .join("\n")
    .trimEnd();
}

function getLineIndent(code, cursorIndex) {
  const lineStart = code.lastIndexOf("\n", cursorIndex - 1) + 1;
  const currentLine = code.slice(lineStart, cursorIndex);
  return currentLine.match(/^\s*/)?.[0] ?? "";
}

function hasBalancedDelimiters(code) {
  const pairs = {
    "(": ")",
    "[": "]",
    "{": "}",
  };
  const closingPairs = new Set(Object.values(pairs));
  const stack = [];
  let quote = "";
  let isEscaped = false;

  for (const character of code) {
    if (quote) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === "\\") {
        isEscaped = true;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }

    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }

    if (pairs[character]) {
      stack.push(pairs[character]);
      continue;
    }

    if (closingPairs.has(character) && stack.pop() !== character) {
      return false;
    }
  }

  return stack.length === 0 && !quote;
}

function htmlToPlainText(html = "") {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/pre>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return textarea.value.replace(/\u00a0/g, " ");
}

function getExampleOutputs(problem) {
  const sourceText = htmlToPlainText(
    problem.descriptionHtml || problem.description || "",
  );
  const outputs = [];
  const outputPattern =
    /Output:\s*([\s\S]*?)(?=(?:Explanation:|Example\s+\d|Input:|Constraints|Follow-up|$))/gi;
  let match = outputPattern.exec(sourceText);

  while (match) {
    outputs.push(match[1].trim().replace(/\s+/g, " "));
    match = outputPattern.exec(sourceText);
  }

  return outputs;
}

function normalizeJudgeValue(value) {
  const trimmedValue = String(value ?? "").trim();

  if (
    (trimmedValue.startsWith("\"") && trimmedValue.endsWith("\"")) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    return trimmedValue.slice(1, -1);
  }

  return trimmedValue.replace(/\s+/g, "");
}

function getExpectedOutput(problem, testcase) {
  if (problem.title !== "Count Key Changes") {
    return getExampleOutputs(problem)[Number(testcase.name.replace("Case ", "")) - 1] ?? "";
  }

  const recording = testcase.fields.find((field) => {
    return field.name === "recording";
  })?.value;

  try {
    const letters = JSON.parse(recording);
    return String(
      letters.reduce((changes, letter, index) => {
        if (index === 0) {
          return changes;
        }

        return letters[index - 1].toLowerCase() === letter.toLowerCase()
          ? changes
          : changes + 1;
      }, 0),
    );
  } catch {
    return "";
  }
}

function createRunFeedback(problem, code, testcases, mode, executionResult = null) {
  const defaultCode = getProblemDefaultCode(problem).trim();
  const trimmedCode = code.trim();
  const hasMeaningfulCode = trimmedCode !== "" && trimmedCode !== defaultCode;
  const functionName =
    problem.language === "java"
      ? problem.codeTemplates?.java?.match(/public\s+.+?\s+(\w+)\(/)?.[1]
      : problem.codeTemplates?.[problem.language]?.match(/def\s+(\w+)\(/)?.[1];
  const hasFunctionSignature = functionName ? code.includes(`${functionName}(`) : true;
  const hasBalancedCode = hasBalancedDelimiters(code);

  if (!hasMeaningfulCode) {
    return {
      status: "Needs Review",
      summary: "Write code before running.",
      cases: testcases.map((testcase) => {
        return {
          name: testcase.name,
          status: "Blocked",
          expected: getExpectedOutput(problem, testcase),
          message: "No user code yet.",
        };
      }),
    };
  }

  if (!hasFunctionSignature || !hasBalancedCode) {
    return {
      status: "Needs Review",
      summary: !hasFunctionSignature
        ? "Function signature is missing or renamed."
        : "Check unmatched brackets or quotes before running.",
      cases: testcases.map((testcase) => {
        return {
          name: testcase.name,
          status: "Blocked",
          expected: getExpectedOutput(problem, testcase),
          message: "Static validation failed.",
        };
      }),
    };
  }

  if (!executionResult) {
    return {
      status: "Needs Review",
      summary:
        "A local runner is not available for this problem yet. Java execution currently supports common array, string, boolean, and integer signatures.",
      cases: testcases.map((testcase) => {
        return {
          name: testcase.name,
          status: "Blocked",
          input: testcase.fields,
          expected: getExpectedOutput(problem, testcase),
          actual: "",
          message: "Runner not available.",
        };
      }),
    };
  }

  if (executionResult.status !== "Ran") {
    return {
      status: executionResult.status,
      summary: executionResult.summary,
      cases: testcases.map((testcase) => {
        return {
          name: testcase.name,
          status: "Blocked",
          input: testcase.fields,
          expected: getExpectedOutput(problem, testcase),
          actual: executionResult.stderr ?? "",
          message: "Code did not finish running.",
        };
      }),
    };
  }

  const cases = testcases.map((testcase, index) => {
    const output = executionResult.outputs.find((candidate) => {
      return candidate.index === index;
    })?.output;
    const expected = getExpectedOutput(problem, testcase);
    const hasExpected = expected !== "";
    const passed = hasExpected
      ? normalizeJudgeValue(output) === normalizeJudgeValue(expected)
      : false;

    return {
      name: testcase.name,
      status: hasExpected ? (passed ? "Accepted" : "Wrong Answer") : "Ran",
      input: testcase.fields,
      expected,
      actual: output ?? "No output",
      message: hasExpected
        ? passed
          ? "Output matched expected result."
          : "Output differed."
        : "No expected output was found for this case.",
    };
  });
  const allPassed = cases.every((testcase) => {
    return testcase.status === "Accepted";
  });
  const hasComparableCases = cases.every((testcase) => {
    return testcase.expected !== "";
  });

  return {
    status: hasComparableCases
      ? allPassed
        ? mode === "submit"
          ? "Accepted"
          : "Checked"
        : "Wrong Answer"
      : "Ran",
    summary:
      hasComparableCases && allPassed
        ? `Passed ${cases.length} local testcase${cases.length === 1 ? "" : "s"}.`
        : hasComparableCases
          ? "One or more local testcases failed."
          : "Code ran locally. Add expected outputs to enable pass/fail judging.",
    cases,
  };
}

function App() {
  const problemMenuRef = useRef(null);
  const topicsMenuRef = useRef(null);
  const codeHighlightRef = useRef(null);
  const codeLineNumbersRef = useRef(null);
  const editorColumnRef = useRef(null);
  const [activePage, setActivePage] = useState(getRouteFromHash);
  const [problems, setProblems] = useState(() => {
    return getInitialProblems();
  });
  const [notes, setNotes] = useState(() => {
    return readStoredValue(STORAGE_KEYS.notes, {});
  });
  const [selectedProblemId, setSelectedProblemId] = useState(() => {
    return problems[0]?.id ?? null;
  });
  const [isProblemMenuOpen, setIsProblemMenuOpen] = useState(false);
  const [isTopicsMenuOpen, setIsTopicsMenuOpen] = useState(false);
  const [activeInfoTab, setActiveInfoTab] = useState("description");
  const [activeTestTab, setActiveTestTab] = useState("testcase");
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);
  const [testPanelHeight, setTestPanelHeight] = useState(220);

  const [searchText, setSearchText] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("All");
  const [selectedSource, setSelectedSource] = useState("all");
  const [importQuery, setImportQuery] = useState("");
  const [importStatus, setImportStatus] = useState("idle");
  const [importMessage, setImportMessage] = useState("");

  useEffect(() => {
    function handleHashChange() {
      setActivePage(getRouteFromHash());
    }

    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("popstate", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("popstate", handleHashChange);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.problems, JSON.stringify(problems));
  }, [problems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    function handleOutsidePointerDown(event) {
      const target = event.target;
      const clickedProblemMenu = problemMenuRef.current?.contains(target);
      const clickedTopicsMenu = topicsMenuRef.current?.contains(target);

      if (!clickedProblemMenu) {
        setIsProblemMenuOpen(false);
      }

      if (!clickedTopicsMenu) {
        setIsTopicsMenuOpen(false);
      }
    }

    function handleEscapeKey(event) {
      if (event.key === "Escape") {
        setIsProblemMenuOpen(false);
        setIsTopicsMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, []);

  const selectedProblem = problems.find((problem) => {
    return problem.id === selectedProblemId;
  });
  const selectedCode = selectedProblem
    ? getProblemCode(selectedProblem, notes)
    : "";
  const highlightedCode = selectedProblem
    ? highlightCode(selectedCode, selectedProblem.language)
    : "";
  const codeLineNumbers = selectedCode.split("\n").map((_, index) => {
    return index + 1;
  });
  const selectedStatus = selectedProblem
    ? getProblemStatus(selectedProblem, notes)
    : "Not Started";
  const selectedTestcases = selectedProblem ? getProblemTestcases(selectedProblem) : [];
  const activeTestcase =
    selectedTestcases[Math.min(activeCaseIndex, selectedTestcases.length - 1)] ??
    selectedTestcases[0];

  const topics = useMemo(() => {
    const topicMap = new Map();

    problems.forEach((problem) => {
      getTopicNames(problem).forEach((topic) => {
        const currentCount = topicMap.get(topic) ?? 0;
        topicMap.set(topic, currentCount + 1);
      });
    });

    return Array.from(topicMap.entries())
      .map(([name, count]) => {
        return { name, count };
      })
      .sort((firstTopic, secondTopic) => {
        return firstTopic.name.localeCompare(secondTopic.name);
      });
  }, [problems]);

  const visibleProblems = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return problems
      .filter((problem) => {
        const problemSource = problem.source ?? "manual";
        const matchesSearch =
          normalizedSearch === "" ||
          problem.title.toLowerCase().includes(normalizedSearch) ||
          String(problem.number).includes(normalizedSearch) ||
          getTopicNames(problem).join(" ").toLowerCase().includes(normalizedSearch) ||
          problem.description.toLowerCase().includes(normalizedSearch) ||
          problemSource.toLowerCase().includes(normalizedSearch);
        const matchesTopic =
          selectedTopic === "All" || getTopicNames(problem).includes(selectedTopic);
        const matchesSource =
          selectedSource === "all" || problemSource === selectedSource;

        if (activePage === "topics") {
          return matchesTopic && matchesSource;
        }

        if (activePage === "search") {
          return matchesSearch && matchesSource;
        }

        return matchesSearch && matchesTopic && matchesSource;
      })
      .sort((firstProblem, secondProblem) => {
        const firstNumber = Number(firstProblem.number);
        const secondNumber = Number(secondProblem.number);

        if (Number.isNaN(firstNumber) || Number.isNaN(secondNumber)) {
          return firstProblem.title.localeCompare(secondProblem.title);
        }

        return firstNumber - secondNumber;
      });
  }, [activePage, problems, searchText, selectedSource, selectedTopic]);

  function navigateTo(page) {
    window.history.pushState(null, "", `#/${page}`);
    setActivePage(page);
  }

  function updateSelectedProblem(field, value) {
    if (!selectedProblem) {
      return;
    }

    setProblems((currentProblems) => {
      return currentProblems.map((problem) => {
        if (problem.id !== selectedProblemId) {
          return problem;
        }

        if (typeof field === "object") {
          return {
            ...problem,
            ...field,
          };
        }

        return {
          ...problem,
          [field]: value,
        };
      });
    });
  }

  function handleNoteChange(event) {
    if (!selectedProblem) {
      return;
    }

    updateSelectedCode(event.target.value);
  }

  function updateSelectedCode(nextCode) {
    if (!selectedProblem) {
      return;
    }

    setNotes((currentNotes) => {
      return {
        ...currentNotes,
        [getNoteKey(selectedProblemId, selectedProblem.language)]: nextCode,
      };
    });

    updateSelectedProblem({
      submissionStatus: "",
      runFeedback: null,
      lastRunResult: "",
    });
  }

  function handleCodeKeyDown(event) {
    const textarea = event.currentTarget;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const selectedText = selectedCode.slice(selectionStart, selectionEnd);

    function applyCodeEdit(nextCode, nextSelectionStart, nextSelectionEnd) {
      updateSelectedCode(nextCode);
      requestAnimationFrame(() => {
        textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
      });
    }

    if (event.key === "Tab") {
      event.preventDefault();

      const indentation = "    ";

      if (selectionStart !== selectionEnd) {
        const lineStart = selectedCode.lastIndexOf("\n", selectionStart - 1) + 1;
        const selectedBlock = selectedCode.slice(lineStart, selectionEnd);

        if (event.shiftKey) {
          const outdentedBlock = selectedBlock.replace(/^ {1,4}/gm, "");
          const removedCharacters = selectedBlock.length - outdentedBlock.length;
          applyCodeEdit(
            `${selectedCode.slice(0, lineStart)}${outdentedBlock}${selectedCode.slice(
              selectionEnd,
            )}`,
            Math.max(lineStart, selectionStart - indentation.length),
            Math.max(lineStart, selectionEnd - removedCharacters),
          );
          return;
        }

        const indentedBlock = selectedBlock.replace(/^/gm, indentation);
        const addedLines = selectedBlock.split("\n").length;
        applyCodeEdit(
          `${selectedCode.slice(0, lineStart)}${indentedBlock}${selectedCode.slice(
            selectionEnd,
          )}`,
          selectionStart + indentation.length,
          selectionEnd + addedLines * indentation.length,
        );
        return;
      }

      if (event.shiftKey) {
        return;
      }

      applyCodeEdit(
        `${selectedCode.slice(0, selectionStart)}${indentation}${selectedCode.slice(
          selectionEnd,
        )}`,
        selectionStart + indentation.length,
        selectionStart + indentation.length,
      );
      return;
    }

    const pairs = {
      "(": ")",
      "[": "]",
      "{": "}",
      "\"": "\"",
      "'": "'",
    };
    const closingCharacters = new Set(Object.values(pairs));

    if (pairs[event.key]) {
      event.preventDefault();

      const closingCharacter = pairs[event.key];

      if (
        selectionStart === selectionEnd &&
        (event.key === "\"" || event.key === "'") &&
        selectedCode[selectionStart] === closingCharacter
      ) {
        applyCodeEdit(selectedCode, selectionStart + 1, selectionStart + 1);
        return;
      }

      applyCodeEdit(
        `${selectedCode.slice(0, selectionStart)}${event.key}${selectedText}${closingCharacter}${selectedCode.slice(
          selectionEnd,
        )}`,
        selectionStart + 1,
        selectionEnd + 1,
      );
      return;
    }

    if (
      closingCharacters.has(event.key) &&
      selectionStart === selectionEnd &&
      selectedCode[selectionStart] === event.key
    ) {
      event.preventDefault();
      applyCodeEdit(selectedCode, selectionStart + 1, selectionStart + 1);
      return;
    }

    if (event.key === "Backspace" && selectionStart === selectionEnd) {
      const previousCharacter = selectedCode[selectionStart - 1];
      const nextCharacter = selectedCode[selectionStart];

      if (pairs[previousCharacter] === nextCharacter) {
        event.preventDefault();
        applyCodeEdit(
          `${selectedCode.slice(0, selectionStart - 1)}${selectedCode.slice(
            selectionStart + 1,
          )}`,
          selectionStart - 1,
          selectionStart - 1,
        );
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      const indentation = getLineIndent(selectedCode, selectionStart);
      const previousCharacter = selectedCode[selectionStart - 1];
      const nextCharacter = selectedCode[selectionStart];

      if (previousCharacter === "{" && nextCharacter === "}") {
        const innerIndentation = `${indentation}    `;
        const insertion = `\n${innerIndentation}\n${indentation}`;
        applyCodeEdit(
          `${selectedCode.slice(0, selectionStart)}${insertion}${selectedCode.slice(
            selectionEnd,
          )}`,
          selectionStart + innerIndentation.length + 1,
          selectionStart + innerIndentation.length + 1,
        );
        return;
      }

      const insertion = `\n${indentation}`;
      applyCodeEdit(
        `${selectedCode.slice(0, selectionStart)}${insertion}${selectedCode.slice(
          selectionEnd,
        )}`,
        selectionStart + insertion.length,
        selectionStart + insertion.length,
      );
    }
  }

  function handleCodeScroll(event) {
    if (codeHighlightRef.current) {
      codeHighlightRef.current.scrollTop = event.currentTarget.scrollTop;
      codeHighlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }

    if (codeLineNumbersRef.current) {
      codeLineNumbersRef.current.scrollTop = event.currentTarget.scrollTop;
    }
  }

  function handleTestPanelResizeStart(event) {
    event.preventDefault();
    const editorColumn = editorColumnRef.current;

    if (!editorColumn) {
      return;
    }

    const editorBounds = editorColumn.getBoundingClientRect();

    function handlePointerMove(pointerEvent) {
      const nextHeight = editorBounds.bottom - pointerEvent.clientY;
      const maxHeight = Math.max(180, editorBounds.height - 220);
      setTestPanelHeight(Math.min(Math.max(nextHeight, 150), maxHeight));
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handleLanguageChange(language) {
    updateSelectedProblem("language", language);
  }

  async function runSelectedCode(mode) {
    if (!selectedProblem) {
      return null;
    }

    const supportsLocalJavaRunner = selectedProblem.language === "java";

    if (!supportsLocalJavaRunner) {
      return null;
    }

    const response = await fetch("/api/run/java", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: selectedCode,
        testcases: selectedTestcases,
        mode,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => {
        return {};
      });
      return {
        status: "Runtime Error",
        summary: payload.error ?? "Unable to run code locally.",
        outputs: [],
      };
    }

    return response.json();
  }

  async function handleRunCode() {
    if (!selectedProblem) {
      return;
    }

    const hasMeaningfulCode =
      selectedCode.trim() !== "" &&
      selectedCode.trim() !== getProblemDefaultCode(selectedProblem).trim();
    const executionResult = hasMeaningfulCode
      ? await runSelectedCode("run")
      : null;
    const feedback = createRunFeedback(
      selectedProblem,
      selectedCode,
      selectedTestcases,
      "run",
      executionResult,
    );

    updateSelectedProblem({
      lastRunResult: hasMeaningfulCode ? feedback.status : "Needs Review",
      runFeedback: feedback,
    });
    setActiveTestTab("result");
  }

  async function handleSubmitCode() {
    if (!selectedProblem) {
      return;
    }

    const hasMeaningfulCode =
      selectedCode.trim() !== "" &&
      selectedCode.trim() !== getProblemDefaultCode(selectedProblem).trim();
    const executionResult = hasMeaningfulCode
      ? await runSelectedCode("submit")
      : null;
    const feedback = createRunFeedback(
      selectedProblem,
      selectedCode,
      selectedTestcases,
      "submit",
      executionResult,
    );
    const isAccepted = hasMeaningfulCode && feedback.status === "Accepted";

    setProblems((currentProblems) => {
      return currentProblems.map((problem) => {
        if (problem.id !== selectedProblemId) {
          return problem;
        }

        return {
          ...problem,
          lastRunResult: feedback.status,
          runFeedback: feedback,
          submissionStatus: isAccepted ? "Accepted" : "",
          lastSolvedAt: isAccepted ? getToday() : problem.lastSolvedAt,
        };
      });
    });
    setActiveTestTab("result");
  }

  function handleResetCode() {
    if (!selectedProblem) {
      return;
    }

    setNotes({
      ...notes,
      [getNoteKey(selectedProblemId, selectedProblem.language)]:
        getProblemDefaultCode(selectedProblem),
    });

    setProblems((currentProblems) => {
      return currentProblems.map((problem) => {
        if (problem.id !== selectedProblemId) {
          return problem;
        }

        return {
          ...problem,
          lastRunResult: "",
          runFeedback: null,
          submissionStatus: "",
        };
      });
    });
  }

  function handleFormatCode() {
    if (!selectedProblem) {
      return;
    }

    setNotes({
      ...notes,
      [getNoteKey(selectedProblemId, selectedProblem.language)]: formatCode(
        selectedCode,
      ),
    });
  }

  async function handleImportProblem(event) {
    event.preventDefault();

    const query = importQuery.trim();

    if (query === "" || !/^\d+$/.test(query)) {
      setImportStatus("error");
      setImportMessage("Enter a LeetCode problem number.");
      return;
    }

    setImportStatus("loading");
    setImportMessage("");

    try {
      const response = await fetch(
        `/api/leetcode/problem?query=${encodeURIComponent(query)}`,
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to import this problem.");
      }

      const importedTopicTags =
        payload.topicTags?.map((topic) => {
          return topic.name;
        }) ?? [];
      const importedBaseProblem = {
        title: payload.title,
        description: payload.description,
        topic: importedTopicTags[0] ?? "General",
      };
      const importedCodeTemplates = {
        ...getGeneratedCodeTemplates(importedBaseProblem),
        ...Object.fromEntries(
          (payload.codeSnippets ?? [])
            .filter((snippet) => {
              return ["java", "python", "python3"].includes(snippet.langSlug);
            })
            .map((snippet) => {
              return [snippet.langSlug, snippet.code];
            }),
        ),
      };
      const importedProblem = {
        id: getNextProblemId(problems),
        number: payload.questionFrontendId,
        title: payload.title,
        difficulty: payload.difficulty,
        topic: importedBaseProblem.topic,
        topicTags: importedTopicTags,
        source: "leetcode",
        status: "Not Started",
        description: payload.description,
        descriptionHtml: payload.content,
        exampleTestcases: payload.exampleTestcases || payload.sampleTestCase || "",
        titleSlug: payload.titleSlug,
        codeTemplates: importedCodeTemplates,
        language: "python3",
        lastRunResult: "",
        submissionStatus: "",
        link: `https://leetcode.com/problems/${payload.titleSlug}/`,
        lastSolvedAt: "",
      };
      const initialCode =
        payload.codeSnippets?.find((snippet) => {
          return snippet.langSlug === "python3";
        })?.code ??
        payload.codeSnippets?.find((snippet) => {
          return snippet.langSlug === "python";
        })?.code ??
        "";

      setProblems((currentProblems) => {
        return [...currentProblems, importedProblem];
      });

      if (initialCode) {
        setNotes((currentNotes) => {
          return {
            ...currentNotes,
            [getNoteKey(importedProblem.id, importedProblem.language)]: initialCode,
          };
        });
      }

      setSelectedProblemId(importedProblem.id);
      setActiveCaseIndex(0);
      setActiveTestTab("testcase");
      setSelectedTopic("All");
      setImportQuery("");
      setImportStatus("success");
      setImportMessage(`Imported ${importedProblem.number}. ${importedProblem.title}`);
      navigateTo("track");
    } catch (error) {
      setImportStatus("error");
      setImportMessage(error.message);
    }
  }

  function handleSearchChange(event) {
    setSearchText(event.target.value);

    if (activePage !== "search") {
      navigateTo("search");
    }
  }

  function handleTopicClick(topicName) {
    setSelectedTopic(topicName);
    setIsTopicsMenuOpen(false);
    navigateTo("track");
  }

  function handleProblemSelect(problemId) {
    setSelectedProblemId(problemId);
    setActiveCaseIndex(0);
    setActiveTestTab("testcase");
    setIsProblemMenuOpen(false);
    navigateTo("track");
  }

  return (
    <main className="app-shell">
      <header className="top-nav">
        <div className="nav-left">
          <button
            className="brand-mark"
            type="button"
            aria-label="Home"
            onClick={() => {
              navigateTo("track");
            }}
          >
            LC
          </button>

          <div className="problem-menu-wrap" ref={problemMenuRef}>
            <button
              className={
                isProblemMenuOpen
                  ? "problem-menu-button active"
                  : "problem-menu-button"
              }
              type="button"
              aria-expanded={isProblemMenuOpen}
              onClick={() => {
                setIsProblemMenuOpen(!isProblemMenuOpen);
                setIsTopicsMenuOpen(false);
              }}
            >
              <span className="hamburger-icon" aria-hidden="true" />
              Problem List
            </button>

            {isProblemMenuOpen ? (
              <div className="problem-menu" role="menu">
                <label className="menu-search-box">
                  <span className="search-icon" aria-hidden="true" />
                  <input
                    aria-label="Search problems"
                    placeholder="Search"
                    value={searchText}
                    onChange={handleSearchChange}
                  />
                </label>

                <div className="source-filter" aria-label="Problem source">
                  {SOURCE_OPTIONS.map((sourceOption) => {
                    return (
                      <button
                        key={sourceOption.value}
                        className={
                          selectedSource === sourceOption.value
                            ? "source-filter-button active"
                            : "source-filter-button"
                        }
                        type="button"
                        onClick={() => {
                          setSelectedSource(sourceOption.value);
                        }}
                      >
                        {sourceOption.label}
                      </button>
                    );
                  })}
                </div>

                <div className="problem-menu-header">
                  <span>#</span>
                  <span>Title</span>
                  <span>Difficulty</span>
                  <span>Topic</span>
                </div>

                <div className="problem-menu-list">
                  {visibleProblems.length === 0 ? (
                    <p className="empty-text">No problems found.</p>
                  ) : (
                    visibleProblems.map((problem) => {
                      return (
                        <button
                          key={problem.id}
                          className={
                            problem.id === selectedProblemId
                              ? "problem-menu-row active"
                              : "problem-menu-row"
                          }
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            handleProblemSelect(problem.id);
                          }}
                        >
                          <span>{problem.number || problem.id}</span>
                          <strong>
                            {problem.title}
                            <small>{getSourceLabel(problem.source)}</small>
                          </strong>
                          <span className={`difficulty-pill ${problem.difficulty}`}>
                            {problem.difficulty}
                          </span>
                          <span className="topic-cell">
                            {getTopicNames(problem).join(", ")}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {selectedProblem ? (
          <div className="top-run-actions">
            <button
              className="play-button"
              type="button"
              aria-label="Run Code"
              title="Run Code"
              onClick={handleRunCode}
            >
              <span className="play-icon" aria-hidden="true" />
            </button>
            <button className="primary-button" type="button" onClick={handleSubmitCode}>
              Submit
            </button>
          </div>
        ) : null}

        <nav className="nav-actions" aria-label="Primary">
          <button
            className={activePage === "track" ? "text-button active" : "text-button"}
            type="button"
            onClick={() => {
              setSelectedTopic("All");
              navigateTo("track");
            }}
          >
            Track
          </button>

          <div className="topics-menu-wrap" ref={topicsMenuRef}>
            <button
              className={
                isTopicsMenuOpen || selectedTopic !== "All"
                  ? "text-button active"
                  : "text-button"
              }
              type="button"
              aria-expanded={isTopicsMenuOpen}
              onClick={() => {
                setIsTopicsMenuOpen(!isTopicsMenuOpen);
                setIsProblemMenuOpen(false);
              }}
            >
              Topics
            </button>

            {isTopicsMenuOpen ? (
              <div className="topics-menu">
                <button
                  className={
                    selectedTopic === "All"
                      ? "topic-menu-item active"
                      : "topic-menu-item"
                  }
                  type="button"
                  onClick={() => {
                    handleTopicClick("All");
                  }}
                >
                  <span>All</span>
                  <small>{problems.length}</small>
                </button>

                {topics.map((topic) => {
                  return (
                    <button
                      key={topic.name}
                      className={
                        selectedTopic === topic.name
                          ? "topic-menu-item active"
                          : "topic-menu-item"
                      }
                      type="button"
                      onClick={() => {
                        handleTopicClick(topic.name);
                      }}
                    >
                      <span>{topic.name}</span>
                      <small>{topic.count}</small>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <button
            className={activePage === "add" ? "text-button active" : "text-button"}
            type="button"
            onClick={() => {
              navigateTo("add");
            }}
          >
            Add Problems
          </button>
        </nav>
      </header>

      <section className="page-body">
        {activePage === "add" ? (
          <section className="add-page">
            <div className="page-heading">
              <p className="eyebrow">Backlog</p>
              <h1>Add Problems</h1>
            </div>

            <form className="import-panel panel" onSubmit={handleImportProblem}>
              <div>
                <p className="eyebrow">LeetCode Import</p>
                <h2>Import by problem number</h2>
              </div>

              <div className="import-row">
                <input
                  aria-label="LeetCode problem number"
                  inputMode="numeric"
                  placeholder="704"
                  value={importQuery}
                  onChange={(event) => {
                    setImportQuery(event.target.value);
                  }}
                />
                <button
                  className="primary-button"
                  type="submit"
                  disabled={importStatus === "loading"}
                >
                  {importStatus === "loading" ? "Importing..." : "Import"}
                </button>
              </div>

              {importMessage ? (
                <p
                  className={
                    importStatus === "error"
                      ? "import-message error"
                      : "import-message"
                  }
                >
                  {importMessage}
                </p>
              ) : null}
            </form>

            <section className="import-panel panel">
              <div>
                <p className="eyebrow">Image Upload</p>
                <h2>Upload screenshots to create a problem</h2>
              </div>

              <div className="image-import-placeholder">
                <span>Coming next</span>
                <p>
                  This source will be used for problems parsed from screenshots.
                </p>
              </div>
            </section>

          </section>
        ) : (
          <>
            <section className="solver-layout">
              <section className="description-pane">
                {selectedProblem ? (
                  <>
                    <div className="description-tabs">
                      <button
                        className={
                          activeInfoTab === "description" ? "tab active" : "tab"
                        }
                        type="button"
                        onClick={() => {
                          setActiveInfoTab("description");
                        }}
                      >
                        Description
                      </button>
                      <button
                        className={
                          activeInfoTab === "submissions" ? "tab active" : "tab"
                        }
                        type="button"
                        onClick={() => {
                          setActiveInfoTab("submissions");
                        }}
                      >
                        Submissions
                      </button>
                    </div>

                    <article className="problem-description">
                      {activeInfoTab === "description" ? (
                        <>
                          <div>
                            <div className="description-heading">
                              <h1>
                                {selectedProblem.number || selectedProblem.id}.{" "}
                                {selectedProblem.title}
                              </h1>
                              {selectedStatus === "Solved" ? (
                                <span
                                  className={`status-chip ${getStatusClass(
                                    selectedStatus,
                                  )}`}
                                >
                                  {selectedStatus}
                                </span>
                              ) : null}
                            </div>

                            <div className="description-tags">
                              <span
                                className={`difficulty-pill ${selectedProblem.difficulty}`}
                              >
                                {selectedProblem.difficulty}
                              </span>
                              {getTopicNames(selectedProblem).map((topic) => {
                                return (
                                  <span className="description-tag" key={topic}>
                                    {topic}
                                  </span>
                                );
                              })}
                              <span className="description-tag">
                                {getSourceLabel(selectedProblem.source)}
                              </span>
                              {selectedProblem.link ? (
                                <a
                                  className="description-tag"
                                  href={selectedProblem.link}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  LeetCode
                                </a>
                              ) : null}
                            </div>
                          </div>

                          {selectedProblem.descriptionHtml ? (
                            <div
                              className="leetcode-content"
                              dangerouslySetInnerHTML={{
                                __html: selectedProblem.descriptionHtml,
                              }}
                            />
                          ) : (
                            <p>{selectedProblem.description}</p>
                          )}

                          <section className="example-block">
                            <h2>Example Testcases</h2>
                            <pre>
                              {selectedProblem.exampleTestcases ||
                                `Input: your test case here
Output: expected result here`}
                            </pre>
                          </section>
                        </>
                      ) : (
                        <section className="submission-panel">
                          <h2>Submission Status</h2>
                          <div className="submission-row">
                            <span>Status</span>
                            <strong>{selectedStatus}</strong>
                          </div>
                          <div className="submission-row">
                            <span>Last run</span>
                            <strong>
                              {selectedProblem.lastRunResult || "No runs yet"}
                            </strong>
                          </div>
                          <div className="submission-row">
                            <span>Submitted</span>
                            <strong>
                              {selectedProblem.submissionStatus || "Not submitted"}
                            </strong>
                          </div>
                          <div className="submission-row">
                            <span>Last solved</span>
                            <strong>{selectedProblem.lastSolvedAt || "Not yet"}</strong>
                          </div>
                        </section>
                      )}
                    </article>
                  </>
                ) : (
                  <div className="empty-code">
                    <p>No problem selected.</p>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => {
                        navigateTo("add");
                      }}
                    >
                      Add problem
                    </button>
                  </div>
                )}
              </section>

              <section
                className="editor-column"
                ref={editorColumnRef}
                style={{
                  gridTemplateRows: `minmax(0, 1fr) 8px ${testPanelHeight}px`,
                }}
              >
                {selectedProblem ? (
                  <>
                    <section className="code-pane">
                      <div className="code-toolbar">
                        <span className="code-tab-label">Code</span>
                      </div>

                      <div className="language-bar">
                        <select
                          aria-label="Language"
                          className="language-select"
                          value={selectedProblem.language}
                          onChange={(event) => {
                            handleLanguageChange(event.target.value);
                          }}
                        >
                          {LANGUAGE_OPTIONS.map((language) => {
                            return (
                              <option key={language.slug} value={language.slug}>
                                {language.label}
                              </option>
                            );
                          })}
                        </select>
                        <div className="language-tools">
                          <button
                            className="editor-icon-button"
                            type="button"
                            aria-label="Format code"
                            title="Format code"
                            onClick={handleFormatCode}
                          >
                            <svg
                              className="toolbar-svg-icon"
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                            >
                              <path d="M4 6h16" />
                              <path d="M4 12h16" />
                              <path d="M4 18h11" />
                            </svg>
                          </button>
                          <button
                            className="editor-icon-button"
                            type="button"
                            aria-label="Reset code"
                            title="Reset code"
                            onClick={handleResetCode}
                          >
                            <svg
                              className="toolbar-svg-icon"
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                            >
                              <path d="M9 4 4 9l5 5" />
                              <path d="M4 9h10a6 6 0 0 1 0 12h-1" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="code-editor-shell">
                        <div
                          className="code-line-numbers"
                          ref={codeLineNumbersRef}
                          aria-hidden="true"
                        >
                          {codeLineNumbers.map((lineNumber) => {
                            return <span key={lineNumber}>{lineNumber}</span>;
                          })}
                        </div>
                        <pre
                          className="code-highlight"
                          ref={codeHighlightRef}
                          aria-hidden="true"
                        >
                          <code
                            dangerouslySetInnerHTML={{
                              __html: highlightedCode,
                            }}
                          />
                        </pre>
                        <textarea
                          className="code-editor"
                          value={selectedCode}
                          onChange={handleNoteChange}
                          onKeyDown={handleCodeKeyDown}
                          onScroll={handleCodeScroll}
                          spellCheck="false"
                          autoCapitalize="off"
                          autoComplete="off"
                          wrap="off"
                          placeholder="Write code, pseudocode, edge cases, time complexity, and review notes here..."
                        />
                      </div>

                    </section>

                    <button
                      className="panel-resizer"
                      type="button"
                      aria-label="Resize test panel"
                      onPointerDown={handleTestPanelResizeStart}
                    />

                    <section className="test-pane">
                      <div className="test-tabs">
                        <button
                          className={activeTestTab === "testcase" ? "tab active" : "tab"}
                          type="button"
                          onClick={() => {
                            setActiveTestTab("testcase");
                          }}
                        >
                          <svg
                            className="test-tab-icon"
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                          >
                            <path d="M5 12.5 9 16.5 19 6.5" />
                          </svg>
                          Testcase
                        </button>
                        <button
                          className={activeTestTab === "result" ? "tab active" : "tab"}
                          type="button"
                          onClick={() => {
                            setActiveTestTab("result");
                          }}
                        >
                          <svg
                            className="test-tab-icon result"
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                          >
                            <path d="m8 5 7 7-7 7" />
                            <path d="M15 19h5" />
                          </svg>
                          Test Result
                        </button>
                      </div>
                      {activeTestTab === "testcase" ? (
                        <div className="testcase-content">
                          <div className="case-tabs" aria-label="Test cases">
                            {selectedTestcases.map((testcase, testcaseIndex) => {
                              return (
                                <button
                                  key={testcase.name}
                                  className={
                                    testcaseIndex === activeCaseIndex
                                      ? "case-tab active"
                                      : "case-tab"
                                  }
                                  type="button"
                                  onClick={() => {
                                    setActiveCaseIndex(testcaseIndex);
                                  }}
                                >
                                  {testcase.name}
                                </button>
                              );
                            })}
                            <button
                              className="case-add-button"
                              type="button"
                              aria-label="Add testcase"
                            >
                              +
                            </button>
                          </div>

                          <div className="case-fields">
                            {activeTestcase?.fields.map((field) => {
                              return (
                                <label className="case-field" key={field.name}>
                                  <span>{field.name} =</span>
                                  <textarea readOnly value={field.value} />
                                </label>
                              );
                            })}
                          </div>

                          <div className="case-source">
                            <svg
                              className="source-icon"
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                            >
                              <path d="m9 18-6-6 6-6" />
                              <path d="m15 6 6 6-6 6" />
                              <path d="m14 4-4 16" />
                            </svg>
                            Source
                          </div>
                        </div>
                      ) : (
                        <div className="test-result-content">
                          {selectedProblem.runFeedback ? (
                            <>
                              <div
                                className={`result-summary ${getStatusClass(
                                  selectedProblem.runFeedback.status,
                                )}`}
                              >
                                <span>{selectedProblem.runFeedback.status}</span>
                                <p>{selectedProblem.runFeedback.summary}</p>
                              </div>

                              <div className="result-case-list">
                                {selectedProblem.runFeedback.cases.map((testcase) => {
                                  return (
                                    <details
                                      className={`result-case ${getStatusClass(
                                        testcase.status,
                                      )}`}
                                      key={testcase.name}
                                    >
                                      <summary>
                                        <div>
                                          <span>{testcase.name}</span>
                                          <small>{testcase.message}</small>
                                        </div>
                                        <code>{testcase.status}</code>
                                      </summary>

                                      <div className="result-case-detail">
                                        <div>
                                          <span>Input</span>
                                          <pre>
                                            {testcase.input
                                              ?.map((field) => {
                                                return `${field.name} = ${field.value}`;
                                              })
                                              .join("\n") || "No input"}
                                          </pre>
                                        </div>
                                        <div>
                                          <span>Expected</span>
                                          <pre>{testcase.expected || "N/A"}</pre>
                                        </div>
                                        <div>
                                          <span>Actual</span>
                                          <pre>{testcase.actual || "N/A"}</pre>
                                        </div>
                                      </div>
                                    </details>
                                  );
                                })}
                              </div>
                            </>
                          ) : (
                            <div className="test-empty">
                              You must run your code first
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  </>
                ) : (
                  <div className="empty-code">
                    <p>No problem selected.</p>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => {
                        navigateTo("add");
                      }}
                    >
                      Add problem
                    </button>
                  </div>
                )}
              </section>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

export default App;
