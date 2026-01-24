import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../../db/index.js', () => ({
  db: {
    query: {
      employees: {
        findMany: vi.fn(),
      },
      alertNotificationLogs: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
  },
  schema: {
    employees: {},
    alertNotificationLogs: {},
  },
}));

// Mock documentation status service
vi.mock('../../services/documentation-status.service.js', () => ({
  getDocumentationStatus: vi.fn(),
}));

// Mock email service
vi.mock('../../services/email.service.js', () => ({
  sendWorkPermitExpirationAlert: vi.fn(() => Promise.resolve(true)),
  sendAgeTransitionAlert: vi.fn(() => Promise.resolve(true)),
  sendMissingDocumentAlert: vi.fn(() => Promise.resolve(true)),
}));

// Mock age utility
vi.mock('../../utils/age.js', () => ({
  calculateAge: vi.fn(),
}));

import { db } from '../../db/index.js';
import { getDocumentationStatus } from '../../services/documentation-status.service.js';
import { calculateAge } from '../../utils/age.js';
import {
  sendWorkPermitExpirationAlert,
  sendAgeTransitionAlert,
  sendMissingDocumentAlert,
} from '../../services/email.service.js';
import { generateAlerts, generateAndSendAlerts } from '../../services/notification.service.js';

describe('Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return empty arrays for most queries
    vi.mocked(db.query.employees.findMany).mockResolvedValue([]);
    vi.mocked(db.query.alertNotificationLogs.findFirst).mockResolvedValue(null);
  });

  describe('generateAlerts', () => {
    it('should return empty array when no employees exist', async () => {
      vi.mocked(db.query.employees.findMany).mockResolvedValue([]);

      const alerts = await generateAlerts();

      expect(alerts).toEqual([]);
    });

    it('should skip adult employees (age >= 18)', async () => {
      const adultEmployee = {
        id: 'emp-1',
        name: 'Adult Worker',
        email: 'adult@test.com',
        dateOfBirth: '2000-01-01',
        status: 'active',
        isSupervisor: false,
      };
      vi.mocked(db.query.employees.findMany).mockResolvedValue([adultEmployee]);
      vi.mocked(calculateAge).mockReturnValue(20);

      const alerts = await generateAlerts();

      expect(alerts).toEqual([]);
      expect(getDocumentationStatus).not.toHaveBeenCalled();
    });

    it('should generate missing document alerts for minor employees', async () => {
      const minorEmployee = {
        id: 'emp-2',
        name: 'Young Worker',
        email: 'young@test.com',
        dateOfBirth: '2010-06-15',
        status: 'active',
        isSupervisor: false,
      };
      vi.mocked(db.query.employees.findMany).mockResolvedValue([minorEmployee]);
      vi.mocked(calculateAge).mockReturnValue(14);
      vi.mocked(getDocumentationStatus).mockResolvedValue({
        isComplete: false,
        missingDocuments: ['work_permit', 'parental_consent'],
        expiringDocuments: [],
        hasValidConsent: false,
        hasValidWorkPermit: false,
        safetyTrainingComplete: true,
      });

      const alerts = await generateAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('missing_document');
      expect(alerts[0].employeeId).toBe('emp-2');
      expect(alerts[0].message).toContain('Work permit');
      expect(alerts[0].message).toContain('Parental consent');
    });

    it('should generate expiring document alerts', async () => {
      const employee = {
        id: 'emp-3',
        name: 'Permit Expiring',
        email: 'expiring@test.com',
        dateOfBirth: '2009-01-01',
        status: 'active',
        isSupervisor: false,
      };
      vi.mocked(db.query.employees.findMany).mockResolvedValue([employee]);
      vi.mocked(calculateAge).mockReturnValue(15);
      vi.mocked(getDocumentationStatus).mockResolvedValue({
        isComplete: true,
        missingDocuments: [],
        expiringDocuments: [
          {
            type: 'work_permit',
            expiresAt: '2024-03-15',
            daysUntilExpiry: 20,
          },
        ],
        hasValidConsent: true,
        hasValidWorkPermit: true,
        safetyTrainingComplete: true,
      });

      const alerts = await generateAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('expiring_document');
      expect(alerts[0].employeeId).toBe('emp-3');
      expect(alerts[0].message).toContain('Work permit expires');
      expect(alerts[0].daysRemaining).toBe(20);
    });

    it('should generate age transition alerts for 13-year-olds turning 14', async () => {
      // Calculate a birthday that's 15 days from now
      const now = new Date();
      const birthday14 = new Date(now);
      birthday14.setDate(birthday14.getDate() + 15);
      const birthYear = birthday14.getFullYear() - 14;
      const dateOfBirth = `${birthYear}-${String(birthday14.getMonth() + 1).padStart(2, '0')}-${String(birthday14.getDate()).padStart(2, '0')}`;

      const employee = {
        id: 'emp-4',
        name: 'Turning Fourteen',
        email: 'turning14@test.com',
        dateOfBirth: dateOfBirth,
        status: 'active',
        isSupervisor: false,
      };
      vi.mocked(db.query.employees.findMany).mockResolvedValue([employee]);
      vi.mocked(calculateAge).mockReturnValue(13);
      vi.mocked(getDocumentationStatus).mockResolvedValue({
        isComplete: true,
        missingDocuments: [],
        expiringDocuments: [],
        hasValidConsent: true,
        hasValidWorkPermit: null, // Not required yet
        safetyTrainingComplete: true,
      });

      const alerts = await generateAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('age_transition');
      expect(alerts[0].employeeId).toBe('emp-4');
      expect(alerts[0].message).toContain('Turns 14');
      expect(alerts[0].message).toContain('work permit');
    });

    it('should not generate age transition alert if birthday is more than 30 days away', async () => {
      // Calculate a birthday that's 45 days from now
      const now = new Date();
      const birthday14 = new Date(now);
      birthday14.setDate(birthday14.getDate() + 45);
      const birthYear = birthday14.getFullYear() - 14;
      const dateOfBirth = `${birthYear}-${String(birthday14.getMonth() + 1).padStart(2, '0')}-${String(birthday14.getDate()).padStart(2, '0')}`;

      const employee = {
        id: 'emp-5',
        name: 'Far Birthday',
        email: 'far@test.com',
        dateOfBirth: dateOfBirth,
        status: 'active',
        isSupervisor: false,
      };
      vi.mocked(db.query.employees.findMany).mockResolvedValue([employee]);
      vi.mocked(calculateAge).mockReturnValue(13);
      vi.mocked(getDocumentationStatus).mockResolvedValue({
        isComplete: true,
        missingDocuments: [],
        expiringDocuments: [],
        hasValidConsent: true,
        hasValidWorkPermit: null,
        safetyTrainingComplete: true,
      });

      const alerts = await generateAlerts();

      // Should not have age transition alert
      const ageAlerts = alerts.filter((a) => a.type === 'age_transition');
      expect(ageAlerts).toHaveLength(0);
    });

    it('should not return alerts for archived employees', async () => {
      // The query filters by status='active', so archived employees won't be returned
      vi.mocked(db.query.employees.findMany).mockResolvedValue([]);

      const alerts = await generateAlerts();

      expect(alerts).toEqual([]);
    });
  });

  describe('generateAndSendAlerts', () => {
    it('should return zero counts when no alerts exist', async () => {
      vi.mocked(db.query.employees.findMany).mockResolvedValue([]);

      const result = await generateAndSendAlerts();

      expect(result.alertCount).toBe(0);
      expect(result.emailsSent).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error when no supervisors exist', async () => {
      const employee = {
        id: 'emp-1',
        name: 'Worker',
        email: 'worker@test.com',
        dateOfBirth: '2010-01-01',
        status: 'active',
        isSupervisor: false,
      };

      // First call returns employees (for alert generation)
      // Second call returns supervisors (empty)
      vi.mocked(db.query.employees.findMany)
        .mockResolvedValueOnce([employee])
        .mockResolvedValueOnce([]);

      vi.mocked(calculateAge).mockReturnValue(14);
      vi.mocked(getDocumentationStatus).mockResolvedValue({
        isComplete: false,
        missingDocuments: ['work_permit'],
        expiringDocuments: [],
        hasValidConsent: true,
        hasValidWorkPermit: false,
        safetyTrainingComplete: true,
      });

      const result = await generateAndSendAlerts();

      expect(result.errors).toContain('No supervisors found to notify');
    });

    it('should send emails to supervisors for alerts', async () => {
      const employee = {
        id: 'emp-1',
        name: 'Worker',
        email: 'worker@test.com',
        dateOfBirth: '2010-01-01',
        status: 'active',
        isSupervisor: false,
      };
      const supervisor = {
        id: 'sup-1',
        name: 'Supervisor',
        email: 'supervisor@test.com',
        dateOfBirth: '1980-01-01',
        status: 'active',
        isSupervisor: true,
      };

      // First call returns employees (for alert generation)
      // Second call returns supervisors
      vi.mocked(db.query.employees.findMany)
        .mockResolvedValueOnce([employee])
        .mockResolvedValueOnce([supervisor]);

      vi.mocked(calculateAge).mockReturnValue(14);
      vi.mocked(getDocumentationStatus).mockResolvedValue({
        isComplete: false,
        missingDocuments: ['work_permit'],
        expiringDocuments: [],
        hasValidConsent: true,
        hasValidWorkPermit: false,
        safetyTrainingComplete: true,
      });

      const result = await generateAndSendAlerts();

      expect(result.alertCount).toBe(1);
      expect(result.emailsSent).toBe(1);
      expect(sendMissingDocumentAlert).toHaveBeenCalledWith(
        'supervisor@test.com',
        'Supervisor',
        'Worker',
        expect.any(Array)
      );
    });

    it('should skip sending if alert was recently sent', async () => {
      const employee = {
        id: 'emp-1',
        name: 'Worker',
        email: 'worker@test.com',
        dateOfBirth: '2010-01-01',
        status: 'active',
        isSupervisor: false,
      };
      const supervisor = {
        id: 'sup-1',
        name: 'Supervisor',
        email: 'supervisor@test.com',
        dateOfBirth: '1980-01-01',
        status: 'active',
        isSupervisor: true,
      };

      vi.mocked(db.query.employees.findMany)
        .mockResolvedValueOnce([employee])
        .mockResolvedValueOnce([supervisor]);

      vi.mocked(calculateAge).mockReturnValue(14);
      vi.mocked(getDocumentationStatus).mockResolvedValue({
        isComplete: false,
        missingDocuments: ['work_permit'],
        expiringDocuments: [],
        hasValidConsent: true,
        hasValidWorkPermit: false,
        safetyTrainingComplete: true,
      });

      // Simulate that alert was recently sent
      vi.mocked(db.query.alertNotificationLogs.findFirst).mockResolvedValue({
        id: 'log-1',
        alertType: 'missing_document',
        employeeId: 'emp-1',
        sentTo: 'supervisor@test.com',
        sentAt: new Date(),
        alertKey: 'missing_document:emp-1:2024-01-01',
      });

      const result = await generateAndSendAlerts();

      expect(result.alertCount).toBe(1);
      expect(result.emailsSent).toBe(0); // Skipped because already sent
      expect(sendMissingDocumentAlert).not.toHaveBeenCalled();
    });
  });
});
