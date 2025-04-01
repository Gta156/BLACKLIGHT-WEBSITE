import { parseJavaCommand, javaToUniversal, universalToBedrock, formatBedrockCommand } from './translator.js';

// Test cases for different block types and states
const testCases = [
    // Test case 1: Stairs with all states
    {
        name: "Stairs with all states",
        command: 'setblock ~5 ~1 ~6 minecraft:brick_stairs["facing"="west","half"="bottom","shape"="straight"]',
        expectedStates: {
            "weirdo_direction": "1",  // west
            "upside_down_bit": "0b"   // bottom
        }
    },
    // Test case 2: Door with all states
    {
        name: "Door with all states",
        command: 'setblock ~4 ~1 ~8 minecraft:dark_oak_door["facing"="north","half"="lower","hinge"="left","open"="true","powered"="false"]',
        expectedStates: {
            "direction": "3",         // north
            "upper_block_bit": "0b",  // lower
            "open_bit": "1b"         // true
        }
    },
    // Test case 3: Log with axis
    {
        name: "Log with axis",
        command: 'setblock ~7 ~1 ~5 minecraft:spruce_log["axis"="x"]',
        expectedStates: {
            "pillar_axis": "x"
        }
    }
];

async function runTests() {
    console.log('=== Starting Translation Tests ===\n');
    
    for (const testCase of testCases) {
        console.log(`\nTesting: ${testCase.name}`);
        console.log(`Input command: ${testCase.command}`);
        
        // Step 1: Parse Java command
        const parsed = parseJavaCommand(testCase.command);
        console.log('\nParsed command:', JSON.stringify(parsed, null, 2));
        
        // Step 2: Convert to Universal format
        const universal = await javaToUniversal(parsed);
        console.log('\nUniversal format:', JSON.stringify(universal, null, 2));
        
        // Step 3: Convert to Bedrock format
        const bedrock = await universalToBedrock(parsed, universal);
        console.log('\nBedrock format:', JSON.stringify(bedrock, null, 2));
        
        // Step 4: Generate final command
        const finalCommand = formatBedrockCommand(bedrock);
        console.log('\nFinal command:', finalCommand);
        
        // Verify states
        const stateMatches = Object.entries(testCase.expectedStates).every(([key, value]) => 
            bedrock.states[key] === value
        );
        
        console.log('\nState verification:', stateMatches ? 'PASSED' : 'FAILED');
        if (!stateMatches) {
            console.log('Expected states:', testCase.expectedStates);
            console.log('Actual states:', bedrock.states);
        }
        
        console.log('\n' + '='.repeat(50));
    }
    
    console.log('\n=== Test Summary ===');
    console.log(`Total test cases: ${testCases.length}`);
}

// Run the tests
runTests().catch(console.error); 