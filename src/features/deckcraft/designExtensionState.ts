/** Loading infrastructure errors are not malformed customer project files. */
export class DesignExtensionLoadError extends Error {
 readonly code='DECKCRAFT_EXTENSION_LOADING';
 constructor(extension:string,cause?:unknown){super(`${extension} is not ready. ${cause instanceof Error?cause.message:'Load its design extension before validating or applying it.'}`);this.name='DesignExtensionLoadError';}
}
