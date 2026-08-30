// In-memory demo data used when no BambooHR credentials are configured.
// Mirrors the shapes returned by the real API closely enough for the UI,
// and mutates in memory so status changes and hires persist for the session.

const STATUSES = [
  { id: 1, name: 'New' },
  { id: 2, name: 'Reviewed' },
  { id: 3, name: 'Phone Screen' },
  { id: 4, name: 'Interview' },
  { id: 5, name: 'Offer' },
  { id: 6, name: 'Hired' },
  { id: 7, name: 'Not a Fit' },
];

let nextEmployeeId = 200;

export class DemoStore {
  constructor() {
    this.jobs = [
      { id: 101, title: { label: 'Account Executive' }, department: { label: 'Sales' }, location: { label: 'Lubbock, TX' }, status: { label: 'Open' }, newApplicantsCount: 0, activeApplicantsCount: 1 },
    ];

    this.applications = [
      this.app(9001, 'Justin', 'Woodruff', 'blakewoodruff9@gmail.com', '(210) 480-6345', 101, 'Account Executive', 6, '2026-08-21'),
    ];

    this.employees = [
      { id: '200', displayName: 'Justin Woodruff', firstName: 'Justin', lastName: 'Woodruff', jobTitle: 'Account Executive', department: 'Sales', workEmail: 'blakewoodruff9@gmail.com', location: 'Lubbock, TX' },
    ];
  }

  app(id, firstName, lastName, email, phone, jobId, jobTitle, statusId, appliedDate) {
    const status = STATUSES.find((s) => s.id === statusId);
    return {
      id,
      appliedDate,
      applicant: { firstName, lastName, email, phoneNumber: phone },
      job: { id: jobId, title: { label: jobTitle } },
      status: { id: status.id, label: status.name },
      rating: null,
    };
  }

  getJobs() {
    return { jobs: this.jobs };
  }

  getApplications({ jobId } = {}) {
    let apps = this.applications;
    if (jobId) apps = apps.filter((a) => a.job.id === Number(jobId));
    return { applications: apps, paginationComplete: true, totalResponses: apps.length };
  }

  getApplication(id) {
    return this.applications.find((a) => a.id === Number(id)) || null;
  }

  getHiringStatuses() {
    return { hiringStatuses: STATUSES.map((s) => ({ id: s.id, label: s.name })) };
  }

  updateApplicationStatus(applicationId, statusId) {
    const app = this.getApplication(applicationId);
    if (!app) throw new Error(`Demo application ${applicationId} not found`);
    const status = STATUSES.find((s) => s.id === Number(statusId));
    if (!status) throw new Error(`Demo status ${statusId} not found`);
    app.status = { id: status.id, label: status.name };
    return app;
  }

  getDirectory() {
    return { employees: this.employees };
  }

  addEmployee(fields) {
    const id = String(nextEmployeeId++);
    this.employees.push({
      id,
      displayName: `${fields.firstName} ${fields.lastName}`,
      firstName: fields.firstName,
      lastName: fields.lastName,
      jobTitle: fields.jobTitle || '',
      department: fields.department || '',
      workEmail: fields.workEmail || '',
      location: fields.location || '',
      hireDate: fields.hireDate || '',
    });
    return { id };
  }
}
