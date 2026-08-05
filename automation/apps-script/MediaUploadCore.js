const TOPC_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
const TOPC_MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function topcMontarCanonical_(timestamp, requestId, sourceKey, bodyHash) {
  return [timestamp, requestId, sourceKey, bodyHash].join('\n');
}

function topcValidarUploadMidia_(media, mimeType, size, referencedMediaKeys) {
  if (!media || !media.fileId) {
    throw new Error('Arquivo ID ausente.');
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(media.mediaKey || '')) {
    throw new Error('mediaKey inválida.');
  }
  if (TOPC_MEDIA_MIME_TYPES.indexOf(mimeType) === -1) {
    throw new Error('MIME de imagem não permitido: ' + mimeType);
  }
  if (!Number.isInteger(size) || size <= 0 || size > TOPC_MEDIA_MAX_BYTES) {
    throw new Error('Tamanho de imagem inválido: ' + size);
  }
  if (media.role !== 'cover' && media.role !== 'inline') {
    throw new Error('Papel de imagem inválido.');
  }
  if (!Number.isInteger(media.position) || media.position < 0) {
    throw new Error('Posição de imagem inválida.');
  }
  if (referencedMediaKeys.indexOf(media.mediaKey) === -1) {
    throw new Error('Imagem não referenciada no envelope: ' + media.mediaKey);
  }
}

function topcMontarCabecalhosMidia_(media, sha256) {
  if (!/^[a-f0-9]{64}$/.test(sha256 || '')) {
    throw new Error('SHA-256 inválido.');
  }
  return {
    'x-media-key': media.mediaKey,
    'x-media-sha256': sha256,
    'x-media-role': media.role,
    'x-media-position': String(media.position)
  };
}
