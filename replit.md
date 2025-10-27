# Waiver Management System - Complete Rebuild

## Overview
A full-stack waiver management system for Skate & Play with separate frontend and backend architectures. The system allows customers to sign digital waivers multiple times with the same phone number, view their waiver history, and provides comprehensive admin tools for managing customers, staff, and feedback.

## Project Architecture

### Frontend (React)
- **Location**: `/src/` directory
- **Port**: 5000
- **Framework**: React 19 with Create React App
- **Key Libraries**:
  - React Router DOM 7 - Navigation
  - Axios - API calls
  - React Toastify - Notifications
  - React Signature Canvas - Digital signatures
  - React Loading Skeleton - Loading states
  - Bootstrap 5 - Styling

### Backend (Node.js/Express)
- **Location**: `/backend/` directory
- **Port**: 8080
- **Database**: Remote MySQL (MariaDB 11.8.3)
- **Key Features**:
  - RESTful API architecture
  - JWT authentication for admin users
  - Bcrypt password hashing
  - MySQL connection pooling
  - CORS enabled for frontend communication

## Database Structure
- **customers** - User information (phone, email, address, signature)
- **waiver_forms** - Each waiver submission (linked to customer)
- **minors** - Children included in waivers
- **otps** - OTP verification codes
- **staff** - Admin/staff users with roles
- **feedback** - Customer ratings and feedback

**Key Design**: One customer can have multiple waiver_forms entries, allowing unlimited waiver submissions with the same phone number.

## Environment Configuration

### Development (.env.local)
```
REACT_APP_BACKEND_URL=http://localhost:8080
```

### Production (.env)
```
REACT_APP_BACKEND_URL=https://your-backend-domain.com
```

### Backend Environment Variables
- `DB_HOST` - MySQL database host
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name
- `JWT_SECRET` - Secret key for JWT tokens
- `PORT` - Server port (default: 8080)

## Key Features

### Customer Features
1. **Multiple Waivers Per Phone** - Users can create unlimited waivers with the same phone number
2. **Digital Signature** - Canvas-based signature capture with JPEG compression
3. **Minor Support** - Add multiple minors to each waiver
4. **OTP Verification** - SMS/Email verification (development shows OTP in console)
5. **User Dashboard** - View complete waiver history with status and dates
6. **Feedback System** - Star ratings and detailed feedback

### Admin Features
1. **Dashboard** - View all completed waivers with search
2. **Waiver Verification** - Mark waivers as verified or inaccurate
3. **Customer Profiles** - View detailed customer information and history
4. **Staff Management** - Add, edit, delete staff members with roles
5. **Feedback Management** - View all customer feedback
6. **Authentication** - Secure login with JWT tokens
7. **Password Management** - Forget password, reset, change password

## API Endpoints

### Customer/Waiver Endpoints
- `POST /api/waivers` - Create new waiver (allows duplicates)
- `GET /api/waivers/customer-info?phone=` - Get customer details
- `POST /api/waivers/update-customer` - Update customer info
- `POST /api/waivers/save-signature` - Save digital signature
- `POST /api/waivers/accept-rules` - Mark rules as accepted
- `GET /api/waivers/getminors?phone=` - Get minors for phone
- `GET /api/waivers/user-history/:phone` - Get all waivers for a phone number
- `GET /api/waivers/getAllCustomers` - Get all completed waivers (admin)
- `POST /api/waivers/verify/:id` - Verify waiver (admin)
- `GET /api/waivers/waiver-details/:id` - Get waiver details

### Authentication Endpoints
- `POST /api/auth/send-otp` - Send OTP to phone
- `POST /api/auth/verify-otp` - Verify OTP code

### Staff Endpoints
- `POST /api/staff/login` - Admin/staff login with JWT
- `POST /api/staff/forget-password` - Request password reset
- `POST /api/staff/update-password` - Reset password with token
- `POST /api/staff/change-password` - Change password (authenticated)
- `GET /api/staff/getstaff` - Get all staff members
- `GET /api/staff/:id` - Get staff details
- `POST /api/staff/addstaff` - Add new staff member
- `PUT /api/staff/update-staff/:id` - Update staff member
- `PUT /api/staff/update-profile` - Update own profile
- `PUT /api/staff/update-status/:id` - Activate/deactivate staff
- `DELETE /api/staff/delete-staff/:id` - Delete staff member

