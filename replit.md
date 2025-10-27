# Waiver Management System

## Overview
This project is a full-stack waiver management system designed for Skate & Play. It enables customers to digitally sign waivers, including support for multiple submissions with the same phone number and the inclusion of minors. The system provides customers with a dashboard to view their waiver history and offers comprehensive administrative tools for managing customers, staff, and feedback. The core business vision is to modernize waiver processes, improve customer experience, and streamline operations for businesses like Skate & Play, offering market potential for digital transformation in recreational facilities.

## User Preferences
I prefer simple language in explanations. I want iterative development, with frequent, small updates rather than large, infrequent ones. Please ask before making major changes or architectural decisions. Do not make changes to the `Backend-old` folder or any duplicate components.

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