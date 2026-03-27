# Frontend Implementation Report: Automated Tender Intelligent System (ATIS)

This document provides a comprehensive overview of the frontend architecture, design system, and integration points for the backend developer.

## 1. Technical Stack
- **Framework**: React 18+ (Vite)
- **Styling**: Tailwind CSS + DaisyUI (Custom 'tias' dark theme)
- **Animations**: Framer Motion (for transitions, smooth reveals, and persistent background effects)
- **Icons**: Lucide React
- **HTTP Client**: Axios (pre-configured with interceptors)

## 2. Core UI Components & Responsiveness
The system is built with a **Mobile-First** approach using a responsive layout persistent across all views.

### Layout ([src/components/layout/Layout.jsx](frontend/src/components/layout/Layout.jsx))
- **Sidebar**: Desktop-only fixed sidebar with professional high-end styling.
- **Mobile Menu**: Drawer-based overlay for mobile devices.
- **Header**: Contains universal search, notification triggers, and profile management.

### Responsive Breakpoints
- **Mobile (< 768px)**: Hidden sidebar, top bar with breadcrumbs and hamburger menu.
- **Desktop (>= 1024px)**: Fixed 280px sidebar, expanded navigation menus, and grid-based dashboards.

---

## 3. Visual Language & Animations
- **Theme**: Premium Dark Theme with Red accents (`#ef4444`).
- **Glassmorphism**: Cards use `.glass-card` and `.glass-strong` (defined in `index.css`) for a high-end feel with backdrop-blur effects.
- **Animated Background**: A persistent CSS-based animation system (gradient blobs + grid + particle noise) implemented in `index.css`.

---

## 4. Modal System (Backend Ready)
A reusable modal system is implemented in `src/components/ui/Modal.jsx`. 

### Key Modals Wired:
1. **Search Modal**: Triggered via `Header` or `Dashboard`. Needs POST/GET integration for tender filtering.
2. **Tender Details**: Dynamic modal in `DashboardView.jsx` (`selectedTender` state). Expects a full tender object.
3. **Logout Confirmation**: Integrated in `Sidebar.jsx`. Ready for auth-token clearing logic.
4. **Notifications/Profile**: Placeholder modals in `Layout.jsx` ready for user-service data.

---

## 5. API Integration Layer
The frontend is already configured to talk to a backend. See **[src/services/api.js](frontend/src/services/api.js)**.

### Configuration
- **Base URL**: `http://localhost:8000` (configurable via `VITE_API_URL` env variable).
- **Interceptors**: 
  - **Request**: Automatically attaches `Authorization: Bearer <token>` from `localStorage`.
  - **Response**: Global error handling for 401 (Unauthorized) status codes.

### Current Service Definitions (Ready to Connect):
| Service | Method | Endpoint | Purpose |
| :--- | :--- | :--- | :--- |
| `tenderAPI.getAll` | GET | `/tenders` | Fetch all indexed tenders |
| `tenderAPI.getById` | GET | `/tenders/:id` | Detailed view for a specific tender |
| `tenderAPI.getSummary` | GET | `/tenders/:id/summary` | Get AI-generated summary of a tender |
| `tenderAPI.updateStatus` | PATCH | `/tenders/:id/status` | Update tender status (relevant, ignored, etc) |
| `alertAPI.getAll` | GET | `/alerts` | Fetch system/tender alerts |
| `configAPI.getSettings`| GET | `/settings` | User preferences and search keywords |

---

## 6. Frontend Data Structures (Mocks)
The backend should aim to return data in the following structures (currently mocked in `DashboardView.jsx`):

### Tender Object
```json
{
  "id": "uuid",
  "title": "Network Infrastructure Upgrade",
  "organization": "Ministry of Communications",
  "deadline": "2026-04-15",
  "value": "$2.5M",
  "priority": "High",
  "status": "new",
  "description": "Full tender details go here..."
}
```

### Dashboard Stats
```json
{
  "total": 156,
  "relevant": 43,
  "pending": 18,
  "success_rate": "87%"
}
```

---

## 7. Next Steps for Backend Development
1. **Endpoints**: Implement the routes defined in `api.js`.
2. **Auth**: The frontend expects a JWT token in `localStorage` under the key `auth_token`.
3. **CORS**: Ensure the backend allows requests from `http://localhost:5173` (default Vite port).
4. **Real-time**: Consider WebSockets or SSE for the "Alerts" feature to push new tender matches.

---
*Report generated for handover to Backend Team.*
