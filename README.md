# 🌍 PixelDays | Global Real-Time Pixel Battle Engine 

**PixelDays** is a high-load, real-time interactive canvas platform designed for massive global collaboration. This project is a comprehensive modernization of a classic pixel-battle engine, optimized for performance, scalability, and modern web standards.

---

##  Project Status: Legacy Modernization (2026)
*This repository contains a legacy codebase currently undergoing a major architectural overhaul. Our team is actively transforming the system to liquidate technical debt and implement modern engineering patterns:*

- **Decoupling:** Stripping away obsolete dependencies and hardcoded logic from the original core.
- **Infrastructure:** Migrating from manual database management to a fully containerized **Docker** environment.
- **Type Safety:** Executing a progressive migration from Vanilla JS to **TypeScript**.
- **Security:** Implementing robust middleware layers for request validation and anti-bot protection.

---

##  Project Structure



```text
├── deployment/          # Infrastructure & CI/CD (Nginx, PM2, Deploy scripts)
├── doc/                 # Technical documentation (API, Deployment, Migration)
├── i18n/                # Internationalization (10+ languages support)
├── mysql/               # Database layer: Schemas & Docker initialization
├── promotion/           # Brand assets: Screenshots, Gifs, Demo materials
├── public/              # Frontend static assets (3D models, Badges, Fonts)
├── scripts/             # Build toolchain (Minification, Bundling, Optimization)
├── src/                 # Main Application Source (Progressive TS Migration)
│   ├── api/             # REST Controllers & API Endpoints
│   ├── components/      # UI Layer: React components & Windows
│   ├── middleware/      # Security layer: Auth, Logging & Validation
│   ├── socket/          # Real-time WebSocket engine (Pixel updates)
│   ├── ssr/             # Server-Side Rendering logic
│   └── db/              # Data Access Objects & SQL Refactoring
├── tests/               # QA Suite: Integration & Unit testing
├── tiles/               # Production Storage: Cached WebP canvas chunks
└── world-map-drawer/    # Specialized map generation utilities
```

---

##  Quick Start
#### Docker **(Recommended)**
The fastest way to deploy the full stack (App, Redis, MariaDB):
```
git clone [https://github.com/LempiRajala/PixelDays.git](https://github.com/LempiRajala/PixelDays.git)
```
```
cd PixelDays
```
```
docker-compose up -d --build
```
---

##  Manual Setup

Requirements: Node.js v20+, Redis 6.2+, MariaDB/MySQL.

1. **Install:** ```npm install```

2. **Configure:** Set your credentials in ```config.ini``` or via environment variables.

3. **Build & Run:**
   
```
npm run build
```
```
npm start
```

---

##  Features & Tech Highlights
- **Real-Time Engine:** Handles thousands of concurrent connections via optimized WebSockets.

- **3D Voxel Canvases:** Native support for volumetric worlds (enabled via ```"v": true``` in config).

- **High-Load Optimization:** A specialized Tile System using WebP compression allows the frontend to lazy-load only visible canvas sectors, reducing traffic by up to 80%.

- **Hourly Events:** Automated MMORPG-style "Void Fight" events triggered every 2 hours.

- **Historical View:** Incremental backup system for historical canvas playback and time-lapse generation.

---

## Development Workflow
- **Linting:** ```npm run lint:src``` to ensure code quality during refactoring.

- **Dev Build:** ```npm run build:dev``` for compilation with source-maps.

- **Translations:** Powered by ttag for seamless SSR and client-side localization.

---

### Team & Community
PixelDays is maintained by the **PixelDays Team**. We are on a mission to prove that any legacy code can be turned into a masterpiece.

📢 **Join our community:** [Telegram Channel (@pixeldaysfun)](https://t.me/pixeldaysfun)  
*Get the latest updates, participate in events, and chat with the developers!*

---
© 2026 PixelDays Platform.
