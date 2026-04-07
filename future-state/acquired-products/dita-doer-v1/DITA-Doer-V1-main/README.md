
# VibeEtto - XML Monaco Editor

VibeEtto is a modern, browser-based XML editor specialized for DITA content creation. It combines the power of the Monaco Editor (the engine behind VS Code) with Google Gemini AI to provide an intelligent, user-friendly editing experience.

## Key Features

### 📝 Professional Editing Environment
*   **Monaco Editor Integration**: Enjoy a desktop-class coding experience with syntax highlighting, line numbers, code folding, and a minimap.
*   **Dark Mode**: A sleek, high-contrast dark theme powered by Tailwind CSS for comfortable extended use.

### 🤖 AI-Powered Content Management
*   **Smart Formatting**: Instantly convert raw text or unstructured XML into valid DITA topics. The "Format" menu allows specific targeting of **Concept**, **Reference**, and **Task** topic types.
*   **Conversational Assistant**: The **VibeEtto AI** sidebar allows you to chat naturally with the editor. You can ask it to draft content, refactor code, or explain DITA concepts. It provides visual diff counters (e.g., `+50, -10`) to show the scope of changes.
*   **Intelligent Validation**: The editor uses AI to validate your XML structure. If errors are found, it provides a clear description and often suggests an automatic code fix.

### 🔍 Review & Diff System
*   **Safe Review Mode**: When the AI suggests changes (formatting or rewriting), the editor enters a read-only **Review Mode**.
*   **Side-by-Side Diff**: Visualizes changes with a split view—red highlighting for deletions and green for additions—allowing you to verify edits before they touch your code.
*   **Controls**: You can **Accept**, **Reject**, or **Modify** the proposed changes manually.

### 🛡️ Safety & Workflow
*   **Download Protection**: The application prioritizes valid code. If you attempt to download a `.dita` file that hasn't been validated, a warning modal appears to prevent potential issues with downstream Content Management Systems (like Heretto).
*   **Live Preview**: Convert your DITA XML into a readable HTML preview to check readability and flow without leaving the app.
*   **Multiple Formats**: Download your work as `.dita`, `.xml`, or `.txt`.

## Usage Guide

1.  **Editing**: Type directly in the main editor window.
2.  **Formatting**: Use the **Format** dropdown in the toolbar to structure your content.
3.  **Validating**: Click the **Validate** button to check your code. If the AI detects a specific topic type (e.g., "Valid Concept topic"), the button will turn green.
4.  **AI Assistant**: Click the "AI" tab on the right side of the screen to open the chat panel.
5.  **Downloading**: Click **Download** and select your file type. If the file is unvalidated `.dita`, confirm the warning prompt to proceed to the filename entry.

## Tech Stack
*   **Frontend**: React, TypeScript, Vite
*   **Styling**: Tailwind CSS
*   **Editor**: Monaco Editor
*   **AI**: Google Gemini API (`@google/genai`)
