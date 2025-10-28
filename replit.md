# Waiver Management System

## Overview
This project is a full-stack waiver management system designed for Skate & Play. It enables customers to digitally sign waivers, including support for multiple submissions with the same phone number and the inclusion of minors. The system provides customers with a dashboard to view their waiver history and offers comprehensive administrative tools for managing customers, staff, and feedback. The core business vision is to modernize waiver processes, improve customer experience, and streamline operations for businesses like Skate & Play, offering market potential for digital transformation in recreational facilities.

## User Preferences
I prefer simple language in explanations. I want iterative development, with frequent, small updates rather than large, infrequent ones. Please ask before making major changes or architectural decisions. Do not make changes to the `Backend-old` folder or any duplicate components.

## Recent Changes

### October 28, 2025 - Route Protection & Browser History Management
- **Route Protection Implementation**: Added comprehensive guards to prevent direct URL access to protected pages:
  - All waiver flow pages (Signature, RuleReminder, AllDone, ConfirmCustomerInfo, UserDashboard) now validate required state
  - Users attempting to access protected pages directly are immediately redirected to home
  - Prevents form manipulation and ensures proper flow sequence
  
- **Browser History Management**: Fixed back button issues after waiver completion:
  - Updated all navigation to use `replace: true` to replace history entries instead of adding new ones
  - After completing a waiver, back button can no longer return to completed forms
  - Prevents duplicate submissions and user confusion
  
- **Enhanced Completion Flow**:
  - AllDone page now requires completion flag in state
  - Clears all localStorage data (signatureForm, customerForm) on completion
  - Auto-redirects to home after 5 seconds with cleared history
  
- **Protected Flows**:
  - **New Waiver**: New Waiver → OTP → Signature (guarded) → Rules (guarded) → AllDone (guarded) → Home
  - **Existing User**: Existing User → OTP → My Waivers (guarded) → Confirm Info (guarded) → Signature (guarded) → Rules (guarded) → AllDone (guarded) → Home
  - Direct URL access to any protected step redirects to home
  - Back navigation after completion blocked

### October 28, 2025 - Major Architecture Refactor
- **Multi-Customer-Per-Phone Architecture**: Completely refactored the system to support multiple customer records with the same phone number. The system now:
  - **Always creates NEW customer records** for each "New Waiver" signup, even if phone number already exists
  - Allows same phone number to have multiple customers with different names, addresses, and minors
  - Each customer represents a unique visit/signup with their own profile
  - **Existing User Dashboard**: Shows ALL customer records (visits) for a given phone number with complete history
  
- **Waiver-Specific Minors with Junction Table**: Implemented `waiver_minors` junction table for accurate minor tracking:
  - Minors are now linked to specific waivers (not just customer accounts)
  - Each waiver accurately tracks which minors were included in that visit
  - Dashboard displays correct minors for each historical waiver
  - Prevents confusion when same customer has different minors on different visits
  
- **Database Optimizations**: Added comprehensive performance improvements:
  - Performance indexes on `customers.cell_phone` and `waiver_forms.customer_id` for fast phone lookups
  - Foreign key constraints for data integrity (`waiver_forms` → `customers`, `minors` → `customers`, `waiver_minors` → `waiver_forms`/`minors`)
  - Cascade delete rules to maintain referential integrity
  - Optimized batch queries for dashboard endpoint
  
- **New Customer Dashboard Endpoint**: `GET /api/waivers/customer-dashboard?phone=X`:
  - Returns all customer records for a phone number
  - Each customer includes their waivers and waiver-specific minors
  - Efficiently batches queries to minimize database round-trips
  - Supports unlimited history per phone number
  
- **Updated User Flows**:
  - **New Waiver Flow**: Always creates separate customer → OTP verification → Signature → Rules → Completion
  - **Existing User Flow**: Phone login → OTP verification → **Dashboard** showing all visits (no longer goes to confirm-info)
  - Each visit in dashboard shows: date, customer name, address, minors for that specific visit, waiver status
  
- **Junction Table Synchronization**: Fixed critical bugs ensuring waiver_minors stays in sync:
  - `updateCustomer` now updates waiver_minors after minor edits
  - `saveSignature` now updates waiver_minors after signature completion
  - All minor add/remove/toggle operations properly sync to junction table

## Previous Changes (October 27, 2025)
- **Customer History Preservation Bug Fix**: Fixed critical bug where "New Waiver" signups with existing phone numbers were overwriting customer data
- **Signature Page Data Loading**: Fixed `getMinors` endpoint to return complete customer information
- **Minor Management Functionality**: Implemented complete add/update/delete operations for minors

## System Architecture

### UI/UX Decisions
The frontend features a Nintendo-style aesthetic with consistent theme colors. Key UI elements include searchable country code dropdowns with real-time filtering, comprehensive loading states, and clear visual feedback for form validations. Button reordering on the main screen prioritizes "Existing Customer" over "New Waiver" as per design.