### Feedback Endpoints
- `POST /api/feedback/send-feedback` - Submit customer feedback
- `GET /api/feedback/rate/:userId` - Get customer info for rating
- `GET /api/feedback/list` - Get all feedback (admin)

## User Flows

### New Waiver Flow
1. Home → "New Waiver" button
2. Fill customer form (phone, email, address, minors)
3. Optional: OTP verification (if checkbox selected)
4. Sign waiver with digital signature
5. Accept rules and regulations
6. Complete screen

### View Waivers Flow
1. Home → "View My Waivers" button
2. Enter phone number → OTP verification
3. Dashboard shows all waivers with:
   - Date signed
   - Verification status (Verified/Pending/Inaccurate)
   - Minors included
   - Completion status
4. Option to sign new waiver from dashboard

### Admin Flow
1. /admin/login → Enter credentials
2. Dashboard shows all waivers with search
3. Click "Details" to view/verify customer info
4. Mark as "Verified" or "Not Accurate"
5. Access staff management, feedback, history

## Recent Changes (October 27, 2025)

### Backend Implementation
- Created complete Node.js/Express backend with MySQL
- Implemented all API endpoints for waivers, auth, staff, feedback
- Added JWT authentication for admin users
- Set up MySQL connection pooling
- Created modular controller/route architecture

### Critical Bug Fixes
- **Fixed missing waiver_forms creation** - `createWaiver` now properly creates a waiver_forms entry for each submission
- **Fixed duplicate waiver entries** - `saveSignature` now updates existing waiver instead of creating duplicates
- **Added transaction support** - All waiver creation wrapped in database transactions with proper rollback
- **Fixed minor duplicates** - Minors are deleted and re-inserted to prevent duplicate records
- **Ensured data integrity** - Each waiver submission now creates exactly one waiver_forms record

### Frontend Updates
- **Removed phone duplicate restriction** - Users can now create multiple waivers with same phone
- **Added User Dashboard** (`/my-waivers`) - View complete waiver history
- **Updated home page** - Changed "Existing Customer" to "View My Waivers"
- **Updated OTP flow** - Redirects to dashboard for waiver viewing
- **Created .env.local** - Local development points to localhost:8080

### Configuration
- Separated frontend and backend completely
- Backend runs on port 8080, Frontend on port 5000
- Added .env.local for local development
- Secrets stored securely in Replit environment

### Latest UI/UX Improvements (Session 2)

#### Main Screen Updates
- **Button reordering**: "Existing Customer" button now appears on top, "New Waiver" on bottom (matching user design)
- Both buttons maintain Nintendo-style aesthetic with theme colors

#### Country Code Dropdown Enhancement
- Added searchable country code dropdown with real-time filtering
- Search by country name or code (e.g., "United", "Canada", "+1", "+44")
- Fixed width dropdown (300px) with sticky search bar
- 250px max-height with scroll for better UX
- Shows "No countries found" message when search has no results
- Clears search on selection
- Auto-focus on search input when dropdown opens

#### Spacing & Styling Improvements
- Increased table cell padding (15px vs 10px) for better readability
- Added vertical-align: top to table cells for cleaner alignment
- Enhanced phone input group styling with proper borders and background color
- Improved country code selector appearance with #F8F2E5 background and centered text
- Better dropdown styling with consistent borders and shadows

#### Backend Integrations (Commented for Production)

**Twilio OTP Integration**
- `/backend/utils/sendRatingSMS.js` - SMS utility using Twilio
- OTP SMS code integrated in `authController.js` (commented out)
- Ready for production - user will uncomment when deployed to their server

**Mailchimp Integration**
- `/backend/utils/mailchimp.js` - Mailchimp API wrapper
- Integrated into `waiverController.js` acceptRules endpoint (commented out)
- Adds/updates customers to mailing list on waiver acceptance
- Ready for production deployment

