# Waiver Management System

## Overview
This project is a full-stack waiver management system designed for Skate & Play. It enables customers to digitally sign waivers, including support for multiple submissions with the same phone number and the inclusion of minors. The system provides customers with a dashboard to view their waiver history and offers comprehensive administrative tools for managing customers, staff, and feedback. The core business vision is to modernize waiver processes, improve customer experience, and streamline operations for businesses like Skate & Play, offering market potential for digital transformation in recreational facilities.

## User Preferences
I prefer simple language in explanations. I want iterative development, with frequent, small updates rather than large, infrequent ones. Please ask before making major changes or architectural decisions. Do not make changes to the `Backend-old` folder or any duplicate components.

## Recent Changes (October 27, 2025)
- **Signature Page Data Loading**: Fixed `getMinors` endpoint to return complete customer information (first_name, last_name, dob, address, etc.) along with minors, resolving issue where signature page showed blank fields after OTP verification.
- **Minor Management Functionality**: Implemented complete add/update/delete operations for minors in `saveSignature` endpoint. The system now properly:
  - Adds new minors to the database
  - Updates existing minors when modified
  - Deletes minors that are removed from the UI
  - Honors check/uncheck status for each minor
  - Ensures UI changes persist correctly across page reloads

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
The database is designed with `customers`, `waiver_forms`, `minors`, `otps`, `staff`, and `feedback` tables, allowing one customer to have multiple waiver entries. Transaction support is implemented for waiver creation to ensure data integrity. Optimized database queries and batch operations are used for performance.

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