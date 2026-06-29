# LeapMentor Backend — DevOps & Deployment Guide

> **Audience:** DevOps engineers, backend developers, and anyone responsible for deploying and maintaining the LeapMentor backend.
>
> This document describes the deployment process, required infrastructure, environment configuration, database migrations, monitoring, and operational best practices for the backend application.

---

# Table of Contents

* Overview
* Deployment Architecture
* Prerequisites
* Environment Variables
* Initial Server Setup
* Application Deployment
* Docker Deployment
* Database Configuration
* Running Migrations
* Seeding Initial Data
* Reverse Proxy (Nginx)
* SSL Configuration
* Process Management (PM2)
* Logging & Monitoring
* Redis Configuration
* File Storage
* Background Jobs
* Backup Strategy
* Updating the Application
* Rollback Procedure
* Health Checks
* Troubleshooting
* Production Checklist

---

# Overview

The LeapMentor backend is a Node.js Express application backed by MongoDB and Redis. It exposes REST APIs, supports Socket.IO for real-time communication, runs scheduled cron jobs, and integrates with several third-party services.

Core infrastructure includes:

* Node.js
* MongoDB
* Redis
* Nginx
* PM2
* Docker (optional)
* Cloudinary
* SMTP Mail Server
* Sentry
* Better Stack (Logtail)

---

# Deployment Architecture

```text
                Internet
                    │
                    ▼
              Nginx (HTTPS)
                    │
                    ▼
            Node.js Backend (PM2)
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
    MongoDB                  Redis
        │
        ▼
   Cloudinary / SMTP / External APIs
```

---

# Prerequisites

Before deployment, ensure the server has:

* Ubuntu 22.04 LTS (recommended)
* Git
* Node.js (LTS version)
* npm
* MongoDB
* Redis
* Nginx
* PM2
* Docker (optional)
* OpenSSL
* SSL certificate

---

# Environment Variables

Create a `.env` file in the project root.

The following values should be configured:

* Application Port
* MongoDB URI
* Redis URL
* JWT Secret
* Refresh Token Secret
* Calendar Encryption Key
* SMTP Credentials
* Cloudinary Credentials
* Google OAuth Credentials
* Clerk Credentials
* Better Stack Token
* Sentry DSN
* Platform URLs
* Cookie Configuration
* Session Configuration

Never commit `.env` files to source control.

---

# Initial Server Setup

## Clone Repository

```bash
git clone <repository-url>
cd backend
```

Install dependencies.

```bash
npm install
```

---

# Database Configuration

Start MongoDB.

Verify the connection.

Ensure the configured MongoDB user has:

* read
* write
* index creation permissions

---

# Redis Configuration

Start Redis.

Verify connectivity.

Redis is used for:

* application caching
* session data
* cache invalidation
* temporary storage

---

# Running Database Migrations

The project uses **migrate-mongo**.

Run pending migrations.

```bash
npx migrate-mongo up
```

View migration status.

```bash
npx migrate-mongo status
```

Rollback last migration.

```bash
npx migrate-mongo down
```

---

# Seeding Initial Data

For a fresh deployment run:

```bash
node scripts/seedAdmin.js
```

```bash
node scripts/seedPlatformCommission.js
```

These scripts only need to be executed once per environment.

---

# Starting the Application

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

---

# Running with PM2

Start the application.

```bash
pm2 start server.js --name leapmentor-backend
```

Save PM2 configuration.

```bash
pm2 save
```

Enable startup on reboot.

```bash
pm2 startup
```

View logs.

```bash
pm2 logs leapmentor-backend
```

Restart application.

```bash
pm2 restart leapmentor-backend
```

Stop application.

```bash
pm2 stop leapmentor-backend
```

---

# Docker Deployment

Build image.

```bash
docker build -t leapmentor-backend .
```

Run container.

```bash
docker run -d \
  --name leapmentor-backend \
  --env-file .env \
  -p 3000:3000 \
  leapmentor-backend
```

