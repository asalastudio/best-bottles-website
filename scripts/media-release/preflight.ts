import { assertMediaBuildConfig } from '../../src/lib/media-release/build-config';
assertMediaBuildConfig(process.env);
console.log('Media build controls passed. Traffic promotion still requires separate approval.');
