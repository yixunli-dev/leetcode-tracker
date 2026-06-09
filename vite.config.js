import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";

const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";
const LEETCODE_PROBLEM_LIST_URL = "https://leetcode.com/api/problems/all/";

const QUESTION_QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionId
      questionFrontendId
      title
      titleSlug
      difficulty
      content
      exampleTestcases
      sampleTestCase
      topicTags {
        name
        slug
      }
      codeSnippets {
        lang
        langSlug
        code
      }
    }
  }
`;

function sanitizeLeetCodeHtml(html = "") {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function htmlToText(html = "") {
  return sanitizeLeetCodeHtml(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function runCommand(command, args, options) {
  return new Promise((resolve) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      resolve({
        error,
        stdout,
        stderr,
      });
    });
  });
}

function toJavaCharLiteral(character) {
  return `'${String(character)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")}'`;
}

function toJavaStringLiteral(value) {
  return JSON.stringify(String(value));
}

function parseJavaMethodSignature(code) {
  const match = code.match(
    /public\s+(?!class\b)([A-Za-z_](?:\w|<|>|\[|\])*)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/,
  );

  if (!match) {
    throw new Error("Could not find a public Java method in class Solution.");
  }

  const [, returnType, methodName, rawParameters] = match;
  const parameters = rawParameters.trim()
    ? rawParameters.split(",").map((parameter) => {
        const parts = parameter.trim().split(/\s+/);
        const name = parts.pop();
        return {
          type: parts.join(" "),
          name,
        };
      })
    : [];

  return {
    returnType,
    methodName,
    parameters,
  };
}

function parseJsonValue(value) {
  return JSON.parse(value);
}

function toJavaArrayLiteral(type, values) {
  if (type === "int[]") {
    return `new int[] { ${values.join(", ")} }`;
  }

  if (type === "int[][]") {
    return `new int[][] { ${values
      .map((row) => {
        return `{ ${row.join(", ")} }`;
      })
      .join(", ")} }`;
  }

  if (type === "String[]") {
    return `new String[] { ${values.map(toJavaStringLiteral).join(", ")} }`;
  }

  if (type === "char[]") {
    return `new char[] { ${values.map(toJavaCharLiteral).join(", ")} }`;
  }

  throw new Error(`Unsupported Java array type: ${type}`);
}

function toJavaLiteral(type, rawValue) {
  if (type === "int") {
    return String(Number(rawValue));
  }

  if (type === "boolean") {
    return String(rawValue).trim().toLowerCase();
  }

  if (type === "String") {
    const parsedValue = String(rawValue).trim().startsWith("\"")
      ? parseJsonValue(rawValue)
      : rawValue;
    return toJavaStringLiteral(parsedValue);
  }

  if (["int[]", "int[][]", "String[]", "char[]"].includes(type)) {
    return toJavaArrayLiteral(type, parseJsonValue(rawValue));
  }

  throw new Error(`Unsupported Java parameter type: ${type}`);
}

function getJavaSerializerSource(returnType) {
  const supportedReturnTypes = new Set([
    "int",
    "boolean",
    "String",
    "int[]",
    "int[][]",
  ]);

  if (!supportedReturnTypes.has(returnType)) {
    throw new Error(`Unsupported Java return type: ${returnType}`);
  }

  return `
    static String serialize(int value) {
        return String.valueOf(value);
    }

    static String serialize(boolean value) {
        return String.valueOf(value);
    }

    static String serialize(String value) {
        return value;
    }

    static String serialize(int[] value) {
        return java.util.Arrays.toString(value);
    }

    static String serialize(int[][] value) {
        return java.util.Arrays.deepToString(value);
    }
  `;
}

function createJavaRunnerSource(code, testcases) {
  const normalizedCode = code.replace(/\bpublic\s+class\s+Solution\b/, "class Solution");
  const signature = parseJavaMethodSignature(normalizedCode);
  const serializerSource = getJavaSerializerSource(signature.returnType);
  const calls = testcases
    .map((testcase, index) => {
      const args = signature.parameters.map((parameter) => {
        const field = testcase.fields?.find((candidate) => {
          return candidate.name === parameter.name;
        });

        if (!field) {
          throw new Error(`Missing testcase value for parameter: ${parameter.name}`);
        }

        return toJavaLiteral(parameter.type, field.value);
      });

      return `
        try {
            System.out.println("${index}\\t" + serialize(solution.${signature.methodName}(${args.join(", ")})));
        } catch (Throwable error) {
            System.out.println("${index}\\tERROR: " + error.getClass().getSimpleName() + ": " + error.getMessage());
        }`;
    })
    .join("\n");

  return `${normalizedCode}

