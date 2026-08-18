// Catálogo de formas de mesa admitidas por el diseñador de planos.
// 'Circle' | 'Square' | 'Rectangle' son las originales; el resto se añadieron para poder
// representar salas reales (reservados, barras) sin recurrir a rectángulos genéricos.
export const TABLE_SHAPES = [
  'Circle',
  'Square',
  'Rectangle',
  'Oval',
  'Booth',
  'Counter',
] as const;

export type TableShapeValue = (typeof TABLE_SHAPES)[number];

// Límites del tamaño propio de una mesa, en píxeles de lienzo (100px = 1m).
// 20px = 20cm evita mesas invisibles; 600px = 6m cubre una barra larga o una mesa
// de banquete sin permitir figuras que desborden cualquier sala razonable.
export const TABLE_MIN_SIZE_PX = 20;
export const TABLE_MAX_SIZE_PX = 600;
