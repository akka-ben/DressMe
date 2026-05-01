# DressMe

DressMe is a mobile-first social fashion application scaffold built for a `mock-first then backend-integration` workflow.  
The project is based on the course specification for a mobile platform combining:

- social fashion posts
- community voting on outfits
- direct interaction between users
- AI stylist recommendations
- a progressive path toward chat, calls, and real backend integration

This repository currently contains a working foundation for both:

- a `FastAPI` backend scaffold
- an `Expo / React Native` mobile frontend prototype that can be tested on a real phone with `Expo Go`

## What Was Done From the Beginning

The work completed in this repository followed the roadmap approved for the DressMe MVP.

### 1. Project foundation was created from scratch

The target folder was initially almost empty, so the repository structure was created manually:

- `backend/`
- `mobile/`
- `docs/`
- `infra/`

Top-level project files were added:

- `.env.example`
- `.gitignore`
- `README.md`

### 2. Documentation and roadmap artifacts were created

Two core documentation files were added:

- [docs/architecture.md](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/docs/architecture.md)
- [docs/roadmap_sprints.tex](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/docs/roadmap_sprints.tex)

These describe:

- the mock-first delivery strategy
- module boundaries
- sprint planning
- frontend/backend progressive integration

### 3. Backend scaffold was implemented

The backend was created as a modular `FastAPI` app with versioned routing and typed DTOs.

Main backend entry points:

- [backend/app/main.py](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/backend/app/main.py)
- [backend/app/api/router.py](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/backend/app/api/router.py)
- [backend/app/core/config.py](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/backend/app/core/config.py)
- [backend/app/schemas/contracts.py](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/backend/app/schemas/contracts.py)

Implemented backend module stubs:

- `auth`
- `users`
- `social`
- `chat`
- `calls`
- `ai`

Module files:

- [backend/app/modules/auth/router.py](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/backend/app/modules/auth/router.py)
- [backend/app/modules/users/router.py](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/backend/app/modules/users/router.py)
- [backend/app/modules/social/router.py](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/backend/app/modules/social/router.py)
- [backend/app/modules/chat/router.py](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/backend/app/modules/chat/router.py)
- [backend/app/modules/calls/router.py](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/backend/app/modules/calls/router.py)
- [backend/app/modules/ai/router.py](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/backend/app/modules/ai/router.py)

These routes currently return mock/demo data, but the structure is ready for:

- JWT auth
- real persistence
- media upload
- Socket.IO
- WebRTC signaling
- AI provider integration

### 4. Backend data models were started

Initial SQLAlchemy models were added:

- [backend/app/models/base.py](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/backend/app/models/base.py)
- [backend/app/models/user.py](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/backend/app/models/user.py)
- [backend/app/models/post.py](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/backend/app/models/post.py)

At this stage they are foundational models, not yet a complete production schema.

### 5. Infrastructure files were added

The local infrastructure stack was prepared in:

- [infra/docker-compose.yml](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/infra/docker-compose.yml)

It includes placeholders for:

- PostgreSQL
- Redis
- MinIO
- backend container

### 6. Mobile frontend scaffold was created

The frontend was built around a mock-first service architecture.

Main mobile app files:

- [mobile/App.tsx](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/App.tsx)
- [mobile/index.js](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/index.js)
- [mobile/app.json](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/app.json)
- [mobile/babel.config.js](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/babel.config.js)
- [mobile/tsconfig.json](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/tsconfig.json)
- [mobile/package.json](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/package.json)

### 7. Stable typed frontend contracts were added

Shared frontend-facing contracts were created in:

- [mobile/src/types/contracts.ts](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/types/contracts.ts)

These cover the core app entities:

- `User`
- `Profile`
- `Post`
- `Comment`
- `Conversation`
- `Message`
- `CallSession`
- `AIRecommendation`
- `AuthSession`

### 8. Mock-first service layer was implemented

The frontend uses a client abstraction so screens do not depend directly on mock data or API shape.

Files:

- [mobile/src/services/types.ts](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/services/types.ts)
- [mobile/src/services/index.ts](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/services/index.ts)
- [mobile/src/services/mock/mockData.ts](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/services/mock/mockData.ts)
- [mobile/src/services/mock/mockClient.ts](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/services/mock/mockClient.ts)
- [mobile/src/services/api/apiClient.ts](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/services/api/apiClient.ts)

Current behavior:

- screens use the same interface in both mock and API mode
- mock mode is active by default
- API integration points are already shaped to match backend routes

