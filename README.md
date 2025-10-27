# Waiver Management System - Frontend

## Overview
React-based frontend application for the Skate & Play Waiver Management System. Allows customers to sign digital waivers, view waiver history, and provides admin panel for management.

## Requirements
- Node.js 18+ or 20+
- npm or yarn

## Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env` file for production:

```env
REACT_APP_BACKEND_URL=https://your-backend-api.com
REACT_APP_GOOGLE_REVIEW_LINK=https://your-google-review-link
```

For local development, `.env.local` is already configured to use `http://localhost:8080`

## Development

### Start Development Server
```bash
npm start
```
The app will open at `http://localhost:5000`

### Build for Production
```bash
npm run build
```
Creates optimized production build in `/build` folder.

## Features

### Customer Features
- **New Waiver** - Create digital waiver with signature
- **Multiple Submissions** - Same phone number can create unlimited waivers
- **User Dashboard** - View all waiver history by phone number
- **OTP Verification** - Secure phone verification
- **Minor Support** - Add multiple minors to waivers
- **Feedback System** - Submit ratings and feedback

### Admin Features
- **Dashboard** - View all waivers with search
- **Verification** - Mark waivers as verified/inaccurate
- **Staff Management** - Add, edit, delete staff members
- **Customer Profiles** - Detailed customer information
- **Feedback Management** - View all customer feedback
- **Secure Authentication** - JWT-based login

## Deployment

### Option 1: Static Hosting (Netlify, Vercel, etc.)

#### Netlify
1. Build the app: `npm run build`
2. Deploy `/build` folder to Netlify
3. Set environment variable `REACT_APP_BACKEND_URL` in Netlify settings

#### Vercel
1. Connect your Git repository to Vercel
2. Set build command: `npm run build`
3. Set output directory: `build`
4. Add environment variable `REACT_APP_BACKEND_URL`

### Option 2: Traditional Server with Nginx

#### 1. Build the Application
```bash
npm run build
```

#### 2. Copy Build to Server
```bash
# On your local machine
scp -r build/* user@your-server:/var/www/waiver-frontend
```

#### 3. Configure Nginx
Create `/etc/nginx/sites-available/waiver-frontend`:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    root /var/www/waiver-frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

#### 4. Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/waiver-frontend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 5. Setup SSL
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### Option 3: Using serve (Simple deployment)
```bash
# Install serve globally
npm install -g serve

# Serve the build folder
serve -s build -l 5000

# Or with PM2
pm2 serve build 5000 --name waiver-frontend --spa
```

## Environment Variables

### REACT_APP_BACKEND_URL
**Required** - URL of your backend API
- Development: `http://localhost:8080`
- Production: `https://api.your-domain.com`

### REACT_APP_GOOGLE_REVIEW_LINK
**Optional** - Google review link for feedback
- Format: `https://g.page/r/YOUR_PLACE_ID/review`

## User Flows

### New Waiver
1. Home → "New Waiver"
2. Fill form (name, phone, email, address, minors)
3. Optional OTP verification
4. Sign waiver
5. Accept rules
6. Complete

### View Waivers
1. Home → "View My Waivers"
2. Enter phone → OTP verification
3. View waiver history dashboard
4. Option to sign new waiver

### Admin Login
1. Go to `/admin/login`
2. Enter credentials
3. Access dashboard, staff management, feedback

## Routes

### Public Routes
- `/` - Home page
- `/new-customer` - New waiver form
- `/existing-customer` - Phone login
- `/my-waivers` - User dashboard (after OTP)
- `/opt-verified` - OTP verification
- `/signature` - Sign waiver
- `/rules` - Rules acceptance
- `/complete` - Completion screen
- `/rate/:id` - Rating page
- `/feedback` - Feedback form

### Admin Routes (Protected)
- `/admin/login` - Admin login
- `/admin/home` - Admin dashboard
- `/admin/history` - Waiver history
- `/admin/staff-list` - Staff management
- `/admin/add-staff` - Add staff
- `/admin/feedback-list` - Feedback list
- `/admin/client-profile/:id` - Customer details
- `/admin/update-profile` - Update admin profile
- `/admin/change-password` - Change password

## Technology Stack
- React 19
- React Router DOM 7
- Axios - HTTP client
- React Toastify - Notifications
- Bootstrap 5 - Styling
- React Signature Canvas - Digital signatures
- React Loading Skeleton - Loading states
- Font Awesome - Icons

## Troubleshooting

### API Connection Issues
- Verify `REACT_APP_BACKEND_URL` is correct
- Check if backend server is running
- Ensure CORS is enabled on backend
- Check browser console for errors

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Runtime Errors
- Check browser console (F12)
- Verify environment variables
- Ensure backend is accessible

## Development Notes

### ESLint Warnings
Some ESLint warnings about unused variables and useEffect dependencies are present but don't affect functionality. These can be addressed in future updates.

### Source Maps
Bootstrap CSS source map warning is cosmetic and doesn't affect the application.

## Support
For issues or questions, contact your development team or system administrator.

## License
Proprietary - All rights reserved
