// AI Site Designer (DeckCraft): GET status or ?job= poll, POST a design or revise turn (202 + job id).
// Claude Opus 5.5 when ANTHROPIC_API_KEY is set, local Ollama when DECK_ASSISTANT_OLLAMA_URL is set, else 503.
// Hard monthly cap, per-visitor daily turns and the job pattern: server/aiTurnService.ts.
import {designerAiFunction} from '../../server/aiTurnService';

export default (request:Request,context?:{ip?:string})=>designerAiFunction(request,context);