### 9. Initial mobile screens were created

The first screen set implemented from the roadmap:

- [mobile/src/screens/OnboardingScreen.tsx](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/screens/OnboardingScreen.tsx)
- [mobile/src/screens/LoginScreen.tsx](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/screens/LoginScreen.tsx)
- [mobile/src/screens/RegisterScreen.tsx](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/screens/RegisterScreen.tsx)
- [mobile/src/screens/ForgotPasswordScreen.tsx](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/screens/ForgotPasswordScreen.tsx)
- [mobile/src/screens/FeedScreen.tsx](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/screens/FeedScreen.tsx)
- [mobile/src/screens/PostDetailScreen.tsx](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/screens/PostDetailScreen.tsx)
- [mobile/src/screens/CreatePostScreen.tsx](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/screens/CreatePostScreen.tsx)
- [mobile/src/screens/ProfileScreen.tsx](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/screens/ProfileScreen.tsx)

### 10. Reusable frontend components were added

Files:

- [mobile/src/components/SectionCard.tsx](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/components/SectionCard.tsx)
- [mobile/src/components/PrimaryButton.tsx](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/components/PrimaryButton.tsx)
- [mobile/src/components/TabBar.tsx](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/components/TabBar.tsx)

These were introduced to move the UI from a static mock page to a more realistic mobile prototype.

### 11. Local state and route constants were added

Files:

- [mobile/src/store/appStore.ts](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/store/appStore.ts)
- [mobile/src/navigation/routes.ts](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/navigation/routes.ts)

### 12. The app was changed from a long mock page into a phone-style shell

Originally, `App.tsx` rendered all screens in one long vertical page.  
That was useful as a scaffold, but not useful for real phone testing.

The app was then refactored into a more phone-like UX:

- onboarding screen first
- login / register / forgot password flow
- mock login entry into the app
- bottom tab shell with:
  - `Feed`
  - `Create`
  - `Profile`

### 13. Interactive mock buttons were added

The first static mock screens were upgraded with usable interactions:

- login mock action
- register mock action
- forgot-password mock action
- like button
- vote buttons
- Help Me Choose button
- follow button
- share AI look button
- publish outfit button

These interactions are local and mock-based, but they now demonstrate the intended UX flow instead of only showing layout.

### 14. Scroll behavior was fixed for phone testing

The app initially did not scroll correctly because the active screen was rendered in a fixed `View`.  
This was fixed by using a `ScrollView` inside the phone shell in `App.tsx`.

### 15. Expo / phone testing support was added

The project was adapted to run with `Expo` so it could be tested quickly on a real phone.

Files involved:

- [mobile/package.json](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/package.json)
- [mobile/app.json](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/app.json)
- [mobile/babel.config.js](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/babel.config.js)
- [mobile/index.js](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/index.js)

### 16. Expo Go compatibility issue was fixed

The project initially used `Expo SDK 51`, but the phone had `Expo Go SDK 54`, which caused the app to be rejected on device.

To fix this, the mobile project was upgraded to Expo SDK 54:

- `expo` updated to SDK 54
- `react` updated to `19.1.0`
- `react-dom` updated to `19.1.0`
- `react-native` updated to `0.81.5`
- `react-native-web` updated
- Expo-managed packages aligned
- old `@types/react-native` removed
- TypeScript config updated for Expo 54

Verified after upgrade:

- Expo reports `sdkVersion: 54.0.0`
- `npm run typecheck` passes

### 17. Expo watcher / EMFILE issue was fixed

During local testing, Expo/Metro crashed with:

- `EMFILE: too many open files, watch`

Root cause:

- `watchman` was not installed
- Metro fell back to Node’s file watcher

Fix:

- `watchman` was installed via Homebrew

This stabilizes local Expo watching on macOS.

### 18. Web export was successfully generated

The frontend was bundled successfully for web once and exported to:

- [mobile/dist/index.html](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/dist/index.html)

That export is only a verification artifact. The preferred way to test the UI is now on a phone through Expo Go.

## Project Tree

Below is the current project arborescence with a short definition for each repository file and folder.

