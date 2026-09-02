export const REALTIME_NAMESPACE_DEFAULT = '/realtime';
export const REALTIME_CORS_ORIGIN_DEFAULT = '*';

export const ROOM_COMPANY_PREFIX = 'company';
export const ROOM_MERCHANT_PREFIX = 'merchant';

export function companyRoom(companyId: number): string {
  return `${ROOM_COMPANY_PREFIX}:${companyId}`;
}

// Sala por comercio. Una compañía puede explotar varios locales y los datos de sala
// (mesas, coberturas, planos) son de UN local: emitir a la compañía enseñaría el mapa del
// restaurante de al lado a las tablets de este.
export function merchantRoom(merchantId: number): string {
  return `${ROOM_MERCHANT_PREFIX}:${merchantId}`;
}
