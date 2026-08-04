// Temporary rollback compatibility alias. OpenAI and new callers use
// /api/grace/tools; remove this route with the final ElevenLabs cleanup.
export { POST } from "../../grace/tools/route";
