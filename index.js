const fs = require("fs");
const Discord = require("discord.js");
const bot = new Discord.Client();
const Guild = require("./model/Guild");
const dotenv = require("dotenv");
const configs = require("./config");
const defaultMessages = configs.defaultMessages;
const defaultCommands = configs.defaultCommands;
const getAudiosTree = require("./utils/audioUtils").getAudiosTree;
const hasCommand = require("./utils/commandUtils").hasCommand;
dotenv.load();

var servers = [];

const audiosList = getAudiosTree("audios");

/**
 * Search a audio in the list of audios
 * @param {String} command - get the audio infos by the command
 * @returns {Object}
 */
function getAudioByCommand(command, audiosTree) {
  return recursiveGetAudioByCommand(command, audiosTree);
}

function getAudio(command, fileList) {
  if (fileList.length !== 0) {
    let index = fileList.findIndex(value => value.command === command);

    if (index !== -1) {
      return fileList[index];
    } else {
      return null;
    }
  }

  return null;
}

function recursiveGetAudioByCommand(command, audiosTree) {
  let audio = null;

  if (audiosTree.files) {
    audio = getAudio(command, audiosTree.files);
  }

  if (!audio && audiosTree.dirs) {
    Object.keys(audiosTree.dirs).forEach(dir => {
      let audioInDir = recursiveGetAudioByCommand(
        command,
        audiosTree.dirs[dir]
      );
      if (audioInDir && !audio) {
        audio = audioInDir;
      }
    });
  }

  return audio;
}

/**
 * Send the audio to the voice channel
 * @param {Object} message - object with the menssage informations
 * @param {object} audio - audio object
 * @param {Object} server - server context
 */
function sendAudio(message, audio, server) {
  // connect to de server
  if (server.getConnection() === null) {
    // enter in the voice channel
    message.member.voiceChannel.join().then(connection => {
      var dispatcher;

      // send the audio

      if (audio.type === "ogg") {
        dispatcher = connection.playStream(fs.createReadStream(audio.file), {
          type: audio.type
        });
      } else {
        dispatcher = connection.playStream(audio.file);
      }

      // end the connection
      dispatcher.on("end", () => {
        connection.disconnect();
        message.member.voiceChannel.leave();
      });
    });
  } else {
    // if is connected
    if (audio.type === "ogg") {
      server.getConnection().playStream(fs.createReadStream(audio.file), {
        type: audio.type
      });
    } else {
      server.getConnection().playStream(audio.file);
    }
  }
}

/**
 * Search for a server in the array
 * @param {String} serverID - server's id
 * @returns {Obejct}
 */
function getServer(serverID) {
  let index = servers.findIndex(server => server.getId() == serverID);

  if (index === -1) {
    return null;
  }

  return servers[index];
}

/**
 * Add a server in the array
 * @param {String} serverId - server's id
 */
function setServer(serverId) {
  servers.push(new Guild(serverId));
}

function updateServerPermissions(serverID, newPermissions) {
  servers.forEach(server => {
    if (server.getId() === serverID) {
      newPermissions.forEach(permission => server.addPermission(permission));
    }
  });
}

function addRolePermission(content, serverID) {
  let permissionCommand = content.trim().split(" ");
  let roles = permissionCommand.slice(1);

  updateServerPermissions(serverID, roles);

  return roles.join(", ");
}

function removeRolePermission(content, serverID) {
  let permissionCommand = content.trim().split(" ");
  let roles = permissionCommand.slice(1);

  updateServerPermissions(serverID, roles);

  return roles.join(", ");
}

function hasPermission(member, permissions) {
  return member.roles.some(role => permissions.includes(role.name));
}

/**
 * Make the bot stay in a voice channel
 * @param {Object} message - message object
 * @param {Object} server - server object
 */
function stayInVoiceChannel(message, server) {
  // check if the user is a voice channel
  if (!message.member.voiceChannel) {
    message.channel.send(defaultMessages.goToVoiceChannelMessage);
  } else {
    // get the connect
    if (!message.guild.voiceConnection) {
      server.setVChannelId(message.member.voiceChannel.id);

      // make the connection with the voice channel
      message.member.voiceChannel.join().then(connection => {
        server.setConnection(connection);
      });
    } else {
      // if is buisy in other voice channel
      message.channel.send(defaultMessages.busyMessage);
    }
  }
}

/**
 * Make the bot leave a voice channel
 * @param {Object} message - message object
 * @param {Object} server - server object
 */
function leaveVoiceChannel(message, server) {
  // check if the user is in a voice channel
  if (!message.member.voiceChannel) {
    message.channel.send(defaultMessages.goToVoiceChannelMessage);
  } else {
    // if the voice channel is the same of the user
    if (
      message.guild.voiceConnection &&
      message.member.voiceChannel.id === server.getVChannelId()
    ) {
      // leave the connection
      server.setVChannelId(null);
      server.getConnection().disconnect();
      server.setConnection(null);
    } else {
      message.channel.send(defaultMessages.busyMessage);
    }
  }
}

