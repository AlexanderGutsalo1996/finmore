import { randomUUID } from 'node:crypto';
import { getEmailDomain } from '../config/env';

export interface RegistrationData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  currency: string;
}

const FIRST_NAMES = [
  'Olena', 'Andrii', 'Maria', 'Dmytro', 'Iryna',
  'Taras', 'Sofiia', 'Oleksandr', 'Nataliia', 'Bohdan',
];

const LAST_NAMES = [
  'Shevchenko', 'Kovalenko', 'Bondarenko', 'Tkachenko', 'Melnyk',
  'Kravchenko', 'Boyko', 'Polishchuk', 'Lysenko', 'Moroz',
];

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const shortId = () => randomUUID().replace(/-/g, '').slice(0, 8);

// Unique, recognisable throw-away address (the `autotest.` prefix makes manual purging easy).
export function generateEmail(firstName: string, lastName: string, domain = getEmailDomain()): string {
  return `autotest.${firstName}.${lastName}.${shortId()}@${domain}`.toLowerCase();
}

// Throw-away password satisfying the policy (min 6 characters); never a real credential.
export const generatePassword = (): string => `Tp#${shortId()}`;

export function generateRegistrationData(overrides: Partial<RegistrationData> = {}): RegistrationData {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const password = overrides.password ?? generatePassword();

  return {
    name: `${firstName} ${lastName}`,
    email: generateEmail(firstName, lastName),
    password,
    confirmPassword: password, // follows the password unless overridden
    currency: 'UAH',
    ...overrides,
  };
}
