import { readFile, readdir } from 'fs/promises';
import { join, parse } from 'path';
import fs from 'fs';

const JAVA_MAP_DIR = 'java to_universal/minecraft/vanilla';
const BEDROCK_MAP_DIR = 'from_universal to bedrock/universal_minecraft/vanilla';
const INPUT_FILE = process.env.INPUT_FILE || './list of commands.txt';
const OUTPUT_FILE = process.env.OUTPUT_FILE || './commands_bedrock.txt';

// Log the files being used
console.log(`Using input file: ${INPUT_FILE}`);
console.log(`Using output file: ${OUTPUT_FILE}`);

const jsonCache = new Map();

/**
 * Loads and caches JSON mapping files.
 */
async function loadJsonMap(filePath) {
    if (jsonCache.has(filePath)) {
        return jsonCache.get(filePath);
    }
    try {
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        jsonCache.set(filePath, data);
        return data;
    } catch (error) {
        if (error.code === 'ENOENT') {
            // console.warn(`Warning: Mapping file not found: ${filePath}`); // Keep this commented for cleaner output
        } else {
            console.error(`Error reading or parsing JSON file ${filePath}:`, error);
        }
        jsonCache.set(filePath, null);
        return null;
    }
}

/**
 * Parses a Minecraft Java Edition command string.
 */
function parseJavaCommand(line) {
    line = line.trim();
    if (!line || line.startsWith('#')) {
        return null;
    }

    const match = line.match(/^(setblock|fill)\s+((?:~?-?\d*\s*){3})\s*(?:((?:~?-?\d*\s*){3})\s+)?([\w:]+)(?:\[([^\]]*)\])?(?:\s+(\{.*\})?)?$/);

    if (!match) {
        const simpleMatch = line.match(/^(setblock|fill)\s+((?:~?-?\d*\s*){3})\s*(?:((?:~?-?\d*\s*){3})\s+)?([\w:]+)$/);
        if (simpleMatch) {
             const [, commandType, coords1, coords2Raw, blockId] = simpleMatch;
             const coords2 = coords2Raw ? coords2Raw.trim() : null;
             return { type: commandType, coords1: coords1.trim(), coords2: coords2, blockId: blockId.trim(), states: {}, nbt: null, originalLine: line };
        }
        console.warn(`Warning: Could not parse Java command line: ${line}`);
        return null;
    }

    const [, commandType, coords1, coords2Raw, blockId, stateString, nbtString] = match;
    const coords2 = coords2Raw ? coords2Raw.trim() : null;

    const states = {};
    if (stateString !== undefined && stateString !== null) {
        stateString.split(',').forEach(pair => {
            if (!pair) return;
            const [key, value] = pair.split('=');
            if (key && value !== undefined) {
                let trimmedValue = value.trim();
                if (trimmedValue.startsWith('"') && trimmedValue.endsWith('"') && trimmedValue.length >= 2) {
                    trimmedValue = trimmedValue.substring(1, trimmedValue.length - 1);
                }
                states[key.trim()] = trimmedValue;
            } else if (key) {
                 console.warn(`Warning: Malformed state pair in '${line}': ${pair}`);
            }
        });
    }

    const nbt = nbtString ? nbtString.trim() : null;
    return { type: commandType, coords1: coords1.trim(), coords2: coords2, blockId: blockId.trim(), states: states, nbt: nbt, originalLine: line };
}

/**
 * Extracts the base block name from a full ID.
 */
function getBaseBlockName(blockId) {
    if (!blockId) return '';
    return blockId.includes(':') ? blockId.split(':')[1] : blockId;
}

/**
 * Safely parses potentially escaped JSON string values.
 */
function parseJsonStringValue(value) {
    if (typeof value !== 'string') return value;
    try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'string' ? parsed : value;
    } catch (e) {
        return value;
    }
}

/**
 * Converts a Java command block representation to its Universal format
 */
