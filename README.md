# LeetCode Tracker

A lightweight React + Vite app for tracking LeetCode practice, solution notes,
review status, and progress by topic.

## Current Features

- Add, edit, and delete practice problems
- Track difficulty, topic, status, LeetCode link, and last solved date
- Write persistent notes for each problem
- Filter by search text, topic, status, and difficulty
- Import public LeetCode problem details by problem number or title slug in dev
- View progress summary and solved percentage
- Persist data in `localStorage`

## Local Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run lint
npm run build
```

## Project Roadmap

1. Import and export tracker data as JSON.
2. Add a production backend or serverless function for LeetCode imports.
3. Add review scheduling with next review date and overdue filters.
4. Add topic-level analytics and weekly solved charts.
5. Split the app into smaller React components once the MVP behavior is stable.
6. Add tests for storage, filtering, imports, and problem editing behavior.

## LeetCode Import Notes

The local Vite dev server exposes `/api/leetcode/problem?query=<number-or-slug>`.
It imports public problem metadata, sanitized problem content, example testcases,
topic tags, and code snippets. LeetCode hidden judge test cases are not public,
so this app only stores example testcases plus your own custom notes/tests.

## Tech Stack

- React
- Vite
- ESLint
- Browser `localStorage`
