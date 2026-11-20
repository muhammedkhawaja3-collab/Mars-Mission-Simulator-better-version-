/**
 * Display conversions. The engine works in SI. Call these only at the UI edge.
 */
import { DAY } from './constants.js';

/** @param {number} seconds @returns {number} days */
export const toDays = (seconds) => seconds / DAY;

/** @param {number} days @returns {number} seconds */
export const fromDays = (days) => days * DAY;

/** @param {number} metresPerSecond @returns {number} km/s */
export const toKmPerSecond = (metresPerSecond) => metresPerSecond / 1000;

/** @param {number} kilograms @returns {number} tonnes (metric) */
export const toTonnes = (kilograms) => kilograms / 1000;

/** @param {number} sieverts @returns {number} millisieverts */
export const toMilliSieverts = (sieverts) => sieverts * 1000;

/** @param {number} usd @returns {number} billions of USD */
export const toBillionUsd = (usd) => usd / 1e9;

/** @param {number} metres @returns {number} millions of km */
export const toMillionKm = (metres) => metres / 1e9;
