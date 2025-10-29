# Waiver Management System

## Overview
This project is a full-stack waiver management system designed for businesses like Skate & Play. It enables customers to digitally sign waivers, including support for multiple submissions with the same phone number and the inclusion of minors. The system provides customers with a dashboard to view their waiver history and offers comprehensive administrative tools for managing customers, staff, and feedback. The core business vision is to modernize waiver processes, improve customer experience, and streamline operations for recreational facilities, offering significant market potential for digital transformation.

## Recent Changes (October 29, 2025)

### Database Architecture Redesign - Complete
Successfully implemented "one user per phone number" architecture with historical snapshot preservation:

**✅ Database Migration:**
- Dropped old tables: `customers`, `waiver_forms`
- Created new schema: `users`, `waivers` (with snapshot columns), `minors`, `waiver_minors`, `otps`, `staff`, `feedback`
- Snapshot columns on `waivers` table: `signer_name`, `signer_email`, `signer_address`, `signer_city`, `signer_province`, `signer_postal`, `signer_dob`, `minors_snapshot` (JSON)

**✅ Backend Controller Updates:**
- `createWaiver`: Now finds existing user by phone or creates new one (enforces single user per phone)
- `createWaiver`: Deactivates old minors before inserting new ones (prevents duplicate minors)
- `saveSignature`: Stores complete snapshot data when waiver is signed
- All admin endpoints (`getAllWaivers`, `getWaiverDetails`, `getAllCustomers`, `getUserHistory`): Updated to read from snapshot data instead of joining with live `users`/`minors` tables

**✅ Frontend Updates:**
- `UserDashboard`: Removed "Sign New Waiver" and "Home" buttons (users must logout to create new waiver)
- `UserDashboard`: Added "Logout" button that clears localStorage and redirects to home

**✅ Data Flow:**
1. First waiver: Creates new user + waiver (snapshot empty until signed)
2. Signature: Fills in snapshot with current user/minor data
3. Second waiver (same phone): Updates user info, deactivates old minors, creates new waiver with new snapshot
4. Admin views: Always show historical snapshot data, not current user data

**✅ Benefits:**
- Admins see waivers exactly as they were signed (historical accuracy)
- Users can update their info without affecting past waivers
- No more duplicate user records per waiver
- Clean data integrity with foreign key constraints

## User Preferences
I prefer simple language in explanations. I want iterative development, with frequent, small updates rather than large, infrequent ones. Please ask before making major changes or architectural decisions. Do not make changes to the `Backend-old` folder or any duplicate components.

## System Architecture

### UI/UX Decisions
The frontend features a Nintendo-style aesthetic with consistent theme colors. Key UI elements include searchable country code dropdowns with real-time filtering, comprehensive loading states, and clear visual feedback for form validations. Button reordering on the main screen prioritizes "Existing Customer" over "New Waiver."

### Technical Implementations
The system comprises a React frontend and a Node.js/Express backend.

**Frontend (React)**
-   **Framework**: React 19
-   **Routing**: React Router DOM 7
-   **API Communication**: Axios
-   **Notifications**: React Toastify
-   **Digital Signatures**: React Signature Canvas with JPEG compression
-   **Styling**: Bootstrap 5
-   **Loading States**: React Loading Skeleton
-   **Environment Configuration**: Centralized `config.js` for dynamic backend URL detection.

**Backend (Node.js/Express)**
-   **Architecture**: RESTful API
-   **Authentication**: JWT for admin users, Bcrypt for password hashing
-   **Database Interaction**: MySQL connection pooling
-   **Security**: CORS enabled, server-side input validation, comprehensive error handling, SQL injection prevention.
-   **Features**: Allows multiple waivers per phone number, supports adding multiple minors to a waiver, OTP verification, and admin dashboards.

### Feature Specifications
-   **Customer Features**: Unlimited waivers per phone, digital signature capture, minor support, OTP verification, user dashboard for waiver history, and a star rating feedback system.
-   **Admin Features**: Dashboard for completed waivers, waiver verification, detailed customer profiles, staff management (add, edit, delete, roles), feedback management, and secure authentication with password management.

### System Design Choices

**Database Schema**:
- **`users`**: Stores user information (one record per phone number), including current/latest contact details.
- **`waivers`**: Stores waiver records with historical snapshots of user data at the time of signing. Each waiver links to a user and includes snapshot columns for `signer_name`, `signer_email`, `signer_address`, `signer_dob`, and `minors_snapshot`.
- **`minors`**: Stores minor profiles, linked to users.
- **`waiver_minors`** (Junction Table): Links specific minors to specific waivers.
- **`otps`**: Stores temporary one-time passwords.
- **`staff`**: Stores admin and staff accounts with role-based access control.
- **`feedback`**: Stores customer ratings and feedback.

**Performance Optimizations**:
- Indexes on `users.cell_phone` and `waivers.user_id` for fast lookups.
- Foreign key constraints with CASCADE delete for data integrity.
- Batch queries for dashboard endpoint to minimize database round-trips.
- Transaction support for waiver creation.

**Data Integrity**:
- Foreign keys with CASCADE delete rules maintain referential integrity across `users`, `waivers`, `minors`, `waiver_minors`, and `feedback` tables.

## External Dependencies

-   **Database**: Remote MySQL (MariaDB 11.8.3)
-   **Authentication**: JSON Web Tokens (JWT)
-   **Password Hashing**: Bcrypt
-   **SMS/OTP**: Twilio
-   **Email Marketing**: Mailchimp
-   **Email Notifications**: Nodemailer (SMTP configured)
-   **Scheduling**: Node-cron for automated tasks.