View logs.

```bash
docker logs leapmentor-backend
```

Stop container.

```bash
docker stop leapmentor-backend
```

---

# Nginx Configuration

Nginx acts as the reverse proxy.

Responsibilities include:

* HTTPS termination
* Reverse proxy
* Static compression
* Request forwarding
* WebSocket support

Typical flow:

```text
Client
   │
HTTPS
   │
Nginx
   │
localhost:3000
```

---

# SSL Configuration

Install SSL certificates.

Recommended:

* Let's Encrypt
* Certbot

Verify:

* HTTPS redirects
* Certificate renewal
* Secure cookies
* HSTS configuration

---

# Background Jobs

Cron jobs automatically start from:

```text
server.js
```

Jobs include:

* Session reminders
* Availability cleanup

No additional configuration is required once the application starts.

---

# Socket.IO

Socket.IO starts automatically from `server.js`.

Ensure the reverse proxy supports:

* WebSocket upgrade
* Connection persistence
* Appropriate timeout values

---

# File Storage

Uploaded files are stored in Cloudinary.

Before deployment verify:

* Cloud Name
* API Key
* API Secret

Uploads should never be stored on the application server.

---

# Email Configuration

Configure SMTP credentials.

Verify:

* SMTP Host
* SMTP Port
* Username
* Password
* Sender Address

Test email delivery after deployment.

---

# Monitoring

The application supports:

* Sentry
* Better Stack (Logtail)
* Winston Logger

Verify all monitoring credentials before production deployment.

---

# Logging

Logs include:

* application logs
* request logs
* error logs
* uncaught exceptions

Monitor logs regularly using PM2 or your centralized logging platform.

---

# Health Checks

Verify:

* Application starts successfully
* MongoDB connectivity
* Redis connectivity
* `/api-docs` loads correctly
* API endpoints respond successfully
* Socket.IO connections succeed
* Scheduled jobs initialize

---

# Updating the Application

Pull the latest code.

```bash
git pull origin main
```

Install dependencies.

```bash
npm install
```

Run migrations.

```bash
npx migrate-mongo up
```

Restart the application.

```bash
pm2 restart leapmentor-backend
```

Verify application health.

---

# Rollback Procedure

If deployment fails:

1. Checkout the previous release.
2. Install dependencies.
3. Roll back database migration if required.
4. Restart PM2.
5. Verify health endpoints.

---

# Backup Strategy

Schedule regular backups for:

* MongoDB
* Environment files
* SSL certificates
* PM2 ecosystem configuration
* Nginx configuration

Cloudinary assets remain managed by Cloudinary.

---

# Troubleshooting

## Application won't start

Check:

* `.env`
* Node version
* MongoDB connectivity
* Redis connectivity

---

## Database connection fails

Verify:

* MongoDB URI
* Credentials
* Firewall rules

---

## Redis unavailable

Verify:

* Redis service
* Connection string
* Port accessibility

---

## Emails not sending

Check:

* SMTP credentials
* Firewall
* Mail provider restrictions

---

## Cloudinary uploads failing

Verify:

* API Key
* API Secret
* Cloud Name

---

## Socket.IO not connecting

Verify:

* Nginx WebSocket configuration
* Reverse proxy headers
* Firewall rules

---

# Production Checklist

Before every production deployment:

* Pull latest source code
* Install dependencies
* Verify `.env`
* Run database migrations
* Seed initial data (new environments only)
* Build Docker image (if applicable)
* Restart PM2
* Verify MongoDB connectivity
* Verify Redis connectivity
* Verify Cloudinary configuration
* Verify SMTP configuration
* Verify Google OAuth credentials
* Verify Clerk configuration
* Verify Sentry reporting
* Verify Better Stack logging
* Verify `/api-docs`
* Verify WebSocket connectivity
* Verify cron jobs
* Execute smoke tests
* Monitor logs after deployment
* Confirm application health before announcing deployment
