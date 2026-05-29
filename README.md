# DressMe

## Présentation

DressMe est une application mobile sociale basée sur l’intelligence artificielle permettant aux utilisateurs de partager leurs tenues, interagir avec la communauté et recevoir des recommandations vestimentaires personnalisées.

Le projet a été développé dans le cadre du Master WISD et combine développement mobile, développement backend, bases de données, intelligence artificielle et vision par ordinateur.

## Fonctionnalités

### Réseau Social

- Création de compte et authentification sécurisée
- Gestion du profil utilisateur
- Publication de photos et vidéos
- Likes, commentaires et partages
- Système de suivi d'utilisateurs (Follow / Unfollow)
- Flux d’actualités personnalisé

### Communication

- Messagerie instantanée
- Notifications en temps réel
- Appels audio et vidéo

### Intelligence Artificielle

- Assistant virtuel de mode
- Recommandations de tenues personnalisées
- Analyse d’images vestimentaires
- Suggestions basées sur les préférences utilisateur

## Technologies Utilisées

### Frontend Mobile

- React Native
- Expo
- TypeScript

### Backend

- FastAPI
- MongoDB
- JWT Authentication
- WebSocket

### Intelligence Artificielle

- Computer Vision
- Recommendation Engine
- Large Language Models (LLMs)

## Architecture Générale

```text
┌─────────────────┐
│  Mobile App     │
│ React Native    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ FastAPI Backend │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    MongoDB      │
└─────────────────┘
```

## Structure du Projet

```text
DressMe/
├── backend/
│   ├── app/
│   ├── uploads/
│   └── requirements.txt
│
├── mobile/
│   ├── src/
│   ├── assets/
│   └── package.json
│
├── docs/
├── .env.example
└── README.md
```

## Installation

### 1. Cloner le projet

```bash
git clone <repository-url>
cd DressMe
```

### 2. Lancer le Backend

```bash
cd backend

python -m venv .venv

source .venv/bin/activate

pip install -r requirements.txt

uvicorn app.main:app --reload
```

Le backend sera accessible sur :

```text
http://localhost:8000
```

Documentation API :

```text
http://localhost:8000/docs
```

### 3. Lancer le Frontend Mobile

```bash
cd mobile

npm install

npx expo start
```

Scanner ensuite le QR Code avec Expo Go.

## Configuration

Créer un fichier `.env` à partir de `.env.example`.

Exemple :

```env
MONGO_URI=
JWT_SECRET=
GROQ_API_KEY=
SMTP_EMAIL=
SMTP_PASSWORD=
```

## Fonctionnalités Actuellement Disponibles

- Authentification utilisateur
- Gestion des profils
- Publication de contenu
- Interactions sociales
- Messagerie
- Notifications
- Appels temps réel
- Assistant IA
- Recommandations vestimentaires

## Perspectives d'Amélioration

- Optimisation des modèles IA
- Système avancé de recommandation
- Déploiement cloud
- Notifications push natives
- Amélioration des performances temps réel

## Auteur

**Mohamed Ben Akka Ouayad**

Master WISD  
Université Sidi Mohamed Ben Abdellah

## Licence

Projet académique réalisé dans le cadre du Master WISD.
