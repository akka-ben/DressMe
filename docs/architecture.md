# DressMe Architecture

## Core principles

- Mobile development starts against mocks.
- DTOs stay stable across mock and API adapters.
- The backend owns auth, uploads, real-time orchestration, and AI access.
- High-risk features are added incrementally: chat, then calls, then AI.

## Service boundaries

- `auth`: register, login, refresh, me, reset-password
- `users`: profiles and follow relationships
- `social`: posts, likes, comments, polls
- `chat`: conversations, messages, read states
- `calls`: call session state and WebRTC signaling
- `ai`: Help Me Choose recommendations
- `media`: media upload and storage abstraction

## Mobile contract rule

All screens use the same `DressMeClient` interface, whether data comes from:

- `MockDressMeClient`
- `ApiDressMeClient`

That keeps screen code stable while backend endpoints are integrated progressively.
