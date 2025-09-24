# HRV Analysis App - Migration Project

This repository contains both the original React/Vite HRV app and the new Next.js 15 version.

## 📁 Project Structure

```
hrv/
├── hrv-react/          # Original React/Vite application
│   ├── frontend/       # React frontend with Vite
│   ├── backend/        # Express.js backend
│   ├── appwrite/       # Appwrite configuration
│   └── ...
├── hrv-nextjs/         # New Next.js 15 application
│   ├── src/app/        # App Router structure
│   ├── components/     # React components
│   ├── lib/            # Utilities and configurations
│   └── ...
└── README.md           # This file
```

## 🚀 Development

### Next.js Version (New)
```bash
cd hrv-nextjs
npm run dev
# Runs on http://localhost:3000
```

### React/Vite Version (Original)
```bash
cd hrv-react
npm run dev
# Runs on http://localhost:3001 (frontend)
# Backend on http://localhost:5000
```

## 📋 Migration Status

- ✅ **Phase 1**: Next.js 15 project setup complete
- ⏳ **Phase 2**: Component migration (in progress)
- ⏳ **Phase 3**: Authentication & API setup
- ⏳ **Phase 4**: Testing & deployment

## 🔧 Tech Stack

### Next.js Version
- **Framework**: Next.js 15.5.4
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Build Tool**: Turbopack
- **Database**: Appwrite

### Original Version
- **Frontend**: React 18 + Vite
- **Backend**: Express.js
- **Database**: Appwrite
- **Styling**: Tailwind CSS 3

## 📖 Documentation

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Migration Guide](./MIGRATION.md) (coming soon)
