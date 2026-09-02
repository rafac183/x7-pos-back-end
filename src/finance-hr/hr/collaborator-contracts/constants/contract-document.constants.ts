/** Límites del adjunto legal firmado. */
export const MAX_CONTRACT_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_CONTRACT_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const ALLOWED_CONTRACT_DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx'];

export const CONTRACT_DOCUMENT_DIR = 'uploads/contracts';
