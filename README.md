# NX Kizomba Dance Learning Platform

A premium, mobile-first web application for learning kizomba dance with structured video courses and role-based access control.

## Brand Values

- Connection
- Harmony""""""
- Fluidity""""""
- Elegance
- Simplicity
- Premium but accessible

## Features

### User Features
- **Landing Page**: Clear value proposition with hero section and benefits
- **Authentication**: Sign up and login with role-based access (student, professor, admin)
- **Video Academy**: Structured video library organized by levels
  - Beginner: Full access for all users
  - Intermediate: Partial access (requires subscription)
  - Advanced: Teaser only (requires subscription)
- **Video Player**: Secure video display with progress tracking
- **Professor Profiles**: Browse instructor profiles with teaser videos
- **User Account**: Manage subscription status, profile settings, and billing

### Technical Features
- Mobile-first responsive design
- Role-based access control (RLS)
- Subscription management (Stripe-ready)
- Video progress tracking
- Clean, scalable architecture
- Supabase backend with PostgreSQL

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Supabase account (database is pre-configured)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Environment variables are already configured in `.env`

3. Start the development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Database Schema

The platform uses the following tables:

- **profiles**: Extended user information with roles and subscription status
- **professors**: Professor profiles and information
- **videos**: Video content library organized by levels
- **professor_subscriptions**: Individual professor subscriptions
- **video_progress**: User progress tracking

All tables have Row Level Security (RLS) enabled with appropriate policies.

## Seeding Sample Data

To populate the database with sample videos, you can use the seed function:

```typescript
import { seedDatabase } from './lib/seedData';
await seedDatabase();
```

## Subscription Model

### NEXA Access (Platform Subscription) - MANDATORY
- **Price**: 8.99€/month or 89€/year
- **Status**: active, inactive, trial
- **Includes**:
  - Full beginner level access
  - Partial intermediate content
  - Advanced level teasers
  - Professor discovery
  - Events and bookings

**Access Levels**:
- No subscription: Full beginner access, partial intermediate, teaser advanced
- Active subscription: Full access to all levels

### Professor Subscriptions - OPTIONAL
- **Price Range**: 15-30€/month (set by each professor)
- **Requirements**: Active NEXA Access subscription required
- **Includes**:
  - Premium content from that professor
  - Priority booking for courses
  - Exclusive videos and events
- Subscription status tracked separately from platform subscription

## Architecture

### Frontend Structure
```
src/
├── components/       # Reusable UI components
│   └── Header.tsx
├── contexts/        # React contexts
│   └── AuthContext.tsx
├── lib/            # Utilities and configuration
│   ├── supabase.ts
│   ├── database.types.ts
│   └── seedData.ts
├── pages/          # Page components
│   ├── Landing.tsx
│   ├── SignIn.tsx
│   ├── SignUp.tsx
│   ├── Academy.tsx
│   ├── VideoPlayer.tsx
│   ├── Professors.tsx
│   └── Account.tsx
├── App.tsx         # Main app with routing
└── main.tsx        # Entry point
```

### Design System

**Colors**:
- Primary Gold: #B8913D (from NX logo)
- Hover Gold: #A07F35
- Neutral grays for text and backgrounds

**Typography**:
- System fonts for optimal performance
- Font weights: light (300), normal (400), medium (500)
- Clear hierarchy with proper spacing

**Components**:
- Rounded corners (rounded-lg, rounded-2xl, rounded-full)
- Subtle shadows and hover effects
- Mobile-first responsive breakpoints

## Next Steps

### Integration Ready

1. **Stripe Integration**: Payment processing logic is in place
   - Connect Stripe account
   - Add payment form in Account page
   - Handle subscription webhooks

2. **Video Streaming**: Video player is ready for integration
   - Connect to video provider (Cloudflare Stream, Mux, etc.)
   - Update video URLs in database
   - Add upload functionality for admins

3. **Additional Features**:
   - Email notifications for subscription updates
   - Admin dashboard for content management
   - Advanced search and filtering
   - Social features (comments, ratings)

## Security

- All database tables have Row Level Security enabled
- Users can only access their own data
- Subscription status checked on video access
- Authentication required for protected routes
- Secure password handling with Supabase Auth

## License

All rights reserved © 2024 NX Academy
