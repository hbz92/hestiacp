/**
 * ===========================================
 * Routes des Formulaires
 * ===========================================
 * 
 * Routes publiques:
 * - POST /api/forms/submit - Soumettre un formulaire
 * 
 * Routes protégées (admin):
 * - GET /api/projects/:projectId/forms/submissions
 * - GET /api/projects/:projectId/forms/submissions/:submissionId
 * - PUT /api/projects/:projectId/forms/submissions/:submissionId
 * - DELETE /api/projects/:projectId/forms/submissions/:submissionId
 * - GET /api/projects/:projectId/forms/count
 */

const express = require('express');

const formController = require('../controllers/formController');
const { authenticate, authorizeProjectOwner } = require('../middleware/auth');

// ===========================================
// ROUTE PUBLIQUE (soumission de formulaire)
// ===========================================

const publicRouter = express.Router();

/**
 * POST /api/forms/submit
 * Endpoint public pour recevoir les soumissions de formulaires
 */
publicRouter.post('/submit', formController.submitForm);

// ===========================================
// ROUTES ADMIN (montées sous /projects/:projectId/forms)
// ===========================================

const adminRouter = express.Router({ mergeParams: true });

// Toutes les routes admin nécessitent authentification
adminRouter.use(authenticate);

/**
 * GET /api/projects/:projectId/forms/submissions
 * Liste les soumissions du projet
 */
adminRouter.get('/submissions', authorizeProjectOwner, formController.listSubmissions);

/**
 * GET /api/projects/:projectId/forms/count
 * Compte les nouvelles soumissions
 */
adminRouter.get('/count', authorizeProjectOwner, formController.countNew);

/**
 * GET /api/projects/:projectId/forms/submissions/:submissionId
 * Détails d'une soumission
 */
adminRouter.get('/submissions/:submissionId', authorizeProjectOwner, formController.getSubmission);

/**
 * PUT /api/projects/:projectId/forms/submissions/:submissionId
 * Met à jour une soumission (statut, notes)
 */
adminRouter.put('/submissions/:submissionId', authorizeProjectOwner, formController.updateSubmission);

/**
 * DELETE /api/projects/:projectId/forms/submissions/:submissionId
 * Supprime une soumission
 */
adminRouter.delete('/submissions/:submissionId', authorizeProjectOwner, formController.deleteSubmission);

// Export des deux routers
module.exports = {
  publicRouter,
  adminRouter
};
