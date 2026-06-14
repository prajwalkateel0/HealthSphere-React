# HealthSphere — React + Node.js

A full-stack healthcare management platform with 4 portals and 36 pages.

## Tech Stack

**Frontend:** React 19 + Vite + React Router v6 + Chart.js + Socket.io-client + Leaflet  
**Backend:** Node.js + Express.js + MySQL2 + JWT + Socket.io  
**Database:** MySQL 8

## Project Structure

```
healthsphere/
├── backend/          # Node.js + Express API
│   ├── src/
│   │   ├── config/   # Database config
│   │   ├── controllers/  # Business logic
│   │   ├── middleware/   # Auth middleware
│   │   └── routes/   # API routes
│   ├── schema.sql    # Database schema + seed data
│   ├── .env.example  # Environment template
│   └── package.json
│
└── frontend/         # React app
    ├── src/
    │   ├── api/      # Axios config
    │   ├── assets/   # CSS design system
    │   ├── components/  # Shared components (Sidebar, Layout)
    │   ├── context/  # Auth context
    │   └── pages/    # 36 pages across 4 portals
    └── package.json
```

## Setup

### 1. Database

```bash
mysql -u root -p < backend/schema.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your DB credentials and API keys
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

## Demo Accounts (password: `password`)

| Role | Email |
|------|-------|
| Patient | emma.patel007@gmail.com |
| Doctor | doctor@healthsphere.com |
| Admin | admin@healthsphere.com |
| Government | govt@healthsphere.com |

## Portals

### Patient Portal (13 pages)
- Dashboard with health score ring
- Appointments booking
- Medical records (labs, prescriptions, allergies, vaccinations)
- Diet tracker with macro tracking + water logging
- Safe Appetite allergen scanner
- Health insights with 7-day trend charts
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
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=healthsphere
JWT_SECRET=your_secret_key
PORT=5000
CLIENT_URL=http://localhost:5173
GEMINI_API_KEY=your_key
SPOONACULAR_API_KEY=your_key
```
