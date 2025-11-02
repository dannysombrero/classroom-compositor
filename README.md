# Classroom Compositor

Local-first presenter tooling built with React, TypeScript, and Vite. The presenter window renders the canvas, manages layers, and streams the composited output to additional surfaces.

## Presentation Surfaces

- **Presentation Mode** — Hides the editing chrome and fills the current display with the live canvas so you can present from a single screen without exposing the editor.
- **Confidence Preview** — A floating “what they see” monitor that mirrors the audience output while you continue editing.
- **Viewer Window** — A separate window (usually on a second display) that receives the captured stream for projectors, external monitors, or screen sharing.

## Development

```bash
npm install
npm run dev
```

Run `npm run build` to type-check and generate production assets.
