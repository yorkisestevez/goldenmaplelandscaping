// Background worker for the cloud AI turns (deck-designer-ai, deck-assistant): runs one queued job past the 60 s
// synchronous limit (background functions run up to 15 min). The -background suffix makes it a background function.
// Only jobs queued by the sync functions run, each once, with that job's random dispatch token.
import {backgroundAiFunction} from '../../server/aiTurnService';

export default (request:Request)=>backgroundAiFunction(request);