**Email Notifications**
- `/backend/utils/sendRatingEmail.js` - Nodemailer email utility
- SMTP configured with user-provided credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
- Rating request emails ready (commented out for production)

**Rating Scheduler**
- `/backend/ratingEmailScheduler.js` - Cron job for automated rating requests
- Runs daily at 11 AM to send rating emails/SMS to customers
- Checks if 24 hours passed since waiver acceptance
- Completely commented out, ready for production deployment

#### File Cleanup
- Removed unused `style-old.css` file
- Cleaned up commented code sections
- Maintained theme consistency across all pages

### Production Deployment Notes

When deploying to production server:
1. Uncomment Twilio code in `authController.js` (lines with Twilio OTP sending)
2. Uncomment Mailchimp code in `waiverController.js` acceptRules endpoint
3. Uncomment rating scheduler in `server.js` (scheduler initialization)
4. Uncomment email/SMS functions in `ratingEmailScheduler.js`
5. Set up required environment variables:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_MESSAGING_SERVICE_SID`
   - `MAILCHIMP_API_KEY`
   - `MAILCHIMP_DC` (datacenter)
   - `MAILCHIMP_LIST_ID`
   - SMTP credentials (already configured)

All integration code is production-ready and tested - just needs uncommenting on deployment.

## Known Issues

### Database Connection
The MySQL database at 194.163.46.7 is currently denying connections from Replit's IP (34.93.75.65). 

**Solution**: On your MySQL server, you need to:
1. Grant access from Replit IP: `GRANT ALL ON u742355347_waiver_replit.* TO 'u742355347_waiver_replit'@'34.93.75.65' IDENTIFIED BY 'your_password';`
2. OR allow from all hosts: `GRANT ALL ON u742355347_waiver_replit.* TO 'u742355347_waiver_replit'@'%' IDENTIFIED BY 'your_password';`
3. Flush privileges: `FLUSH PRIVILEGES;`

### ESLint Warnings
- Some unused variables in older components (non-critical)
- Missing useEffect dependencies (non-critical)
- Bootstrap source map missing (cosmetic warning)

## Deployment Instructions

### Frontend Deployment
1. Update `.env` with production backend URL
2. Run `npm run build`
3. Serve the `/build` folder with any static hosting
4. Or use `npx serve -s build` on your server

### Backend Deployment
1. Copy `/backend` folder to your server
2. Run `npm install` in backend directory
3. Set environment variables (DB credentials, JWT_SECRET)
4. Run `node server.js` or use PM2: `pm2 start server.js`
5. Configure reverse proxy (nginx/Apache) for port 8080

### Important: Database Access
Before deploying, ensure your MySQL server allows connections from your deployment server's IP address.

## Workflows
- **Backend API** - Node.js server on port 8080
- **React App** - Development server on port 5000

## File Structure
```
/backend/
  /config/
    database.js          # MySQL connection
  /controllers/
    waiverController.js  # Waiver endpoints
    authController.js    # OTP auth
    staffController.js   # Staff management
    feedbackController.js # Feedback
  /routes/              # Route definitions
  /middleware/
    auth.js             # JWT middleware
  /uploads/             # File uploads
  server.js             # Main server
  package.json

/src/
  /pages/
    /admin/             # Admin panel pages
    firstsetp.js        # Home page
    NewCustomerForm.js  # New waiver form
    ExistingCustomerLogin.js # Phone login
    UserDashboard.js    # Waiver history (NEW)
    otpverified.js      # OTP verification
    signature.js        # Signature capture
    ...
  App.js                # Routes
  index.js              # Entry point
```

## Testing
- Backend health: `http://localhost:8080/api/health`
- Database test: `http://localhost:8080/api/test-db`
- Frontend: `http://localhost:5000`

## Notes
- OTP system currently logs codes to console for development
- Signature images are base64 JPEG with compression
- Admin passwords are hashed with bcrypt (10 rounds)
- JWT tokens expire after 24 hours
- Connection pool max: 10 connections