async function javaToUniversal(parsedCommand) {
    if (!parsedCommand || !parsedCommand.blockId) {
        console.error('Invalid parsedCommand provided to javaToUniversal:', parsedCommand);
        return null;
    }

    const baseBlockName = getBaseBlockName(parsedCommand.blockId);
    const mapFilePath = join(JAVA_MAP_DIR, `${baseBlockName}.json`);
    const rules = await loadJsonMap(mapFilePath);

    if (!rules) {
        console.warn(`No mapping rules found for ${baseBlockName}, using default Universal format`);
        return {
            name: `universal_minecraft:${baseBlockName}`,
            properties: parsedCommand.states,
            nbt: parsedCommand.nbt
        };
    }

    const universalBlock = {
        name: `universal_minecraft:${baseBlockName}`,
        properties: {},
        nbt: parsedCommand.nbt
    };

    // First pass: Apply new_block rules
    for (const rule of rules) {
        if (rule.function === 'new_block') {
            universalBlock.name = rule.options;
            break;
        }
    }

    // Second pass: Apply property rules
    for (const rule of rules) {
        try {
            switch (rule.function) {
                case 'new_properties':
                    // Direct property assignments
                    Object.assign(universalBlock.properties, rule.options);
                    break;
                case 'carry_properties':
                    // Carry over properties that match the allowed values
                    for (const propKey in rule.options) {
                        const javaValue = parsedCommand.states[`"${propKey}"`] || parsedCommand.states[propKey];
                        if (javaValue !== undefined) {
                            const allowedValues = rule.options[propKey];
                            if (Array.isArray(allowedValues)) {
                                // Convert Java value to string for comparison
                                const javaValueStr = String(javaValue).toLowerCase();
                                for (const allowedValue of allowedValues) {
                                    const parsedAllowedValue = parseJsonStringValue(allowedValue);
                                    const allowedValueStr = String(parsedAllowedValue).toLowerCase();
                                    if (javaValueStr === allowedValueStr) {
                                        // Store the original JSON value from the mapping
                                        universalBlock.properties[propKey] = allowedValue;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    break;
                case 'map_properties':
                    // Handle property mappings
                    for (const propKey in rule.options) {
                        const javaValue = parsedCommand.states[`"${propKey}"`] || parsedCommand.states[propKey];
                        if (javaValue !== undefined) {
                            const mappingForValue = rule.options[propKey]?.[`"${javaValue}"`];
                            if (mappingForValue && Array.isArray(mappingForValue)) {
                                for (const nestedRule of mappingForValue) {
                                    if (nestedRule.function === 'new_properties') {
                                        Object.assign(universalBlock.properties, nestedRule.options);
                                    }
                                }
                            }
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error(`Error applying Java->Universal rule for ${baseBlockName}:`, error);
            console.error('Rule:', rule);
            return null;
        }
    }

    // Log the final Universal format for debugging
    console.log('Final Universal format:', JSON.stringify(universalBlock, null, 2));

    return universalBlock;
}

/**
 * Converts a Universal format block to its Bedrock representation
 */
async function universalToBedrock(originalCommand, universalBlock) {
    if (!universalBlock || !universalBlock.name) {
        console.error('Invalid universalBlock provided to universalToBedrock:', universalBlock);
        return null;
    }

    if (!originalCommand || !originalCommand.type) {
        console.error('Invalid originalCommand provided to universalToBedrock');
        return null;
    }

    const baseUniversalName = getBaseBlockName(universalBlock.name);
    const mapFilePath = join(BEDROCK_MAP_DIR, `${baseUniversalName}.json`);
    const rules = await loadJsonMap(mapFilePath);

    // Initialize Bedrock representation
    const bedrockRepresentation = {
        type: originalCommand.type,
        coords1: originalCommand.coords1,
        coords2: originalCommand.coords2,
        name: null,
        states: {},
        nbt: universalBlock.nbt
    };

    // If no mapping rules found, use default name
    if (!rules) {
        bedrockRepresentation.name = `minecraft:${baseUniversalName}`;
        return bedrockRepresentation;
    }

    // First pass: Apply new_block rules to set initial name
    for (const rule of rules) {
        if (rule.function === 'new_block') {
            bedrockRepresentation.name = rule.options;
            break;
        }
    }

    // Helper function to apply nested rules
    function applyNestedRules(rules) {
        if (!Array.isArray(rules)) return;
        
        for (const rule of rules) {
            switch (rule.function) {
                case 'new_block':
                    bedrockRepresentation.name = rule.options;
                    break;
                case 'new_properties':
                    // Clean up property values by removing extra quotes
                    for (const [key, value] of Object.entries(rule.options)) {
                        if (typeof value === 'string') {
                            bedrockRepresentation.states[key] = value.replace(/^"(.*)"$/, '$1');
                        } else {
                            bedrockRepresentation.states[key] = value;
                        }
                    }
                    break;
                case 'map_properties':
                    // Handle nested property mappings
                    for (const propKey in rule.options) {
                        const universalValue = universalBlock.properties[propKey];
                        if (universalValue !== undefined) {
                            const cleanValue = typeof universalValue === 'string' ? 
                                universalValue.replace(/^"(.*)"$/, '$1') : universalValue;
                            
                            // Try both quoted and unquoted versions of the value
                            let mappingForValue = rule.options[propKey]?.[`"${cleanValue}"`];
                            if (!mappingForValue) {
                                mappingForValue = rule.options[propKey]?.[cleanValue];
                            }

                            if (mappingForValue && Array.isArray(mappingForValue)) {
                                applyNestedRules(mappingForValue);
                            }
                        }
                    }
                    break;
            }
        }
    }

    // Second pass: Apply property mappings and states
    for (const rule of rules) {
        if (rule.function === 'map_properties') {
            for (const propKey in rule.options) {
                const universalValue = universalBlock.properties[propKey];
                if (universalValue !== undefined) {
                    const cleanValue = typeof universalValue === 'string' ? 
                        universalValue.replace(/^"(.*)"$/, '$1') : universalValue;
                    
                    // Try both quoted and unquoted versions of the value
                    let mappingForValue = rule.options[propKey]?.[`"${cleanValue}"`];
                    if (!mappingForValue) {
                        mappingForValue = rule.options[propKey]?.[cleanValue];
                    }

                    if (mappingForValue && Array.isArray(mappingForValue)) {
                        applyNestedRules(mappingForValue);
                    }
                }
            }
        } else if (rule.function === 'carry_properties') {
            // Handle direct property carry-over
            for (const propKey in rule.options) {
                const universalValue = universalBlock.properties[propKey];
                if (universalValue !== undefined) {
                    const cleanValue = typeof universalValue === 'string' ? 
                        universalValue.replace(/^"(.*)"$/, '$1') : universalValue;
                    bedrockRepresentation.states[propKey] = cleanValue;
                }
            }
        }
    }

    // If no name was set, use the base name as fallback
    if (!bedrockRepresentation.name) {
        bedrockRepresentation.name = `minecraft:${baseUniversalName}`;
    }

    // Log the final Bedrock format for debugging
    console.log('Final Bedrock format:', JSON.stringify(bedrockRepresentation, null, 2));

    return bedrockRepresentation;
}

/**
 * Formats the Bedrock representation into a command string.
 */
function formatBedrockCommand(bedrockRep) {
    // ---- DEBUG LOG START ----
    // console.log(`DEBUG: Formatting Bedrock command for: ${bedrockRep.name}`);
    // ---- DEBUG LOG END ----

    let commandStr = `${bedrockRep.type} ${bedrockRep.coords1}`;
    if (bedrockRep.coords2) {
        commandStr += ` ${bedrockRep.coords2}`;
    }
    commandStr += ` ${bedrockRep.name}`;

    const stateKeys = Object.keys(bedrockRep.states);
    if (stateKeys.length > 0) {
         const stateParts = stateKeys.map(key => {
             let rawValue = bedrockRep.states[key];
             let finalValue;

             // --- Refined Value Type Conversion --- 
             if (rawValue === "0b") finalValue = false;
             else if (rawValue === "1b") finalValue = true;
             else if (typeof rawValue === 'string') {
                 // Check for boolean strings
                 if (rawValue === "true" || rawValue === "\"true\"") {
                     finalValue = true;
                 } else if (rawValue === "false" || rawValue === "\"false\"") {
                     finalValue = false;
                 } else {
                     // 1. Try parsing as Number first
                     const num = Number(rawValue);
                     if (!isNaN(num) && String(num) === rawValue) {
                         finalValue = num; // Use the number
                     } else {
                         // 2. If not a simple number, try parsing as JSON (handles "\"string\"", maybe "true"/"false")
                         try {
                             let parsed = JSON.parse(rawValue);
                             // Use the parsed value if it's string/bool/number
                             if (typeof parsed === 'string' || typeof parsed === 'boolean' || typeof parsed === 'number') {
                                finalValue = parsed;
                             } else {
                                // If JSON.parse results in object/array/null, treat original as literal string
                                finalValue = rawValue;
                             }
                         } catch (e) {
                             // 3. If it's not a number and JSON.parse fails, it's a literal string ("auto", "y", etc.)
                             finalValue = rawValue;
                         }
                     }
                 }
             } else { // Input rawValue was already boolean or number
                 finalValue = rawValue;
             }
             // --- End Refined Value Type Conversion ---

             // Always quote the key (tag name)
             let formattedKey = `"${key}"`;

             // Check the *finalValue*'s type before adding quotes
             let formattedValue;
             if (typeof finalValue === 'boolean') {
                 formattedValue = finalValue.toString(); // Convert to 'true' or 'false' without quotes
             } else if (typeof finalValue === 'number') {
                 formattedValue = finalValue; // Use the raw number, DO NOT quote
             } else {
                 // It's a string, so add quotes
                 formattedValue = `"${finalValue}"`;
             }

             // ---- DEBUG LOG START ----
             // console.log(`DEBUG FORMAT: key=${key}, rawValue=${JSON.stringify(rawValue)}, finalValue=${JSON.stringify(finalValue)}(${typeof finalValue}), formattedValue=${JSON.stringify(formattedValue)}`);
             // ---- DEBUG LOG END ----

             return `${formattedKey}=${formattedValue}`;
         });
         commandStr += `[${stateParts.join(',')}]`;
     }

    if (bedrockRep.nbt) {
        console.warn(`Warning: NBT translation not fully implemented. Appending raw NBT: ${bedrockRep.nbt}`);
        commandStr += ` ${bedrockRep.nbt}`;
    }
    return commandStr;
}

/**
 * Reads the input command file and returns an array of lines.
 */
async function readCommandFile(filePath) {
    try {
        const data = await fs.promises.readFile(filePath, 'utf-8');
        return data.split(/\r?\n/); // Split by newline, handling Windows/Unix
    } catch (error) {
        console.error(`Error reading input file ${filePath}:`, error);
        return []; // Return empty array on error to prevent crash
    }
}

/**
 * Writes the translated commands to the output file.
 */
async function writeCommandFile(filePath, commands) {
    try {
        await fs.promises.writeFile(filePath, commands.join('\n'), 'utf-8');
        console.log(`Successfully wrote ${commands.length} commands to ${filePath}`);
    } catch (error) {
        console.error(`Error writing output file ${filePath}:`, error);
    }
}

/**
 * Main function to run the translation process.
 */
async function main() {
    console.log('--- Starting Translation ---');
    const lines = await readCommandFile(INPUT_FILE);
    let outputCommands = [];

    for (const line of lines) {
        if (!line.trim()) continue; // Skip empty lines
        const parsed = parseJavaCommand(line);
        if (!parsed) continue;

        const universal = await javaToUniversal(parsed);
        if (!universal) {
             // console.log(`Skipped (Java->Uni failed): ${line}`); // Keep commented for cleaner output
             continue;
        }

        const bedrock = await universalToBedrock(parsed, universal);
        if (!bedrock) {
             // console.log(`Skipped (Uni->Bedrock failed): ${line}`); // Keep commented for cleaner output
            continue;
        }

        const bedrockCommand = formatBedrockCommand(bedrock);
        if (bedrockCommand) {
            outputCommands.push(bedrockCommand);

            // --- GROUPED LOGGING START ---
            console.log(`Processing line: '${line}'`);
            console.log(`\tParsing blockstate string: '${parsed.blockId}'`);
            console.log(`\tUniversal block:
${JSON.stringify(universal, null, 4).split('\n').map(l => `\t\t${l}`).join('\n')}`); 
            console.log(`\tBedrock representation:
${JSON.stringify(bedrock, null, 4).split('\n').map(l => `\t\t${l}`).join('\n')}`);
            console.log(`\tTranslated command: ${bedrockCommand}`);
            console.log('-'.repeat(60)); // Separator
            // --- GROUPED LOGGING END ---

        } else {
            console.warn(`Warning: Could not format Bedrock command for line: ${line}`);
        }
    }

    // --- ADD DEBUG LOGGING FOR OUTPUT ARRAY ---
    console.log('\n--- Commands to be written (first 5): ---');
    console.log(outputCommands.slice(0, 5));
    console.log('--- End commands to be written ---\n');
    // --- END DEBUG LOGGING ---

    await writeCommandFile(OUTPUT_FILE, outputCommands);
    console.log('--- Translation Finished ---');
}

// Export necessary functions
export {
    parseJavaCommand,
    javaToUniversal,
    universalToBedrock,
    formatBedrockCommand
};

// Run main function if this is the main module
if (import.meta.url === new URL(import.meta.url).href) {
    main().catch(err => {
        console.error("Translation failed:", err);
    });
}