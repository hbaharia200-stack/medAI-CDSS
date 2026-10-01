# MedAI-CDSS

**AI-Assisted Clinical Decision Support System**

MedAI-CDSS is a healthcare software platform designed to support patient intake, clinical review, nurse workflows, diagnostic assistance, and AI-assisted decision support.

The system connects three main interfaces:

- **Patient Mobile Application**
- **Nurse Mobile Application**
- **Doctor / Admin Web Application**

Its goal is to improve the flow of clinical information between patients, nurses, and doctors while integrating AI recommendations as decision-support tools.

---

## Project Overview

MedAI-CDSS provides a structured healthcare workflow where patients can submit symptoms, healthcare staff can review cases, nurses can manage assigned tests, and doctors can use AI-assisted recommendations during clinical assessment.

The AI component is intended to support healthcare professionals and does **not replace clinical judgment**.

---
Main Features

Patient Mobile App
- Patient registration and sign-in
- Location permission
- Guided symptom intake
- Multi-stage clinical intake
- English and Swahili language support
- AI-assisted patient communication
- Disease probability presentation
- Estimated healthcare costs
- Nearby hospital information
- Estimated travel time
- Appointment booking
- Case and test status tracking
  
Nurse Mobile App
- Staff authentication
- Patient queue
- View patient information
- Receive recommended tests
- Update test progress
- Send completed test information back to the clinical workflow

Doctor / Admin Web App
- Doctor and admin authentication
- Patient case queue
- Clinical case review
- Diagnosis management
- AI-assisted disease recommendations
- Recommended test assignment
- Send test requests to nurses
- Appointment management
- Billing
- Statistics and analytics
- Medical device management
- Messages and communication tools
## Co

```text
Patient
   |
   | Submit personal details and symptoms
   v
Backend API
   |
   +----------------------+
   |                      |
   v                      v
Doctor / Admin          Nurse
Web Dashboard           Mobile App
   |                      |
   | Reviews case         | Receives assigned tests
   | Uses AI support      | Performs / updates tests
   |                      |
   +----------+-----------+
              |
              v
       Clinical Decision
              |
              v
      Patient Follow-up


Technology Stack
Backend
- Python
- Flask
- REST API
- JWT Authentication
- SQLAlchemy
- Role-based access control
Web Application
- React
- TypeScript
- Vite
- Tailwind CSS
Mobile Application
- React Native
- Expo
- TypeScript
