/**
 * API barrel — re-exports every domain module so existing call-sites keep
 * working. New code should import directly from the specific domain modules
 * (./ha, ./energy, ./petkit, ./user) for clearer dependencies.
 */
export { ApiError } from './errors';
export * from './client';
export * from './ha';
export * from './user';
export * from './energy';
export * from './petkit';
export * from './notifications';
export * from './history';