function getAudiosCommands(list) {
  let result = [];
  result["audios"] = [];

  if (list.files) {
    list.files.forEach(file => {
      result.audios.push(file.command);
    });
  }

  if (list.dirs) {
    Object.keys(list.dirs).forEach(dir => {
      result[dir] = recursiveGetAudiosCommands(list.dirs[dir]);
      result[dir] = result[dir].sort();
    });
  }

  return result;
}

function recursiveGetAudiosCommands(list) {
  let filesCommands = [];
  let dirsCommands = [];

  if (list.files) {
    list.files.forEach(file => {
      filesCommands.push(file.command);
    });
  }

  if (list.dirs) {
    Object.keys(list.dirs).forEach(dir => {
      dirsCommands = dirsCommands.concat(
        recursiveGetAudiosCommands(list.dirs[dir])
      );
    });
  }

  return filesCommands.concat(dirsCommands);
}

function getHelpMessage() {
  let defaultCommandsList = [];
  let commands = getAudiosCommands(audiosList);
  let commandsTxt = "";

  Object.keys(defaultCommands).forEach(command => {
    defaultCommandsList.push(
      `${defaultCommands[command].command} - ${
        defaultCommands[command].description
      }`
    );
  });

  Object.keys(commands).forEach(commandType => {
    let name = commandType[0].toUpperCase() + commandType.slice(1);
    let commandsList = commands[commandType];

    if (commandsList.length !== 0) {
      commandsTxt += `\n**${name}**\n \`\`\``;
      commandsList.forEach(commandName => {
        commandsTxt += `${commandName}\n`;
      });

      commandsTxt += "```";
    }
  });

  return (
    `\n**Default:**\n\n\`\`\`${defaultCommandsList.join("\n")} \`\`\`` +
    commandsTxt
  );
}

function handleCommand(message, server) {
  const { content, member, channel, guild, author } = message;
  const { connection, vChannelId, id, permissions } = server;
  const serverID = id;
  const {
    busyMessage,
    goToVoiceChannelMessage,
    permissionAddMessage,
    permissionRemoveMessage,
    listPermissionsMessage,
    nonePermissionMessage
  } = defaultMessages;
  const {
    stay,
    leave,
    help,
    addPermission,
    removePermission,
    listPermissions
  } = defaultCommands;

  // check if is a correct command
  if (hasCommand(content, audiosList)) {
    // check if the user is in a voice channel
    if (!member.voiceChannel) {
      channel.send(goToVoiceChannelMessage);
    } else {
      // try to connect in the voice channel
      if (connection) {
        // check if the voice channel is the same of the bot
        if (member.voiceChannel.id === vChannelId) {
          // get the audio object
          const audio = getAudioByCommand(content, audiosList);
          sendAudio(message, audio, server);
        } else {
          // if the bot is in other voice channel
          channel.send(busyMessage);
        }
      } else if (!guild.voiceConnection) {
        const audio = getAudioByCommand(content, audiosList);
        sendAudio(message, audio, server);
      } else {
        channel.send(busyMessage);
      }
    }
  } else if (content === stay.command) {
    // if the command is to stay in a voice channel
    stayInVoiceChannel(message, server);
  } else if (content === leave.command) {
    // command to leave a voice channel
    leaveVoiceChannel(message, server);
  } else if (content === help.command) {
    // send the list of commands
    author.send(getHelpMessage());
  } else if (content.indexOf(addPermission.command) === 0) {
    channel.send(permissionAddMessage + addRolePermission(message, serverID));
  } else if (content.indexOf(removePermission.command) === 0) {
    channel.send(
      permissionRemoveMessage + removeRolePermission(message, serverID)
    );
  } else if (content === listPermissions.command) {
    if (permissions.length === 0) {
      channel.send(nonePermissionMessage);
    } else {
      channel.send(listPermissionsMessage + permissions.join(", "));
    }
  }
}

bot.on("message", message => {
  const { content, guild, member, channel } = message;
  const { permissionDeniedMessage } = defaultMessages;
  let server = null;
  let permissions = [];

  if (guild) {
    // check if the server is not in the list
    if (getServer(guild.id) === null) {
      // add a new server
      setServer(guild.id);
    }
    // get the server object
    server = getServer(guild.id);
    permissions = server.getPermissions();

    // check if has any permission
    if (permissions.length === 0) {
      handleCommand(message, server);
    } else if (hasCommand(content, audiosList)) {
      // check if the memeber has permission
      if (hasPermission(member, permissions)) {
        handleCommand(message, server);
      } else if (member.user.id !== process.env.CLIENT_ID) {
        // send the if not the bot message
        channel.send(permissionDeniedMessage);
      }
    }
  }
});

bot.login(process.env.TOKEN);
