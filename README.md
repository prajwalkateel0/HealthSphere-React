# HealthSphere — React + Node.js

A full-stack healthcare management platform with 4 portals and 37 pages.

🌐 **Live demo:** https://health-sphere-react.vercel.app

## Tech Stack

**Frontend:** React 19 + Vite + React Router v6 + Chart.js + Socket.io-client + Leaflet  
**Backend:** Node.js + Express.js + Prisma ORM + JWT + Socket.io  
**Database:** PostgreSQL

## Project Structure

```
healthsphere/
├── backend/          # Node.js + Express API
│   ├── src/
│   │   ├── config/   # Database config
│   │   ├── controllers/  # Business logic
│   │   ├── middleware/   # Auth middleware
│   │   └── routes/   # API routes
│   ├── prisma/       # Prisma schema + migrations
│   ├── .env.example  # Environment template
│   └── package.json
│
└── frontend/         # React app
    ├── src/
    │   ├── api/      # Axios config
    │   ├── assets/   # CSS design system
    │   ├── components/  # Shared components (Sidebar, Layout)
    │   ├── context/  # Auth context
    │   └── pages/    # 37 pages across 4 portals
    └── package.json
```

## Setup

### 1. Database

```bash
cd backend
cp .env.example .env
# Set DATABASE_URL to your PostgreSQL connection string
npx prisma migrate deploy
node seed.js   # optional demo data
```

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

## Deployment (free)

This app is deployed for free using:

- **Frontend** → [Vercel](https://vercel.com) (root directory `frontend`, auto-deploys on push to `master`)
- **Backend** → [Render](https://render.com) (root directory `backend`, build: `npm install && npm run build`, start: `npm start`, auto-deploys on push to `master`)
- **Database** → [Neon](https://neon.tech) (free serverless PostgreSQL)

Push to `master` and both Vercel and Render redeploy automatically. Render's build step runs `prisma migrate deploy`, so schema changes are applied automatically too.

## Demo Accounts (password: `password`)

| Role | Email |
|------|-------|
| Patient | emma.patel007@gmail.com |
| Doctor | doctor@healthsphere.com |
| Admin | admin@healthsphere.com |
| Government | govt@healthsphere.com |

## Portals

### Patient Portal (14 pages)
- Dashboard with health score ring
- Appointments booking
- Medical records (labs, prescriptions, allergies, vaccinations)
- Diet tracker with macro tracking + water logging
- Safe Appetite allergen scanner
- Health insights with 7-day trend charts
- Wearable Sync (Google Fit via Google Drive Takeout)
- Real-time messaging with doctor
- AI health assistant (Gemini)
- NHS hospital map
- Documents, Notifications, Profile

### Doctor Portal (9 pages)
- Dashboard with today's patients + critical alerts
- Patient management with drill-down
- Appointment status management
- Lab results + prescriptions
- Weekly schedule management
- Health alerts
- Real-time messaging

### Admin Portal (8 pages)
- Platform statistics dashboard
- User management (CRUD + status)
- Doctor HCPC verification
- Approval queue
- Analytics charts
- Access audit logs
- Food database management
- Genetic disease registry

### Government Portal (4 pages)
- Population health dashboard (anonymised)
- Analytics charts
- Public health alert system
- UK regional map

## API Keys Required

- `GEMINI_API_KEY` — for AI Assistant and health insights
- `SPOONACULAR_API_KEY` — for food search (optional, falls back to local DB)
- SMTP credentials — for email notifications

## Environment Variables

```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
PORT=5002
CLIENT_URL=http://localhost:5175
GEMINI_API_KEY=your_key
SPOONACULAR_API_KEY=your_key
```

Frontend (`frontend/.env`):

```env
VITE_API_URL=http://localhost:5002/api
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```
