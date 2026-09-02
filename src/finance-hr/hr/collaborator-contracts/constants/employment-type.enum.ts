/**
 * Naturaleza laboral del acuerdo, que es lo que mira Legal.
 *
 * Va aparte de `ContractType` (hourly/salary/mixed) a propósito: aquél describe cómo se
 * calcula la nómina y lo consume el motor de pagos, mientras que éste describe la relación
 * contractual. Un contrato temporal puede pagarse por horas o por sueldo fijo.
 */
export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  TEMPORARY = 'temporary',
  FREELANCE = 'freelance',
  INTERNSHIP = 'internship',
}
