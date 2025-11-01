# Classroom Compositor 

A lightweight, browser-based tool for teachers who use multiple screens or smartboards in class.  
It lets you **layer your camera, screen capture,** and **simple overlays** (text, shapes, images) in real time - similar to OBS, but streamlined for classroom use.

---

## 🚀 Features (MVP)
- **Screen & Camera capture** — show your desktop and webcam simultaneously  
- **Quick text & shape overlays** — add captions, labels, and highlights instantly  
- **Circle-mask webcam** — clean picture-in-picture without green screen setup  
- **Z-order control & grouping** — organize your overlays with simple toggles  
- **Presenter / Viewer modes** — edit on one monitor, display full-screen on another  
- **Single-screen Presentation Mode** — hide all UI, teach with a clean canvas  
- **Local-first saving** — save and load scenes locally (IndexedDB)

*(More features planned: recording, LAN streaming via code, timers, engagement tools.)*

---

## 🧩 Tech Stack
- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Zustand](https://github.com/pmndrs/zustand) — simple global state store  
- [Dexie.js](https://dexie.org/) — IndexedDB wrapper for local saves  
- [Tinykeys](https://github.com/jamiebuilds/tinykeys) — hotkey manager  
- Canvas 2D for real-time compositing

---

## 💻 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/YOUR-USERNAME/classroom-compositor.git
cd classroom-compositor