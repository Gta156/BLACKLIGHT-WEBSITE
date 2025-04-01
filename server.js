import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

// Import all necessary functions from translator.js
import { 
    parseJavaCommand,
    javaToUniversal,
    universalToBedrock,
    formatBedrockCommand
} from './translator.js';

// Basic server setup
const app = express();
const port = process.env.PORT || 3000;

// Determine directory paths for serving static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Debug logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Translation endpoint
app.post('/translate', async (req, res) => {
    console.log('\n=== New Translation Request ===');
    console.log(`Received at: ${new Date().toISOString()}`);
    
    try {
        const { commands } = req.body;
        if (!Array.isArray(commands)) {
            throw new Error('Commands must be an array');
        }

        console.log(`Processing ${commands.length} commands...\n`);
        
        const translatedCommands = [];
        const errors = [];

        for (const command of commands) {
            console.log(`\nProcessing command: ${command}`);
            
            try {
                // Step 1: Parse Java command
                console.log('Step 1: Parsing Java command...');
                const parsedCommand = parseJavaCommand(command);
                if (!parsedCommand) {
                    console.log(`Skipping invalid command: ${command}`);
                    continue;
                }
                console.log('Parsed command:', JSON.stringify(parsedCommand, null, 2));

                // Step 2: Convert to Universal format
                console.log('\nStep 2: Converting to Universal format...');
                const universalBlock = await javaToUniversal(parsedCommand);
                if (!universalBlock) {
                    console.log(`No mapping found for block: ${parsedCommand.blockId}`);
                    continue;
                }
                console.log('Universal format:', JSON.stringify(universalBlock, null, 2));

                // Step 3: Convert to Bedrock format
                console.log('\nStep 3: Converting to Bedrock format...');
                const bedrockBlock = await universalToBedrock(parsedCommand, universalBlock);
                if (!bedrockBlock) {
                    console.log(`Failed to convert to Bedrock format: ${parsedCommand.blockId}`);
                    continue;
                }
                console.log('Bedrock format:', JSON.stringify(bedrockBlock, null, 2));

                // Step 4: Generate final command
                console.log('\nStep 4: Generating final command...');
                const finalCommand = formatBedrockCommand(bedrockBlock);
                console.log('Final command:', finalCommand);
                
                translatedCommands.push(finalCommand);
                console.log('Successfully translated command');
            } catch (error) {
                console.error(`Error translating command: ${error.message}`);
                errors.push(error.message);
            }
            console.log('\n' + '='.repeat(50)); // Separator between commands
        }

        console.log('\n=== Translation Summary ===');
        console.log(`Total commands processed: ${commands.length}`);
        console.log(`Successfully translated: ${translatedCommands.length}`);
        console.log(`Errors encountered: ${errors.length}`);
        console.log('=== End Translation Request ===\n');

        res.json({
            translatedCommands,
            errors
        });
    } catch (error) {
        console.error('Translation error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Catch-all for serving index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log('\n=== Server Started ===');
    console.log(`Server listening at http://localhost:${port}`);
    console.log(`Serving static files from: ${__dirname}`);
    console.log(`Make sure mapping directories ('java to_universal', 'from_universal to bedrock') are present in: ${__dirname}`);
    console.log('=== Ready for Requests ===\n');
}); 