```text
DressMe_Chat/
├── .env.example
│   Example environment variables for backend and mobile configuration.
├── .gitignore
│   Ignore rules for dependencies, caches, env files, and generated output.
├── README.md
│   Main project documentation and implementation history.
│
├── backend/
│   FastAPI backend scaffold.
│   ├── Dockerfile
│   │   Container definition for the backend service.
│   ├── pyproject.toml
│   │   Python package metadata and backend dependencies.
│   └── app/
│       ├── __init__.py
│       │   Marks the backend app directory as a Python package.
│       ├── main.py
│       │   FastAPI application entry point.
│       ├── api/
│       │   └── router.py
│       │       Central router that mounts all module routes under `/api/v1`.
│       ├── core/
│       │   └── config.py
│       │       Environment-based configuration loading.
│       ├── models/
│       │   ├── __init__.py
│       │   │   Models package marker.
│       │   ├── base.py
│       │   │   SQLAlchemy declarative base.
│       │   ├── post.py
│       │   │   Initial post and post media models.
│       │   └── user.py
│       │       Initial user model.
│       ├── modules/
│       │   ├── ai/
│       │   │   └── router.py
│       │   │       Mock AI outfit recommendation routes.
│       │   ├── auth/
│       │   │   └── router.py
│       │   │       Register, login, and current-user routes.
│       │   ├── calls/
│       │   │   └── router.py
│       │   │       Mock call session routes.
│       │   ├── chat/
│       │   │   └── router.py
│       │   │       Mock conversation and message routes.
│       │   ├── social/
│       │   │   └── router.py
│       │   │       Mock feed, posts, comments, and poll routes.
│       │   └── users/
│       │       └── router.py
│       │           User profile route.
│       └── schemas/
│           └── contracts.py
│               Typed DTOs for requests and responses.
│
├── docs/
│   Project documentation files.
│   ├── architecture.md
│   │   High-level architecture and module boundary notes.
│   └── roadmap_sprints.tex
│       LaTeX sprint roadmap table.
│
├── infra/
│   Local infrastructure definition.
│   └── docker-compose.yml
│       Docker services for postgres, redis, minio, and backend.
│
└── mobile/
    Expo / React Native frontend prototype.
    ├── App.tsx
    │   Root mobile app shell with auth flow and bottom tabs.
    ├── app.json
    │   Expo application configuration.
    ├── babel.config.js
    │   Babel config for Expo and React Native compilation.
    ├── index.js
    │   Expo entry point.
    ├── package-lock.json
    │   Locked npm dependency tree.
    ├── package.json
    │   Frontend scripts and dependencies.
    ├── tsconfig.json
    │   TypeScript config for Expo / React Native.
    │
    ├── .expo/
    │   Expo-generated local metadata.
    │   ├── README.md
    │   │   Expo explanation for the `.expo` folder.
    │   └── devices.json
    │       Local Expo device history metadata.
    │
    ├── dist/
    │   Generated web export used for verification.
    │   ├── index.html
    │   │   Exported web entry page.
    │   ├── metadata.json
    │   │   Expo export metadata.
    │   └── _expo/static/js/web/index-28b72ceac6f4c29b16215b18a0e50ba8.js
    │       Generated bundled JavaScript for the exported web build.
    │
    ├── src/
    │   Frontend source code.
    │   ├── components/
    │   │   ├── PrimaryButton.tsx
    │   │   │   Reusable main action button.
    │   │   ├── SectionCard.tsx
    │   │   │   Reusable card layout wrapper.
    │   │   └── TabBar.tsx
    │   │       Bottom tab bar for the mobile shell.
    │   ├── navigation/
    │   │   └── routes.ts
    │   │       Route and tab constants.
    │   ├── screens/
    │   │   ├── CreatePostScreen.tsx
    │   │   │   Mock create-post screen.
    │   │   ├── FeedScreen.tsx
    │   │   │   Feed screen with like and AI mock interactions.
    │   │   ├── ForgotPasswordScreen.tsx
    │   │   │   Mock password reset screen.
    │   │   ├── LoginScreen.tsx
    │   │   │   Mock login screen.
    │   │   ├── OnboardingScreen.tsx
    │   │   │   Intro screen for first app access.
    │   │   ├── PostDetailScreen.tsx
    │   │   │   Post detail screen with comment and vote mock UI.
    │   │   ├── ProfileScreen.tsx
    │   │   │   Profile screen with follow and AI sharing mock actions.
    │   │   └── RegisterScreen.tsx
    │   │       Mock registration screen.
    │   ├── services/
    │   │   ├── index.ts
    │   │   │   Selects the active mock or API client.
    │   │   ├── types.ts
    │   │   │   Shared DressMe client interface.
    │   │   ├── api/
    │   │   │   └── apiClient.ts
    │   │   │       API-backed client implementation.
    │   │   └── mock/
    │   │       ├── mockClient.ts
    │   │       │   Mock service implementation used by the prototype.
    │   │       └── mockData.ts
    │   │           Mock users, posts, comments, and AI suggestion data.
    │   ├── store/
    │   │   └── appStore.ts
    │   │       Zustand store for app-level UI state.
    │   └── types/
    │       └── contracts.ts
    │           Frontend entities and DTO-style types.
    │
    └── node_modules/
        Installed npm dependencies generated by `npm install`.
```

