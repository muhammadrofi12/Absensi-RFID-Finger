# IoT Employee Attendance System

## Overview

This is an IoT-integrated employee attendance management system that uses ESP32 hardware with RFID and fingerprint sensors for two-factor authentication (2FA). The system provides a web-based admin dashboard for managing employees and viewing attendance logs. The attendance flow requires employees to first scan their RFID card, then verify with fingerprint scanning for successful check-in/check-out.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Design System**: Material Design 3 principles optimized for admin dashboards with focus on data clarity and efficient workflows

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Structure**: RESTful API endpoints under `/api/*` prefix
- **Build System**: Vite for frontend, esbuild for server bundling
- **Development**: Hot module replacement via Vite dev server

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` - shared between client and server
- **Validation**: Zod schemas generated from Drizzle schemas via drizzle-zod
- **Storage Interface**: Abstracted storage interface (`IStorage`) with in-memory implementation that can be swapped for database

### Key Data Models
- **Employee**: id, name, employeeId, department, rfidId, fingerprintId, photoUrl
- **Attendance**: id, employeeId, checkIn, checkOut, date, method
- **PendingRfidScan**: temporary storage for RFID scans during registration

### IoT Integration
- **Hardware**: ESP32 DevKit with RFID reader, LCD display, and fingerprint sensor
- **Communication**: HTTP API calls from ESP32 to Express backend
- **Authentication Flow**: RFID scan → employee lookup → fingerprint 2FA verification → attendance record

### Project Structure
```
├── client/           # React frontend
│   └── src/
│       ├── components/   # UI components (shadcn/ui)
│       ├── pages/        # Route pages (Dashboard, Employees, Attendance)
│       ├── hooks/        # Custom React hooks
│       └── lib/          # Utilities and query client
├── server/           # Express backend
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Data access layer
│   └── static.ts     # Static file serving
├── shared/           # Shared types and schemas
│   └── schema.ts     # Drizzle schema definitions
└── migrations/       # Database migrations
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database (configured via `DATABASE_URL` environment variable)
- **Drizzle Kit**: Database migrations and schema push via `db:push` script
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### UI/Frontend Libraries
- **Radix UI**: Comprehensive set of accessible UI primitives
- **Lucide React**: Icon library
- **date-fns**: Date manipulation and formatting with Indonesian locale support
- **react-hook-form**: Form state management with Zod resolver
- **embla-carousel-react**: Carousel component
- **cmdk**: Command palette component
- **vaul**: Drawer component
- **recharts**: Charting library

### Build Tools
- **Vite**: Frontend build and dev server with React plugin
- **esbuild**: Server-side bundling for production
- **TypeScript**: Type checking and compilation
- **PostCSS/Autoprefixer**: CSS processing

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal**: Error overlay in development
- **@replit/vite-plugin-cartographer**: Development tooling
- **@replit/vite-plugin-dev-banner**: Development banner