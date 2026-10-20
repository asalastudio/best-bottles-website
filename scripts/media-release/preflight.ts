import { assertMediaPreviewConfig } from '../../src/lib/media-release/build-config';
assertMediaPreviewConfig(process.env);
console.log('Media release build configuration passed. This does not authorize a push or deploy.');