### Notes About Generated Content

- `mobile/node_modules/` is generated dependency code, not handwritten project code.
- `mobile/.expo/` is generated by Expo for local development.
- `mobile/dist/` is generated when exporting the web build.

## Current Repository Structure

### Backend

- FastAPI scaffold with modular routers
- typed request/response contracts
- initial SQLAlchemy models
- mock API behavior for MVP screens

### Mobile

- Expo SDK 54 app
- phone-style shell
- bottom tab navigation pattern
- mock auth flow
- mock feed interactions
- mock AI suggestion flow

### Docs

- architecture notes
- sprint roadmap in LaTeX

### Infra

- Docker Compose foundation for API services

## What Works Right Now

### Frontend

You can run the mobile frontend on a physical phone using `Expo Go`.

Current testable flow:

1. open onboarding
2. tap `Get Started`
3. go to login/register/forgot password screens
4. tap `Sign In (Mock)`
5. access bottom-tab mobile shell
6. test:
   - feed
   - like
   - Help Me Choose
   - create post mock
   - follow
   - share AI look

### Backend

The backend is runnable as a scaffold and exposes demo routes for:

- health
- auth
- profile
- feed
- comments
- chat
- calls
- AI recommendations

## How To Run

### Run the mobile app on a phone

From the repository root:

```bash
cd "/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web Mobile/DressMe_Chat/mobile"
watchman watch-del-all
npx expo start --clear
```

Then:

- open `Expo Go` on the phone
- scan the QR code

If local network discovery fails:

```bash
npx expo start --clear --tunnel
```

### Run the mobile app on web

```bash
cd "/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web Mobile/DressMe_Chat/mobile"
npm run web
```

### Run backend locally

```bash
cd "/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web Mobile/DressMe_Chat"
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -e ./backend
uvicorn app.main:app --reload --app-dir backend
```

Useful URLs:

- [http://localhost:8000/health](http://localhost:8000/health)
- [http://localhost:8000/docs](http://localhost:8000/docs)

## Verification Performed

During implementation, the following checks were completed:

- backend Python files compiled successfully
- Expo config confirmed SDK 54
- mobile `npm run typecheck` passes
- frontend web bundle/export succeeded

## Known Limitations

This repository is still an MVP scaffold, not a finished production app.

Not fully implemented yet:

- real database persistence
- real JWT auth flow
- media upload pipeline
- follow/like/comment persistence
- real chat
- Socket.IO integration
- WebRTC audio/video calling
- real OpenAI integration
- push notifications
- native Android/iOS production builds

Current mobile interactions are mock-driven and intended to validate the UX direction first.

## Recommended Next Steps

1. Replace backend mock responses with real persistence and services.
2. Connect frontend auth/feed/profile screens to live backend endpoints.
3. Add proper navigation stack and dedicated post/chat/call screens.
4. Implement media upload and post creation API.
5. Add Socket.IO chat and presence.
6. Add WebRTC signaling and call UI.
7. Replace mock AI results with the real backend AI endpoint and provider integration.

## Important Files

### Core docs

- [README.md](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/README.md)
- [docs/architecture.md](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/docs/architecture.md)
- [docs/roadmap_sprints.tex](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/docs/roadmap_sprints.tex)

### Backend

- [backend/app/main.py](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/backend/app/main.py)
- [backend/app/api/router.py](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/backend/app/api/router.py)
- [backend/app/schemas/contracts.py](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/backend/app/schemas/contracts.py)
- [backend/app/models/post.py](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/backend/app/models/post.py)

### Mobile

- [mobile/App.tsx](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/App.tsx)
- [mobile/package.json](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/package.json)
- [mobile/src/types/contracts.ts](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/types/contracts.ts)
- [mobile/src/services/index.ts](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/services/index.ts)
- [mobile/src/screens/FeedScreen.tsx](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/screens/FeedScreen.tsx)
- [mobile/src/screens/ProfileScreen.tsx](/Users/mohammedbenakkaouayad/Desktop/MASTER_WISD/S2/Web%20Mobile/DressMe_Chat/mobile/src/screens/ProfileScreen.tsx)
