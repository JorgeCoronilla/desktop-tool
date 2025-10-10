# Desktop Helper — Product Overview

## Elevator Pitch
Desktop Helper is a friendly desktop assistant that streamlines everyday file and document tasks with AI support. It lets you browse and manage folders, read and edit text files, process PDFs (including OCR), work with Excel/CSV, and chat with an AI assistant that can propose and execute the right actions on your behalf.

## Value Proposition
- Simplifies routine file operations and document workflows.
- Combines a visual file explorer with an intelligent chat assistant.
- Keeps your data local in the desktop app; avoids exposing sensitive keys in the browser.

## Target Users
- Knowledge workers managing lots of files and documents.
- Analysts working with PDFs and spreadsheets.
- Developers or operations teams who want quick file utilities plus AI guidance.

## Platforms and Modes
- Desktop App (Electron): Full functionality, including real file system access and document processing. The recommended mode.
- Web Preview (Browser): UI preview with limited capabilities. For safety, it does not access your real file system; AI calls go through a local proxy when enabled.

## Core Features
1) File Explorer
- Select and browse folders with hierarchical tree view.
- Expandable/collapsible folder navigation.
- Visual file type recognition with specific icons (images, code files, documents, etc.).
- List contents with file sizes and metadata.
- Breadcrumb navigation for easy folder traversal.
- Create, delete, copy, and move files/folders.
- Read and write plain text files.

2) Document Processing
- PDF text extraction.
- OCR for scanned PDFs.
- Excel/CSV read: load sheets, view rows.
- Excel write/modify: add/update/delete rows, create or update sheets.

3) AI Assistant
- Chat with an assistant that understands your intent and suggests a plan.
- Configurable token limits for response length control.
- Cancel ongoing AI requests with dedicated cancel button.
- Auto-scroll to latest messages with manual scroll-to-bottom option.
- The assistant can execute tasks (e.g., create a folder, read a file, extract text from a PDF) and report results.
- Responds concisely in Spanish by default; can adapt based on your prompts.

4) User Interface
- Light and dark theme toggle with persistent preferences.
- Resizable panels between file explorer and chat areas.
- Responsive layout optimized for desktop use.
- Consistent visual design with smooth transitions.

## How It Works (Product-Level)
- You interact via two panels: a file explorer and an AI chat.
- Ask the assistant to perform actions (“Create a folder named Reports”), or navigate and act directly from the explorer.
- For actions that require system access, the assistant uses the desktop app’s secure bridge to perform them locally.
- In web preview, the assistant defers system actions and uses a local proxy for AI calls when available.

## Getting Started
1) Launch the desktop app.
2) Provide your OpenAI API key via app configuration (environment file or settings).
3) Start in the home view: open a folder, or begin chatting with the assistant.

## User Experience
- Layout: sidebar file explorer with tree navigation, main chat area, resizable split with drag handle.
- Themes: Toggle between light and dark modes with automatic preference saving.
- Navigation: Breadcrumb trails and back buttons for intuitive folder browsing.
- Chat Interface: Token limit controls, cancel buttons for ongoing requests, and smart scroll management.
- Visual Feedback: File type icons, hover effects, and smooth transitions throughout the interface.
- Messages: the assistant greets you and offers actionable suggestions.
- Feedback: clear success messages, concise error explanations, and guidance when features require the desktop app.

## Privacy & Security
- Desktop mode keeps operations local; your files never leave your machine.
- The browser preview avoids exposing secret keys; AI calls use a local proxy when configured.
- The assistant does not reveal or log your keys in messages.

## Typical Tasks
- "Create a folder named project_alpha."
- "Read notes.txt and summarize it."
- "Extract text from invoice.pdf."
- "Run OCR on scanned.pdf."
- "Load Sheet 'Sales' from sales.xlsx and show row count."
- "Add these rows to Sheet 'Q1'."
- Navigate through folders using the tree view and breadcrumbs.
- Adjust panel sizes by dragging the divider between chat and file explorer.
- Switch between light and dark themes using the theme toggle button.
- Control AI response length with token limit settings.
- Cancel long-running AI requests when needed.

## Error Handling (User-Facing)
- OpenAI not configured: the app explains how to add a key and restart.
- Desktop-only action in web mode: the app clarifies the limitation and suggests using the desktop app.
- File operation failures: you receive a concise message describing what went wrong and what to try next.

## Limitations (Product)
- Web preview is limited: no real file system access.
- Very large files may be restricted to keep the experience responsive.

## Roadmap (Examples)
- Drag-and-drop file operations.
- Batch actions and task queues.
- Favorites and quick access collections.
- Cloud integrations (drive providers) with explicit user consent.
- Configurable AI prompts and personas.

## Non-Goals (For Now)
- Advanced image editing beyond OCR.
- Full document DTP or layout design features.

## FAQs
- Do I need an API key? Yes, for AI chat; the app guides you to add it safely.
- Can I use it without the desktop app? The web preview is for UI testing; use the desktop app for full capabilities.
- What languages does the assistant use? It responds in Spanish by default and can adapt to your request.

## Success Metrics
- Reduced time to perform file/document tasks.
- Fewer manual steps thanks to assistant-driven actions.
- High user satisfaction with clarity of messages and outcomes.

## Support
- If something doesn’t work as expected, share the message shown by the app and what you attempted. The assistant provides next-step guidance.