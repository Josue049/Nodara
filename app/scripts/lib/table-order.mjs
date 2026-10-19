// Orden de copia respetando claves foráneas. `pages` y `collections` se referencian mutuamente (pages.collection_id → collections,
// collections.host_page_id → pages): migrate-data.mjs copia pages primero con collection_id nulo y lo completa al final. Una prueba unitaria verifica que cubre el esquema.
export const TABLE_ORDER = ["pages", "collections", "collection_properties", "collection_views", "collection_templates"];
