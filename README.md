# Blueprint_NPSP

**Blueprint_NPSP** is a web application developed as part of the **National Preclinical Sepsis Program (NPSP)**. It provides a unified platform for managing multi-center animal model studies focused on sepsis. This tool ensures standardization across experimental sites, improves data traceability, and enhances collaboration between research teams.

## Features

- **Responsive web interface** built with React.js
- **Secure backend API** developed using Node.js and Express
- **PostgreSQL database** for structured data management
- **Role-based user access** for admins, HQPs, and collaborators
- **Multi-step dynamic forms** for tracking animal housing, injections, treatments, and more
- **JWT-based authentication** to secure sensitive data
- **Admin dashboard** to visualize site-wise data and manage form progress
- **CI/CD-ready structure**, deployable on platforms like Heroku

## Installation Instructions

1. **Clone the repository**
2. **Install dependencies**
Navigate to both the frontend and backend directories and run: npm install

3. **Set up environment variables**
Create a `.env` file in the backend folder with the following:
- `PORT=your_backend_port`
- `DATABASE_URL=your_postgres_connection_string`
- `JWT_SECRET=your_secret_key`

4. **Run the servers**
- Backend: `npm start` or `nodemon`
- Frontend: `npm start`

## Tech Stack

- **Frontend**: React.js, HTML, CSS, JavaScript
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Authentication**: JSON Web Tokens (JWT)
- **Hosting/Deployment**: Heroku

## Contribution

This repository is actively maintained for research and development purposes.


