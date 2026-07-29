import docPage from "./resources/doc-page";
import readme from "./resources/readme";
import review from "./prompts/review";
import summarize from "./prompts/summarize";
import bmi from "./tools/bmi";
import boom from "./tools/boom";
import greet from "./tools/greet";
import pixel from "./tools/pixel";
import whoami from "./tools/whoami";

/**
 * Wave 2 replaces this file with directory discovery. Until then, adding a
 * definition means dropping a file next to its siblings and listing it here.
 */
export const tools = [greet, bmi, whoami, boom, pixel];
export const resources = [readme, docPage];
export const prompts = [review, summarize];

export const definitions = [...tools, ...resources, ...prompts];
