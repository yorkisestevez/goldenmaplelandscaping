// DeckCraft edit assistant. Claude Opus 5.5 when ANTHROPIC_API_KEY is set (same monthly cap and visitor limits as
// the AI Site Designer; job + polling), the local Ollama model when DECK_ASSISTANT_OLLAMA_URL is set (loopback only),
// else it reports not configured. It never uses the marketing chat.
import {deckAssistantFunction} from '../../server/aiTurnService';

export default (request:Request,context?:{ip?:string})=>deckAssistantFunction(request,context);