### Technical Implementations
The system comprises a React frontend and a Node.js/Express backend.

**Frontend (React)**
-   **Framework**: React 19 with Create React App
-   **Routing**: React Router DOM 7
-   **API Communication**: Axios
-   **Notifications**: React Toastify
-   **Digital Signatures**: React Signature Canvas with JPEG compression
-   **Styling**: Bootstrap 5
-   **Loading States**: React Loading Skeleton
-   **Environment Configuration**: Centralized `config.js` for dynamic backend URL detection (development vs. production).

**Backend (Node.js/Express)**
-   **Architecture**: RESTful API
-   **Authentication**: JWT for admin users, Bcrypt for password hashing
-   **Database Interaction**: MySQL connection pooling
-   **Security**: CORS enabled, server-side input validation, comprehensive error handling, SQL injection prevention.
-   **Features**:
    -   Allows multiple waivers per phone number.
    -   Supports adding multiple minors to a waiver.
    -   OTP verification for customer actions.
    -   Admin dashboards for waiver verification, customer profiles, staff management, and feedback review.

### Feature Specifications
-   **Customer Features**: Unlimited waivers per phone, digital signature capture, minor support, OTP verification, user dashboard for waiver history, and a star rating feedback system.
-   **Admin Features**: Dashboard for completed waivers, waiver verification (verified/inaccurate), detailed customer profiles, staff management (add, edit, delete, roles), feedback management, and secure authentication with password management.

### System Design Choices

**Database Schema**:
- **`customers`**: Stores customer information (name, address, phone, etc.). Multiple customers can have the same phone number.
- **`waiver_forms`**: Stores waiver records. Each waiver links to one customer via `customer_id` foreign key.
- **`minors`**: Stores minor information. Each minor links to one customer via `customer_id` foreign key.
- **`waiver_minors`** (Junction Table): Links specific minors to specific waivers (many-to-many relationship). Enables tracking which minors were included in each visit.
- **`otps`**: Stores one-time passwords for phone verification.
- **`staff`**: Stores admin and staff accounts with role-based access.
- **`feedback`**: Stores customer ratings and feedback.

**Performance Optimizations**:
- Indexes on `customers.cell_phone` and `waiver_forms.customer_id` for fast phone-based queries
- Foreign key constraints with cascade delete for data integrity
- Batch queries for dashboard endpoint to minimize database round-trips
- Transaction support for waiver creation to ensure data consistency

**Data Integrity**:
- Foreign keys: `waiver_forms.customer_id` → `customers.id`
- Foreign keys: `minors.customer_id` → `customers.id`
- Foreign keys: `waiver_minors.waiver_id` → `waiver_forms.id`
- Foreign keys: `waiver_minors.minor_id` → `minors.id`
- Cascade delete rules maintain referential integrity when records are removed

## External Dependencies

-   **Database**: Remote MySQL (MariaDB 11.8.3)
-   **Authentication**: JSON Web Tokens (JWT)
-   **Password Hashing**: Bcrypt
-   **SMS/OTP**: Twilio (production-ready, currently commented out)
-   **Email Marketing**: Mailchimp (production-ready, currently commented out)
-   **Email Notifications**: Nodemailer (SMTP configured, production-ready, currently commented out)
-   **Scheduling**: Node-cron for automated rating request emails/SMS (production-ready, currently commented out)

## Production Deployment

### Environment Configuration
All sensitive configuration is managed through environment variables in `backend/.env`:
- **Database**: MySQL credentials (host, user, password, database name)
- **Security**: JWT secret for authentication
- **Twilio**: Account SID, Auth Token, Messaging Service SID for SMS/OTP
- **Email**: SMTP credentials (host, port, user, password) for transactional emails
- **Mailchimp**: API key, List ID, Data Center for marketing automation
- **URLs**: Frontend URL for CORS and rating links

### Deployment Resources
- **DEPLOYMENT_GUIDE.md**: Comprehensive step-by-step deployment instructions for production servers
- **ENABLE_FEATURES_GUIDE.md**: Instructions to enable optional features (email/SMS/Mailchimp)
- **setup-production.sh**: Automated setup script for quick deployment
- **backend/.env.example**: Complete template of all required environment variables

### Security Best Practices
- `.env` files are excluded from version control via `.gitignore`
- All API keys and secrets must be configured server-side only
- JWT secrets should be generated using cryptographically secure random values
- Database credentials should follow principle of least privilege
- CORS is configured but should be restricted to specific domains in production

### Optional Features (Ready to Enable)
All optional features are production-tested and commented out in the code, ready to be enabled when credentials are configured:
1. **Automated Rating Emails**: Sends rating requests 3 hours after waiver completion
2. **Automated Rating SMS**: SMS version of rating requests via Twilio
3. **Mailchimp Auto-Subscribe**: Automatically adds customers to marketing list
4. **OTP Verification**: SMS-based one-time password for customer authentication

See `ENABLE_FEATURES_GUIDE.md` for detailed activation instructions.