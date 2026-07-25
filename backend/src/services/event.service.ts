// This file used to hold the entire event domain (~2400 lines: CRUD, speakers/
// volunteers/sponsors, registration, attendance, certificates, analytics).
// It has been split into focused modules under ./event/ for maintainability.
// This barrel re-exports everything so existing imports (`from './event.service'`
// or `from '../services/event.service'`) keep working unchanged.
export * from './event/event-shared';
export * from './event/event-core.service';
export * from './event/event-people.service';
export * from './event/event-registration.service';
export * from './event/event-attendance.service';
export * from './event/event-certificate.service';
export * from './event/event-analytics.service';
