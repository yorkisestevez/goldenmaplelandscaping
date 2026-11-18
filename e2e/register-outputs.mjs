import {register} from 'node:module';

if(process.env.E2E_OUTPUTS)await register(new URL('./fs-outputs-hook.mjs',import.meta.url),{data:{root:process.env.E2E_OUTPUTS}});
