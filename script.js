// Wait for document to fully load before attaching event handlers
document.addEventListener('DOMContentLoaded', function() {
  // Global variables
  let fileContent = ''; // For Raw to NBT
  let extractedFileContent = ''; // For Extract Commands
  let commandsToStructureContent = ''; // For Commands to Structure

  // Helper function to get UTF-8 byte length
  function getUtf8ByteLength(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str).length;
  }

  // Escapes double quotes in commands
  function escapeQuotes(command) {
    return command.replace(/"/g, '\\\\\\"');
  }

  // Processes file content into an array of commands
  function getUsefulCommands(content) {
    const commands = content.split('\n').map(cmd => cmd.trim()).filter(cmd => cmd.length > 0);
    return commands.map(escapeQuotes);
  }

  // Separates commands into normal and equals types
  function separateCommands(commands) {
    const normalCommands = [];
    const equalsCommands = [];
    commands.forEach(cmd => {
      if (cmd.includes('=')) {
        equalsCommands.push(cmd);
      } else {
        normalCommands.push(cmd);
      }
    });
    return { normalCommands, equalsCommands };
  }

  // NBT block opener
  function getBlockOpener(nbtName) {
    return `{Block:{name:"minecraft:moving_block",states:{},version:17959425},Count:1b,Damage:0s,Name:"minecraft:moving_block",WasPickedUp:0b,tag:{display:{Lore:["Â§lÂ§bBuild By: Â§dGTAî„€","Â§3NBT Tool By: Â§aBrutus314 ","Â§aand Clawsky123î„ ","Â§9Conversion Tool By: ","Â§eExgioan!!î„‚","Â§fSpecial Thanks To:","Â§6Chronicles765!!    î„ƒ","Â§4Warning: Â§cDont Hold Too","Â§cMany Or You Will Lag!!Â§âˆ†"],Name:"Â§lÂ§dGTA Builds: Â§gÂ§l${nbtName}"},ench:[{id:28s,lvl:1s}],movingBlock:{name:"minecraft:sea_lantern",states:{},version:17879555},movingEntity:{Occupants:[`;
  }

  // NBT block closer
  function getBlockCloser() {
    return '],id:"Beehive"}}}';
  }

  // Normal NPC opener
  function getNpcOpener(section, nbtName) {
    return `{ActorIdentifier:"minecraft:npc<>",SaveData:{Actions:"[{"button_name" : "Build Part: ${section}","data" : [`;
  }

  // Normal NPC closer
  function getNpcCloser(section, nbtName) {
    return `],"mode" : 0,"text" : "","type" : 1}]",CustomName:"Â§lÂ§dGTA Builds: ${nbtName}",CustomNameVisible:1b,InterativeText:"Â§cBuild By: Â§dGTA!!î„€\nBuild Part: ${section}\nÂ§cConversion Tool By: Â§dExgioan!!\nÂ§cSpecial Thanks To: Â§dChronicles765!!! î„ƒ\nÂ§6Thanks For Trying My ${nbtName} Build!!!",Persistent:1b,Pos:[],RawtextName:"Â§lÂ§dGTA Builds: ${nbtName}",Tags:["${nbtName}${section}"],Variant:3,definitions:["+minecraft:npc"],identifier:"minecraft:npc"},TicksLeftToStay:0}`;
  }

  // Equals NPC opener
  function getEqualsNpcOpener(section, nbtName) {
    return `{ActorIdentifier:"minecraft:npc<>",SaveData:{"Actions":"[{\\"button_name\\" : \\"Build Part: ${section}\\",       \\"data\\" : [`;
  }

  // Equals NPC closer
  function getEqualsNpcCloser(section, nbtName) {
    return `],       \\"mode\\" : 0,       \\"text\\" : \\"\\",       \\"type\\" : 1}]",CustomName:"Â§lÂ§dGTA Builds: ${nbtName}",CustomNameVisible:1b,InteractiveText:"§cBuild By:"Â§cBuild By: Â§dGTA!!î„€\nBuild Part: ${section}\nÂ§cConversion Tool By: Â§dExgioan!!\nÂ§cSpecial Thanks To: Â§dChronicles765!!!\n§6Thanks For Trying My ${nbtName} Build!!!",Persistent:1b,Pos:[],RawtextName:"Â§lÂ§dGTA Builds: ${nbtName}",Tags:["${nbtName}${section}"],Variant:3,definitions:["+minecraft:npc"],identifier:"minecraft:npc"},TicksLeftToStay:0}`;
  }

  // Joins normal commands
  function commandJoinerNormal(commands) {
    return commands.map(cmd => `{"cmd_line":"${cmd}","cmd_ver":12}`).join(',');
  }

  // Joins equals commands with specific formatting
  function commandJoinerEquals(commands) {
    return commands.map(cmd => `          {             \\"cmd_line\\":\\"${cmd}\\",             \\"cmd_ver\\" : 42          }`).join(',');
  }

  // Processes commands into NPC blocks with byte limit
  function processNpcCommandsByBytes(commands, maxBytes, nbtName, startSection, joiner, isEquals) {
    const npcDataList = [];
    let currentCommands = [];
    let currentSection = startSection;
    const openerFunc = isEquals ? getEqualsNpcOpener : getNpcOpener;
    const closerFunc = isEquals ? getEqualsNpcCloser : getNpcCloser;

    for (const cmd of commands) {
      const candidateCommands = [...currentCommands, cmd];
      const candidateJoined = joiner(candidateCommands);
      const openerText = openerFunc(currentSection, nbtName);
      const closerText = closerFunc(currentSection, nbtName);
      const candidateBlock = openerText + candidateJoined + closerText;
      const candidateByteLength = getUtf8ByteLength(candidateBlock);

      if (candidateByteLength <= maxBytes) {
        currentCommands.push(cmd);
      } else {
        // Finalize current block
        const npcCommandList = [...currentCommands];
        if (!isEquals) {
          npcCommandList.push('/tickingarea add circle ~60 ~20 ~60 4 NPCCOMMANDS');
        } else {
          npcCommandList.push('/tickingarea add circle ~60 ~20 ~60 4 EQUALSCOMMANDS');
        }
        npcCommandList.push(`/dialogue open @e[tag=${nbtName}${currentSection + 1},type=NPC] @initiator`);
        npcCommandList.push('/kill @s');
        if (!isEquals) {
          npcCommandList.push('/tickingarea remove NPCCOMMANDS');
        } else {
          npcCommandList.push('/tickingarea remove EQUALSCOMMANDS');
        }
        const joinedCommands = joiner(npcCommandList);
        const npcBlock = openerFunc(currentSection, nbtName) + joinedCommands + closerFunc(currentSection, nbtName);
        npcDataList.push(npcBlock);
        // Start new block
        currentSection += 1;
        currentCommands = [cmd];
      }
    }

    // Finalize last block
    if (currentCommands.length > 0) {
      const npcCommandList = [...currentCommands];
      if (!isEquals) {
        npcCommandList.push('/tickingarea add circle ~60 ~20 ~60 4 NPCCOMMANDS');
      } else {
        npcCommandList.push('/tickingarea add circle ~60 ~20 ~60 4 EQUALSCOMMANDS');
      }
      npcCommandList.push('/kill @s');
      if (!isEquals) {
        npcCommandList.push('/tickingarea remove NPCCOMMANDS');
      } else {
        npcCommandList.push('/tickingarea remove EQUALSCOMMANDS');
      }
      const joinedCommands = joiner(npcCommandList);
      const npcBlock = openerFunc(currentSection, nbtName) + joinedCommands + closerFunc(currentSection, nbtName);
      npcDataList.push(npcBlock);
    }

    return { npcData: npcDataList.join(','), count: npcDataList.length };
  }

  // File reading function
  function readFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      fileContent = e.target.result;
      document.getElementById('drop-area').innerHTML = '<i class="fas fa-check-circle" style="color: #2ecc71;"></i><p>File loaded. Ready to generate NBT.</p><p class="text-muted small">Click here to select a different file</p><input type="file" id="input-file" accept=".txt" class="file-input">';
      
      // Setup drop area to work as a reset button too
      const dropArea = document.getElementById('drop-area');
      if(dropArea) {
        dropArea.onclick = function(e) {
          if(fileContent && document.getElementById('output-preview').style.display === 'block') {
            // If we already have output showing, clicking should reset
            resetToolSection('raw-to-nbt');
          } else {
            // Otherwise just select a new file
            document.getElementById('input-file').click();
          }
        };
      }
      
      // Reattach file input event
      const inputFile = document.getElementById('input-file');
      if(inputFile) {
        inputFile.onchange = function(e) {
          const file = e.target.files[0];
          if (file) readFile(file);
        };
      }
      
      // Reattach drag and drop events
      attachDropAreaEvents();
    };
    reader.readAsText(file);
  }

  // Set up direct click handlers for all drop areas
  const dropArea = document.getElementById('drop-area');
  if(dropArea) {
    dropArea.onclick = function(e) {
      // Don't trigger if we clicked the reset button
      if (e.target.classList.contains('reset-file-btn')) return;
      document.getElementById('input-file').click();
    };
  }

  const extractDropArea = document.getElementById('extract-drop-area');
  if(extractDropArea) {
    extractDropArea.onclick = function(e) {
      // Don't trigger if we clicked the reset button
      if (e.target.classList.contains('reset-file-btn')) return;
      document.getElementById('extract-input-file').click();
    };
  }

  const cmdStructDropArea = document.getElementById('cmd-struct-drop-area');
  if(cmdStructDropArea) {
    cmdStructDropArea.onclick = function(e) {
      // Don't trigger if we clicked the reset button
      if (e.target.classList.contains('reset-file-btn')) return;
      document.getElementById('cmd-struct-input-file').click();
    };
  }

  // Also set up direct change handlers for file inputs
  const inputFile = document.getElementById('input-file');
  if(inputFile) {
    inputFile.onchange = function(e) {
      const file = e.target.files[0];
      if (file) readFile(file);
    };
  }

  const extractInputFile = document.getElementById('extract-input-file');
  if(extractInputFile) {
    extractInputFile.onchange = function(e) {
      const file = e.target.files[0];
      if (file) readExtractFile(file);
    };
  }

  const cmdStructInputFile = document.getElementById('cmd-struct-input-file');
  if(cmdStructInputFile) {
    cmdStructInputFile.onchange = function(e) {
      const file = e.target.files[0];
      if (file) readCommandsToStructureFile(file);
    };
  }

  // Function to attach drop area events (now only for drag and drop)
  function attachDropAreaEvents() {
    // Raw to NBT
    const dropArea = document.getElementById('drop-area');
    if(dropArea) {
      dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('dragover');
      });
      dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('dragover');
      });
      dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) readFile(file);
      });
    }
    
    // Extract Commands
    const extractDropArea = document.getElementById('extract-drop-area');
    if(extractDropArea) {
      extractDropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        extractDropArea.classList.add('dragover');
      });
      extractDropArea.addEventListener('dragleave', () => {
        extractDropArea.classList.remove('dragover');
      });
      extractDropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        extractDropArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) readExtractFile(file);
      });
    }
    
    // Commands to Structure
    const cmdStructDropArea = document.getElementById('cmd-struct-drop-area');
    if(cmdStructDropArea) {
      cmdStructDropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        cmdStructDropArea.classList.add('dragover');
      });
      cmdStructDropArea.addEventListener('dragleave', () => {
        cmdStructDropArea.classList.remove('dragover');
      });
      cmdStructDropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        cmdStructDropArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) readCommandsToStructureFile(file);
      });
    }
  }

  // Extract Commands Functionality
  function cleanJsonString(str) {
    // Remove any potential BOM characters
    str = str.replace(/^\uFEFF/, '');

    // Handle escaped quotes and backslashes
    str = str.replace(/\\\\/g, '\\')
             .replace(/\\"/g, '"')
             .replace(/\\\\/g, '\\');

    // Handle any remaining escape sequences
    str = str.replace(/\\n/g, '\n')
             .replace(/\\r/g, '\r')
             .replace(/\\t/g, '\t');

    return str;
  }

  function extractCommands(content) {
    try {
      // Find all Actions arrays in the file using a more robust regex
      const actionsRegex = /"Actions"\s*:\s*"(\[(?:[^"\\]|\\.|"(?:[^"\\]|\\.)*")*\])"/g;
      const matches = [...content.matchAll(actionsRegex)];

      let allCommands = [];

      matches.forEach(match => {
        try {
          // Clean and parse the Actions array
          const actionsStr = cleanJsonString(match[1]);

          let actions;
          try {
            actions = JSON.parse(actionsStr);
          } catch (parseError) {
            // Try removing any invalid characters and parse again
            const cleanedStr = actionsStr.replace(/[^\x20-\x7E]/g, '');
            actions = JSON.parse(cleanedStr);
          }

          if (!Array.isArray(actions)) {
            throw new Error('Actions is not an array');
          }

          // Extract commands from each action
          actions.forEach(action => {
            if (action && action.data && Array.isArray(action.data)) {
              action.data.forEach(cmd => {
                if (cmd && cmd.cmd_line) {
                  allCommands.push(cmd.cmd_line.trim());
                }
              });
            }
          });
        } catch (e) {
          console.error('Error processing Actions:', e.message);
        }
      });

      return allCommands;

    } catch (error) {
      console.error('Error processing file:', error.message);
      return [];
    }
  }

  // Extract Commands File Reading
  function readExtractFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      extractedFileContent = e.target.result;
      document.getElementById('extract-drop-area').innerHTML = '<i class="fas fa-check-circle" style="color: #2ecc71;"></i><p>File loaded. Ready to extract commands.</p><p class="text-muted small">Click here to select a different file</p><input type="file" id="extract-input-file" accept=".txt" class="file-input">';
      
      // Setup drop area to work as a reset button too
      const extractDropArea = document.getElementById('extract-drop-area');
      if(extractDropArea) {
        extractDropArea.onclick = function(e) {
          if(extractedFileContent && document.getElementById('extract-output-preview').style.display === 'block') {
            // If we already have output showing, clicking should reset
            resetToolSection('extract-commands');
          } else {
            // Otherwise just select a new file
            document.getElementById('extract-input-file').click();
          }
        };
      }
      
      // Reattach file input event
      const extractInputFile = document.getElementById('extract-input-file');
      if(extractInputFile) {
        extractInputFile.onchange = function(e) {
          const file = e.target.files[0];
          if (file) readExtractFile(file);
        };
      }
      
      // Reattach drag and drop events
      attachDropAreaEvents();
    };
    reader.readAsText(file);
  }

  // Commands to Structure Functionality
  function readCommandsToStructureFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      commandsToStructureContent = e.target.result;
      document.getElementById('cmd-struct-drop-area').innerHTML = '<i class="fas fa-check-circle" style="color: #2ecc71;"></i><p>File loaded. Ready to convert to structure.</p><p class="text-muted small">Click here to select a different file</p><input type="file" id="cmd-struct-input-file" accept=".txt" class="file-input">';
      
      // Setup drop area to work as a reset button too
      const cmdStructDropArea = document.getElementById('cmd-struct-drop-area');
      if(cmdStructDropArea) {
        cmdStructDropArea.onclick = function(e) {
          if(commandsToStructureContent && document.getElementById('cmd-struct-output-preview').style.display === 'block') {
            // If we already have output showing, clicking should reset
            resetToolSection('commands-to-structure');
          } else {
            // Otherwise just select a new file
            document.getElementById('cmd-struct-input-file').click();
          }
        };
      }
      
      // Reattach file input event
      const cmdStructInputFile = document.getElementById('cmd-struct-input-file');
      if(cmdStructInputFile) {
        cmdStructInputFile.onchange = function(e) {
          const file = e.target.files[0];
          if (file) readCommandsToStructureFile(file);
        };
      }
      
      // Reattach drag and drop events
      attachDropAreaEvents();
    };
    reader.readAsText(file);
  }

  // Function to reset a specific tool section
  function resetToolSection(section) {
    switch(section) {
      case 'raw-to-nbt':
        fileContent = '';
        document.getElementById('drop-area').innerHTML = '<i class="fas fa-file-upload"></i><p>Drag and drop your file here, or click to select one</p><input type="file" id="input-file" accept=".txt" class="file-input">';
        document.getElementById('output-preview').style.display = 'none';
        break;
      case 'extract-commands':
        extractedFileContent = '';
        document.getElementById('extract-drop-area').innerHTML = '<i class="fas fa-file-upload"></i><p>Drag and drop your NBT file here, or click to select one</p><input type="file" id="extract-input-file" accept=".txt" class="file-input">';
        document.getElementById('extract-output-preview').style.display = 'none';
        break;
      case 'commands-to-structure':
        commandsToStructureContent = '';
        document.getElementById('cmd-struct-drop-area').innerHTML = '<i class="fas fa-file-upload"></i><p>Drag and drop your commands file here, or click to select one</p><input type="file" id="cmd-struct-input-file" accept=".txt" class="file-input">';
        document.getElementById('cmd-struct-output-preview').style.display = 'none';
        break;
    }
    
    // Reattach click handlers for the drop areas and file inputs
    const dropArea = document.getElementById('drop-area');
    if(dropArea) {
      dropArea.onclick = function(e) {
        if (e.target.classList.contains('reset-file-btn')) return;
        document.getElementById('input-file').click();
      };
    }

    const extractDropArea = document.getElementById('extract-drop-area');
    if(extractDropArea) {
      extractDropArea.onclick = function(e) {
        if (e.target.classList.contains('reset-file-btn')) return;
        document.getElementById('extract-input-file').click();
      };
    }

    const cmdStructDropArea = document.getElementById('cmd-struct-drop-area');
    if(cmdStructDropArea) {
      cmdStructDropArea.onclick = function(e) {
        if (e.target.classList.contains('reset-file-btn')) return;
        document.getElementById('cmd-struct-input-file').click();
      };
    }

    // Set up file input change handlers
    const inputFile = document.getElementById('input-file');
    if(inputFile) {
      inputFile.onchange = function(e) {
        const file = e.target.files[0];
        if (file) readFile(file);
      };
    }

    const extractInputFile = document.getElementById('extract-input-file');
    if(extractInputFile) {
      extractInputFile.onchange = function(e) {
        const file = e.target.files[0];
        if (file) readExtractFile(file);
      };
    }

    const cmdStructInputFile = document.getElementById('cmd-struct-input-file');
    if(cmdStructInputFile) {
      cmdStructInputFile.onchange = function(e) {
        const file = e.target.files[0];
        if (file) readCommandsToStructureFile(file);
      };
    }
    
    // Reattach drag and drop event listeners
    attachDropAreaEvents();
  }

  // Initially attach all event listeners
  attachDropAreaEvents();

  // Generate NBT button event listener
  const generateButton = document.getElementById('generate-button');
  if(generateButton) {
    generateButton.addEventListener('click', () => {
      if (!fileContent) {
        showValidationMessage('Please select a file.');
        return;
      }

      const nbtTitle = document.getElementById('nbt-title').value.trim();
      const maxBytesInput = document.getElementById('bytes-per-npc').value.trim();
      let maxBytes;
      try {
        maxBytes = parseInt(maxBytesInput, 10);
        if (isNaN(maxBytes) || maxBytes <= 0) throw new Error();
      } catch {
        showValidationMessage('Please enter a valid positive integer for Max Bytes per NPC.');
        return;
      }

      const commands = getUsefulCommands(fileContent);
      const { normalCommands, equalsCommands } = separateCommands(commands);
      const nbtName = nbtTitle || 'GTA Builds';

      let nbtData = getBlockOpener(nbtName);
      let curSec = 0;

      if (normalCommands.length > 0) {
        const { npcData, count } = processNpcCommandsByBytes(normalCommands, maxBytes, nbtName, curSec, commandJoinerNormal, false);
        nbtData += npcData;
        curSec += count;
      }

      if (equalsCommands.length > 0) {
        if (normalCommands.length > 0) nbtData += ',';
        const { npcData, count } = processNpcCommandsByBytes(equalsCommands, maxBytes, nbtName, curSec, commandJoinerEquals, true);
        nbtData += npcData;
      }

      nbtData += getBlockCloser();

      // Display preview
      const previewText = document.getElementById('preview-text');
      previewText.value = nbtData;
      document.getElementById('output-preview').style.display = 'block';
      document.getElementById('download-button').disabled = false;
    });
  }

  // Download button event listener
  const downloadButton = document.getElementById('download-button');
  if(downloadButton) {
    downloadButton.addEventListener('click', () => {
      const nbtText = document.getElementById('preview-text').value;
      const nbtTitle = document.getElementById('nbt-title').value.trim();
      const nbtName = nbtTitle || 'GTA Builds';
      const fileName = `Horion GTA ${nbtName} Build.txt`;

      const blob = new Blob([nbtText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // Validation message display function
  function showValidationMessage(message) {
    const validationMessage = document.getElementById('validation-message');
    if(validationMessage) {
      validationMessage.textContent = message;
      validationMessage.style.display = 'block';
      setTimeout(() => {
        validationMessage.style.display = 'none';
      }, 5000);
    }
  }

  // Extract Commands Button Event Listener
  const extractButton = document.getElementById('extract-button');
  if(extractButton) {
    extractButton.addEventListener('click', () => {
      if (!extractedFileContent) {
        showExtractValidationMessage('Please select a file.');
        return;
      }

      const commands = extractCommands(extractedFileContent);

      if (commands.length === 0) {
        showExtractValidationMessage('No commands found in the file.');
        return;
      }

      // Display extracted commands
      const previewText = document.getElementById('extract-preview-text');
      previewText.value = commands.join('\n');
      document.getElementById('extract-output-preview').style.display = 'block';
      document.getElementById('extract-download-button').disabled = false;
    });
  }

  // Download Extracted Commands Button Event Listener
  const extractDownloadButton = document.getElementById('extract-download-button');
  if(extractDownloadButton) {
    extractDownloadButton.addEventListener('click', () => {
      const commandsText = document.getElementById('extract-preview-text').value;
      const fileName = 'extracted_commands.txt';

      const blob = new Blob([commandsText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // Extract Validation Message Display Function
  function showExtractValidationMessage(message) {
    const validationMessage = document.getElementById('extract-validation-message');
    validationMessage.textContent = message;
    validationMessage.style.display = 'block';
    setTimeout(() => {
      validationMessage.style.display = 'none';
    }, 5000);
  }

  // Commands to Structure Functionality

  // --- NBT Tag Type Constants ---
  const TAG_End = 0;
  const TAG_Byte = 1;
  const TAG_Short = 2;
  const TAG_Int = 3;
  const TAG_Long = 4;
  const TAG_Float = 5;
  const TAG_Double = 6;
  const TAG_Byte_Array = 7;
  const TAG_String = 8;
  const TAG_List = 9;
  const TAG_Compound = 10;
  // --- End NBT Tag Type Constants ---

  // --- NBT Writing Helper Functions ---
  function writeByte(buffer, offset, value) {
    buffer.setInt8(offset, value);
    return offset + 1;
  }

  function writeUnsignedShort(buffer, offset, value) {
    buffer.setUint16(offset, value, true); // true for little-endian
    return offset + 2;
  }

  function writeInt(buffer, offset, value) {
    buffer.setInt32(offset, value, true); // true for little-endian
    return offset + 4;
  }

  function writeStringPayload(buffer, offset, text) {
    if (text === null || text === undefined) text = "";
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(text);
    offset = writeUnsignedShort(buffer, offset, utf8Bytes.length);
    for (let i = 0; i < utf8Bytes.length; i++) {
      buffer.setUint8(offset + i, utf8Bytes[i]);
    }
    return offset + utf8Bytes.length;
  }

  function getNbtType(value) {
    if (typeof value === "boolean") return TAG_Byte;
    if (typeof value === "number") {
      if (Number.isInteger(value)) return TAG_Int;
      return TAG_Float;
    }
    if (typeof value === "string") return TAG_String;
    if (Array.isArray(value)) return TAG_List;
    if (typeof value === "object" && value !== null) return TAG_Compound;
    throw new TypeError(`Unsupported JavaScript type for NBT conversion: ${typeof value}`);
  }

  // Placeholder to track current buffer position
  let currentOffset = 0;

  function writeTag(buffer, name, value) {
    // Write tag type
    currentOffset = writeByte(buffer, currentOffset, getNbtType(value));

    // Write name if provided
    if (name !== null && name !== undefined) {
      currentOffset = writeStringPayload(buffer, currentOffset, name);
    }

    // Write payload based on type
    if (typeof value === "boolean") {
      currentOffset = writeByte(buffer, currentOffset, value ? 1 : 0);
    } else if (Number.isInteger(value)) {
      currentOffset = writeInt(buffer, currentOffset, value);
    } else if (typeof value === "number") {
      const floatArray = new Float32Array(1);
      floatArray[0] = value;
      const intValue = new Int32Array(floatArray.buffer)[0];
      currentOffset = writeInt(buffer, currentOffset, intValue);
    } else if (typeof value === "string") {
      currentOffset = writeStringPayload(buffer, currentOffset, value);
    } else if (Array.isArray(value)) {
      currentOffset = writeListPayload(buffer, value);
    } else if (typeof value === "object" && value !== null) {
      currentOffset = writeCompoundPayload(buffer, value);
    }

    return currentOffset;
  }

  function writeCompoundPayload(buffer, dataObj) {
    for (const [key, value] of Object.entries(dataObj)) {
      currentOffset = writeTag(buffer, key, value);
    }
    currentOffset = writeByte(buffer, currentOffset, TAG_End);
    return currentOffset;
  }

  function writeListPayload(buffer, dataList) {
    if (!dataList.length) {
      // Empty list
      currentOffset = writeByte(buffer, currentOffset, TAG_End);
      currentOffset = writeInt(buffer, currentOffset, 0);
      return currentOffset;
    }

    // Determine element type from first item
    const firstItem = dataList[0];
    let elementType;

    if (Array.isArray(firstItem)) {
      elementType = TAG_List;
    } else {
      elementType = getNbtType(firstItem);
    }

    currentOffset = writeByte(buffer, currentOffset, elementType);
    currentOffset = writeInt(buffer, currentOffset, dataList.length);

    // Write element payloads (no names for list items)
    for (const item of dataList) {
      if (typeof item === "boolean") {
        currentOffset = writeByte(buffer, currentOffset, item ? 1 : 0);
      } else if (Number.isInteger(item)) {
        currentOffset = writeInt(buffer, currentOffset, item);
      } else if (typeof item === "string") {
        currentOffset = writeStringPayload(buffer, currentOffset, item);
      } else if (Array.isArray(item)) {
        currentOffset = writeListPayload(buffer, item);
      } else if (typeof item === "object" && item !== null) {
        currentOffset = writeCompoundPayload(buffer, item);
      }
    }

    return currentOffset;
  }

  // Function to estimate buffer size needed for NBT data
  function estimateBufferSize(data) {
    // More generous allocation for larger files
    const jsonSize = JSON.stringify(data).length;
    return Math.max(jsonSize * 4, 10 * 1024 * 1024); // At least 10MB or 4x JSON size
  }

  function createNbtBuffer(data) {
    try {
      // Estimate buffer size needed
      const estimatedSize = estimateBufferSize(data);

      // Create ArrayBuffer and DataView
      const arrayBuffer = new ArrayBuffer(estimatedSize);
      const buffer = new DataView(arrayBuffer);

      // Reset offset tracker
      currentOffset = 0;

      // Write the root compound tag
      currentOffset = writeByte(buffer, currentOffset, TAG_Compound);
      currentOffset = writeStringPayload(buffer, currentOffset, ""); // Empty name for root

      // Non-recursive compound writing for the root object
      const pendingKeys = Object.keys(data);

      // Process all root level keys
      for (const key of pendingKeys) {
        const value = data[key];
        writeTagNonRecursive(buffer, key, value);
      }

      // Write end tag for compound
      currentOffset = writeByte(buffer, currentOffset, TAG_End);

      // Return only the portion of the buffer that was used
      return arrayBuffer.slice(0, currentOffset);
    } catch (e) {
      console.error("Error during NBT buffer creation:", e);
      throw e;
    }
  }

  // Non-recursive tag writing to avoid stack overflows with large structures
  function writeTagNonRecursive(buffer, name, value) {
    try {
      // Write tag type
      currentOffset = writeByte(buffer, currentOffset, getNbtType(value));

      // Write name if provided
      if (name !== null && name !== undefined) {
        currentOffset = writeStringPayload(buffer, currentOffset, name);
      }

      // Write payload based on type (without recursion for compounds and lists)
      if (typeof value === "boolean") {
        currentOffset = writeByte(buffer, currentOffset, value ? 1 : 0);
      } else if (Number.isInteger(value)) {
        currentOffset = writeInt(buffer, currentOffset, value);
      } else if (typeof value === "number") {
        const floatArray = new Float32Array(1);
        floatArray[0] = value;
        const intValue = new Int32Array(floatArray.buffer)[0];
        currentOffset = writeInt(buffer, currentOffset, intValue);
      } else if (typeof value === "string") {
        currentOffset = writeStringPayload(buffer, currentOffset, value);
      } else if (Array.isArray(value)) {
        writeListNonRecursive(buffer, value);
      } else if (typeof value === "object" && value !== null) {
        // Write compound start - keys will be written individually

        // Get all keys
        const keys = Object.keys(value);

        // Write each tag in the compound
        for (const key of keys) {
          writeTagNonRecursive(buffer, key, value[key]);
        }

        // Write end tag for this compound
        currentOffset = writeByte(buffer, currentOffset, TAG_End);
      }
    } catch (e) {
      console.error(`Error writing tag ${name}:`, e);
      throw e;
    }
  }

  // Non-recursive list writing
  function writeListNonRecursive(buffer, dataList) {
    try {
      if (!dataList.length) {
        // Empty list
        currentOffset = writeByte(buffer, currentOffset, TAG_End);
        currentOffset = writeInt(buffer, currentOffset, 0);
        return;
      }

      // Determine element type from first item
      const firstItem = dataList[0];
      let elementType;

      if (Array.isArray(firstItem)) {
        elementType = TAG_List;
      } else {
        elementType = getNbtType(firstItem);
      }

      currentOffset = writeByte(buffer, currentOffset, elementType);
      currentOffset = writeInt(buffer, currentOffset, dataList.length);

      // Write each element in the list
      for (let i = 0; i < dataList.length; i++) {
        const item = dataList[i];

        // Write item payload without names (list items don't have names)
        if (typeof item === "boolean") {
          currentOffset = writeByte(buffer, currentOffset, item ? 1 : 0);
        } else if (Number.isInteger(item)) {
          currentOffset = writeInt(buffer, currentOffset, item);
        } else if (typeof item === "string") {
          currentOffset = writeStringPayload(buffer, currentOffset, item);
        } else if (Array.isArray(item)) {
          // For nested lists, process them individually
          writeListNonRecursive(buffer, item);
        } else if (typeof item === "object" && item !== null) {
          // For objects in lists, process their keys
          const objKeys = Object.keys(item);

          for (const key of objKeys) {
            writeTagNonRecursive(buffer, key, item[key]);
          }

          // Write end tag for this object
          currentOffset = writeByte(buffer, currentOffset, TAG_End);
        }
      }
    } catch (e) {
      console.error("Error writing list:", e);
      throw e;
    }
  }

  // --- Command Processing Functions ---
  let commandsToStructureData = {
    format_version: 1,
    size: [0, 0, 0],
    structure: {
      block_indices: [[], []],
      entities: [],
      palette: {
        default: {
          block_palette: [],
          block_position_data: {}
        }
      }
    },
    structure_world_origin: [0, 0, 0]
  };

  let blocksMap = {};

  function parseCoordinate(coordStr) {
    coordStr = coordStr.trim();
    if (coordStr.startsWith('~')) {
      const offset = coordStr.substring(1);
      return offset ? parseInt(offset) : 0;
    } else {
      return parseInt(coordStr);
    }
  }

  function parseBlockWithStates(blockStr) {
    blockStr = blockStr.trim();
    const match = blockStr.match(/^([\w:]+)(?:\[(.*)\])?/);
    if (!match) {
      console.warn(`Could not parse block string: ${blockStr}`);
      return [blockStr, {}];
    }

    const blockName = match[1];
    const statesStr = match[2] || '';
    const states = {};

    if (statesStr) {
      const statePairs = statesStr.match(/([\w:"\-]+)\s*=\s*([\w"\-.+]+)/g) || [];

      for (const pair of statePairs) {
        const [key, value] = pair.split('=').map(s => s.trim());
        const cleanKey = key.replace(/"/g, '');
        const valueLower = value.toLowerCase();

        if (valueLower === 'true') {
          states[cleanKey] = true;
        } else if (valueLower === 'false') {
          states[cleanKey] = false;
        } else {
          const numValue = parseInt(value);
          states[cleanKey] = isNaN(numValue) ? value.replace(/"/g, '') : numValue;
        }
      }
    }

    return [blockName, states];
  }

  function processCommands(commandsText) {
    // Reset data
    blocksMap = {};
    let commandCount = 0;
    let errorCount = 0;
    const baseX = 0, baseY = 0, baseZ = 0;

    const commands = commandsText.split('\n');

    for (let lineNum = 0; lineNum < commands.length; lineNum++) {
      const cmd = commands[lineNum].trim();
      if (!cmd || cmd.startsWith('#')) continue;

      const parts = cmd.split(/\s+/);
      const commandName = parts[0].toLowerCase();
      commandCount++;

      try {
        if (commandName === 'fill' && parts.length >= 8) {
          const x1 = baseX + parseCoordinate(parts[1]);
          const y1 = baseY + parseCoordinate(parts[2]);
          const z1 = baseZ + parseCoordinate(parts[3]);
          const x2 = baseX + parseCoordinate(parts[4]);
          const y2 = baseY + parseCoordinate(parts[5]);
          const z2 = baseZ + parseCoordinate(parts[6]);

          const blockStr = parts.slice(7).join(' ');
          const [blockName, states] = parseBlockWithStates(blockStr);

          const startX = Math.min(x1, x2);
          const endX = Math.max(x1, x2);
          const startY = Math.min(y1, y2);
          const endY = Math.max(y1, y2);
          const startZ = Math.min(z1, z2);
          const endZ = Math.max(z1, z2);

          for (let x = startX; x <= endX; x++) {
            if (!blocksMap[x]) blocksMap[x] = {};

            for (let y = startY; y <= endY; y++) {
              if (!blocksMap[x][y]) blocksMap[x][y] = {};

              for (let z = startZ; z <= endZ; z++) {
                blocksMap[x][y][z] = [blockName, {...states}];
              }
            }
          }
        }
        else if (commandName === 'setblock' && parts.length >= 5) {
          const x = baseX + parseCoordinate(parts[1]);
          const y = baseY + parseCoordinate(parts[2]);
          const z = baseZ + parseCoordinate(parts[3]);

          const blockStr = parts.slice(4).join(' ');
          const [blockName, states] = parseBlockWithStates(blockStr);

          if (!blocksMap[x]) blocksMap[x] = {};
          if (!blocksMap[x][y]) blocksMap[x][y] = {};
          blocksMap[x][y][z] = [blockName, states];
        }
        else {
          console.warn(`Skipping unrecognized command line ${lineNum + 1}: ${cmd}`);
          errorCount++;
        }
      } catch (e) {
        console.error(`Error processing line ${lineNum + 1}: '${cmd}' - ${e.message}`);
        errorCount++;
      }
    }

    console.log(`Processed ${commandCount} commands with ${errorCount} errors/warnings.`);
    if (Object.keys(blocksMap).length === 0) {
      console.warn("Warning: No blocks parsed.");
    }

    return {
      commandCount,
      errorCount,
      blocksFound: Object.keys(blocksMap).length > 0
    };
  }

  function convertToStructureData() {
    try {
      console.log("Starting conversion to structure data...");

      // Get all coordinates with blocks
      const allX = Object.keys(blocksMap).map(Number);

      // If no blocks, return early
      if (allX.length === 0) {
        return { success: false, message: "No blocks found. Cannot generate structure." };
      }

      // Calculate bounds more efficiently
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;

      // First pass - just find min/max bounds
      for (const x in blocksMap) {
        const numX = Number(x);
        minX = Math.min(minX, numX);
        maxX = Math.max(maxX, numX);

        for (const y in blocksMap[x]) {
          const numY = Number(y);
          minY = Math.min(minY, numY);
          maxY = Math.max(maxY, numY);

          for (const z in blocksMap[x][y]) {
            const numZ = Number(z);
            minZ = Math.min(minZ, numZ);
            maxZ = Math.max(maxZ, numZ);
          }
        }
      }

      // Calculate dimensions
      const width = maxX - minX + 1;
      const height = maxY - minY + 1;
      const depth = maxZ - minZ + 1;

      // Check if the structure is too large (warn about sizes over 10 million blocks)
      const totalBlocks = width * height * depth;
      if (totalBlocks > 10000000) {
        console.warn(`WARNING: Very large structure with ${totalBlocks} potential blocks (${width}x${height}x${depth})`);
      }

      console.log(`Bounds: X(${minX}-${maxX}), Y(${minY}-${maxY}), Z(${minZ}-${maxZ}). Size: ${width}x${height}x${depth}`);

      // Create palette - use more memory efficient approach
      const uniqueBlocks = new Map(); // Use Map instead of object literal
      const palette = [];
      let blockCount = 0;

      // First pass - create palette
      for (let x = minX; x <= maxX; x++) {
        const xBlocks = blocksMap[x];
        if (!xBlocks) continue;

        for (let y = minY; y <= maxY; y++) {
          const yBlocks = xBlocks[y];
          if (!yBlocks) continue;

          for (let z = minZ; z <= maxZ; z++) {
            const blockData = yBlocks[z];
            if (!blockData) continue;

            blockCount++;
            const [blockName, states] = blockData;

            let blockIdStr = blockName;
            if (!blockName.includes(':')) {
              blockIdStr = `minecraft:${blockName}`;
            }

            // Create unique key for this block+state combination
            const stateEntries = Object.entries(states || {}).sort((a, b) => a[0].localeCompare(b[0]));
            const blockKey = JSON.stringify([blockIdStr, stateEntries]);

            if (!uniqueBlocks.has(blockKey)) {
              const index = palette.length;
              uniqueBlocks.set(blockKey, index);
              palette.push({
                name: blockIdStr,
                states: states || {},
                version: 18163713
              });
            }
          }
        }
      }

      console.log(`Found ${blockCount} blocks, created palette with ${palette.length} unique entries.`);

      // Second pass - create block indices
      // Use regular arrays since order matters
      const blockIndicesLayer0 = [];
      const airIndex = -1;

      // Use the original index ordering as before
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = minZ; z <= maxZ; z++) {
            if (blocksMap[x] && blocksMap[x][y] && blocksMap[x][y][z]) {
              const [blockName, states] = blocksMap[x][y][z];

              let blockIdStr = blockName;
              if (!blockName.includes(':')) {
                blockIdStr = `minecraft:${blockName}`;
              }

              // Create unique key for this block+state combination
              const stateEntries = Object.entries(states || {}).sort((a, b) => a[0].localeCompare(b[0]));
              const blockKey = JSON.stringify([blockIdStr, stateEntries]);

              if (uniqueBlocks.has(blockKey)) {
                blockIndicesLayer0.push(uniqueBlocks.get(blockKey));
              } else {
                console.error(`Error: Block ${blockKey} at (${x},${y},${z}) not in palette! Using air.`);
                blockIndicesLayer0.push(airIndex);
              }
            } else {
              blockIndicesLayer0.push(airIndex);
            }
          }
        }
      }


      // Update structure data
      commandsToStructureData.size = [width, height, depth];
      commandsToStructureData.structure_world_origin = [minX, minY, minZ];

      // Create empty secondary layer
      const blockIndicesLayer1 = Array(totalBlocks).fill(-1);

      commandsToStructureData.structure.block_indices = [blockIndicesLayer0, blockIndicesLayer1];
      commandsToStructureData.structure.palette.default.block_palette = palette;
      commandsToStructureData.structure.entities = [];
      commandsToStructureData.structure.palette.default.block_position_data = {};

      return {
        success: true,
        data: commandsToStructureData,
        dimensions: { width, height, depth },
        origin: [minX, minY, minZ],
        blockCount,
        paletteCount: palette.length
      };
    } catch (e) {
      console.error("Critical error during conversion:", e);
      return {
        success: false,
        message: `Error during conversion: ${e.message}`
      };
    }
  }

  function downloadMcstructure(data, filename) {
    try {
      // Show processing message
      showCmdStructValidationMessage('Creating NBT file, please wait...', 'info');

      // Use setTimeout to give UI a chance to update
      setTimeout(() => {
        try {
          // Create NBT buffer
          const nbtBuffer = createNbtBuffer(data);

          // Create Blob and download
          const blob = new Blob([nbtBuffer], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename || 'structure.mcstructure';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          showCmdStructValidationMessage('Structure file downloaded successfully!', 'success');
          return true;
        } catch (e) {
          console.error("Error creating/downloading .mcstructure file:", e);
          showCmdStructValidationMessage(`Error: ${e.message}. Try reducing the structure size.`, 'error');
          return false;
        }
      }, 100);

      return true;
    } catch (e) {
      console.error("Error creating/downloading .mcstructure file:", e);
      showCmdStructValidationMessage(`Error: ${e.message}. Try reducing the structure size.`, 'error');
      return false;
    }
  }

  // Update the validation message function to support info messages
  function showCmdStructValidationMessage(message, type = 'error') {
    const validationMessage = document.getElementById('cmd-struct-validation-message');
    validationMessage.textContent = message;

    // Update styling based on message type
    if (type === 'success') {
      validationMessage.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
      validationMessage.style.borderLeftColor = '#2ecc71';
      validationMessage.style.color = '#2ecc71';
    } else if (type === 'info') {
      validationMessage.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
      validationMessage.style.borderLeftColor = '#3498db';
      validationMessage.style.color = '#3498db';
    } else {
      validationMessage.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
      validationMessage.style.borderLeftColor = '#ff3b3b';
      validationMessage.style.color = '#ff6b6b';
    }

    validationMessage.style.display = 'block';
    if (type !== 'info') { // Don't auto-hide info messages
      setTimeout(() => {
        validationMessage.style.display = 'none';
      }, 5000);
    }
  }

  // Convert button event listener
  const cmdStructConvertButton = document.getElementById('cmd-struct-convert-button');
  if(cmdStructConvertButton) {
    cmdStructConvertButton.addEventListener('click', () => {
      if (!commandsToStructureContent) {
        showCmdStructValidationMessage('Please select a file with Minecraft commands.');
        return;
      }

      // First process commands
      const processResult = processCommands(commandsToStructureContent);

      if (!processResult.blocksFound) {
        showCmdStructValidationMessage('No valid blocks found in commands. Check your file format.');
        return;
      }

      // Then convert to structure data
      const result = convertToStructureData();

      if (!result.success) {
        showCmdStructValidationMessage(result.message);
        return;
      }

      // Clear previous stats if any
      const existingStats = document.getElementById('cmd-struct-preview-container').querySelector('.alert');
      if (existingStats) {
        existingStats.remove();
      }

      // Show preview
      const previewJson = JSON.stringify(result.data, null, 2);
      document.getElementById('cmd-struct-preview-text').textContent = previewJson;

      // Display success stats in the preview container
      const statsHtml = `
        <div class="alert alert-info mt-3">
          <p class="mb-1"><strong>Structure Dimensions:</strong> ${result.dimensions.width}×${result.dimensions.height}×${result.dimensions.depth}</p>
          <p class="mb-1"><strong>World Origin:</strong> [${result.origin.join(', ')}]</p>
          <p class="mb-1"><strong>Block Count:</strong> ${result.blockCount}</p>
          <p class="mb-0"><strong>Unique Block Types:</strong> ${result.paletteCount}</p>
        </div>
      `;

      document.getElementById('cmd-struct-preview-container').insertAdjacentHTML('beforeend', statsHtml);
      document.getElementById('cmd-struct-output-preview').style.display = 'block';
      document.getElementById('cmd-struct-download-button').disabled = false;
    });
  }

  // Download button event listener
  const cmdStructDownloadButton = document.getElementById('cmd-struct-download-button');
  if(cmdStructDownloadButton) {
    cmdStructDownloadButton.addEventListener('click', () => {
      if (!commandsToStructureData || !commandsToStructureData.size || !commandsToStructureData.structure) {
        showCmdStructValidationMessage('No structure data available. Please convert commands first.');
        return;
      }

      const filename = 'structure.mcstructure';
      const success = downloadMcstructure(commandsToStructureData, filename);

      // The success message is now handled within downloadMcstructure's timeout
      if (!success) {
         // Only show this if the initial call to downloadMcstructure fails (rare)
        showCmdStructValidationMessage('Failed to initiate structure file download. Check console for errors.');
      }
    });
  }

  // Add reset buttons to output preview sections
  document.addEventListener('DOMContentLoaded', function() {
    // Attach all drop area events
    attachDropAreaEvents();
    
    // Add this console log to verify the script is loading
    console.log('NBT Converter script loaded successfully');
  });
});
