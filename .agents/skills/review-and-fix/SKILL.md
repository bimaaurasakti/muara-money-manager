# Skill: General Review-and-Fix

## Description
An automated, language-agnostic workflow skill that orchestrates subagents to verify project integrity, test execution, UI/Frontend consistency (if applicable), and code quality. Use this after completing a primary coding task (e.g., after `/goal Implement feature X`).

## Trigger
Invoke this skill when the user requests "run review-and-fix", "kick off the review-and-fix skill", or whenever a feature implementation requires automated testing and code review.

## Execution Steps

### 1. Context Gathering & Setup Phase
- **Main Agent Task:** 1. Detect the primary programming language(s) and framework(s) used in the project.
  2. Identify the standard commands to build the project, run tests, and start the local development server (e.g., by inspecting `package.json`, `Makefile`, `Cargo.toml`, `requirements.txt`, etc.).

### 2. Verification Phase (Verifier Subagent)
- **Model:** Gemini 3.5 Flash (Low)
- **Role:** Build, Test, and Integration Verifier
- **Instructions:**
  1. Execute the build process and ensure all existing automated tests pass.
  2. **If this is a web/frontend project:** Spin up the local development server. Use **Playwright** (or the project's native E2E testing tool) to inspect the UI and verify it against project UI guidelines (if available).
  3. **If this is a backend/CLI/library project:** Verify API endpoints, command-line outputs, or integration tests.
- **Feedback Loop:** If any critical or medium issues (build errors, test failures, UI inconsistencies) are found, pass them back to the **main agent** to fix. 
- **Completion Criteria:** Repeat this loop until the Verifier subagent is fully satisfied and zero critical/medium issues remain.

### 3. Code Review Phase (Reviewer Subagent)
- **Model:** Gemini 3.5 Flash (Medium)
- **Role:** Code Quality and Standards Reviewer
- **Instructions:**
  1. Review the recently modified codebase.
  2. Check for adherence to general project standards and the specific idiomatic best practices of the detected programming language.
  3. Verify code robustness, security, proper error handling, and maintainability.
- **Feedback Loop:** Flag any architectural, stylistic, or robustness issues back to the **main agent** to fix.
- **Completion Criteria:** Repeat this process until the Reviewer subagent finds no issues and confirms the codebase meets the bar for a high-quality contribution.