class Main {
    ${serializerSource}

    public static void main(String[] args) {
        Solution solution = new Solution();
        ${calls}
    }
}
`;
}

async function runJavaSolution({ code, testcases }) {
  const workdir = await mkdtemp(path.join(tmpdir(), "leetcode-tracker-"));

  try {
    const source = createJavaRunnerSource(code, testcases);
    await writeFile(path.join(workdir, "Main.java"), source);

    const compileResult = await runCommand("javac", ["Main.java"], {
      cwd: workdir,
      timeout: 4000,
    });

    if (compileResult.error) {
      return {
        status: "Compile Error",
        summary: "Java compilation failed.",
        stderr: compileResult.stderr,
        outputs: [],
      };
    }

    const runResult = await runCommand("java", ["Main"], {
      cwd: workdir,
      timeout: 4000,
    });

    if (runResult.error) {
      return {
        status: "Runtime Error",
        summary: "Java execution failed or timed out.",
        stderr: runResult.stderr || runResult.error.message,
        outputs: [],
      };
    }

    return {
      status: "Ran",
      summary: "Java code executed locally.",
      outputs: runResult.stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [index, ...outputParts] = line.split("\t");
          return {
            index: Number(index),
            output: outputParts.join("\t"),
          };
        }),
    };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function leetcodeGraphql(query, variables) {
  const response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://leetcode.com",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`LeetCode returned ${response.status}`);
  }

  const payload = await response.json();

  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }

  return payload.data;
}

async function resolveTitleSlug(query) {
  if (!/^\d+$/.test(query)) {
    return query;
  }

  const response = await fetch(LEETCODE_PROBLEM_LIST_URL, {
    headers: {
      Referer: "https://leetcode.com",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`LeetCode problem list returned ${response.status}`);
  }

  const data = await response.json();
  const exactProblem = data.stat_status_pairs?.find((problem) => {
    return String(problem.stat?.frontend_question_id) === query;
  });

  return exactProblem?.stat?.question__title_slug ?? "";
}

function leetcodeProxyPlugin() {
  return {
    name: "leetcode-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url, "http://localhost");

        if (requestUrl.pathname === "/api/run/java") {
          if (req.method !== "POST") {
            sendJson(res, 405, { error: "Method not allowed." });
            return;
          }

          try {
            const body = await readRequestBody(req);
            const result = await runJavaSolution(body);
            sendJson(res, 200, result);
          } catch (error) {
            sendJson(res, 400, {
              error:
                error instanceof Error ? error.message : "Unable to run Java code.",
            });
          }
          return;
        }

        if (requestUrl.pathname !== "/api/leetcode/problem") {
          next();
          return;
        }

        const query = requestUrl.searchParams.get("query")?.trim();

        if (!query) {
          sendJson(res, 400, { error: "Missing problem number or title slug." });
          return;
        }

        try {
          const titleSlug = await resolveTitleSlug(query);

          if (!titleSlug) {
            sendJson(res, 404, { error: "Problem not found." });
            return;
          }

          const data = await leetcodeGraphql(QUESTION_QUERY, { titleSlug });
          const question = data.question;

          if (!question) {
            sendJson(res, 404, { error: "Problem not found." });
            return;
          }

          const content = sanitizeLeetCodeHtml(question.content);

          sendJson(res, 200, {
            ...question,
            content,
            description: htmlToText(content),
          });
        } catch (error) {
          sendJson(res, 502, {
            error:
              error instanceof Error
                ? error.message
                : "Unable to import from LeetCode.",
          });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), leetcodeProxyPlugin()],
});
