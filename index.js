const fs = require("fs");
const Discord = require("discord.js");
const bot = new Discord.Client();
const Guild = require("./guild");
const dotenv = require("dotenv");
const messages = require("./messages");
const defaultCommands = require("./defaultCommands");
const getAudios = require("./getAudios");
dotenv.load();

var servers = [];

const audioList = getAudios("audios");

/**
 * Check if a message is in the list of commands
 * @param {String} command - command in the message
 * @returns {Bool}
 */
function inList(command, list) {
  if (list.length != 0) {
    return list.findIndex(value => value.command === command) !== -1;
  }

  return false;
}

function recursiveInAudioList(command, list) {
  let hasFileWithCommand = false;
  let hasDirWithCommand = false;

  if (list.files) {
    hasFileWithCommand = inList(command, list.files);
  }

  if (list.dirs) {
    Object.keys(list.dirs).forEach(dir => {
      if (recursiveInAudioList(command, list.dirs[dir])) {
        hasDirWithCommand = true;
      }
    });
  }

  return hasFileWithCommand || hasDirWithCommand;
}

function hasCommand(command) {
  return recursiveInAudioList(command, audioList);
}

/**
 * Search a audio in the list of audios
 * @param {String} command - get the audio infos by the command
 * @returns {Object}
 */
function getAudioByCommand(command) {
  return recursiveGetAudioByCommand(command, audioList);
}

function getAudio(command, list) {
  if (list.length !== 0) {
    let index = list.findIndex(value => value.command === command);

    if (index !== -1) {
      return list[index];
    } else {
      return null;
    }
  }

  return null;
}

function recursiveGetAudioByCommand(command, list) {
  let audio = null;

  if (list.files) {
    audio = getAudio(command, list.files);
  }

  if (!audio && list.dirs) {
    Object.keys(list.dirs).forEach(dir => {
      let audioInDir = recursiveGetAudioByCommand(command, list.dirs[dir]);
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
 * @param {String} serverId - server's id
 * @returns {Obejct}
 */
function getServer(serverId) {
  let server = null;

  servers.forEach(serverObj => {
    if (serverObj.server.getId() === serverId) {
      server = serverObj;
    }
  });

  return server;
}

/**
 * Add a server in the array
 * @param {String} serverId - server's id
 */
function setServer(serverId) {
  servers.push({ server: new Guild(serverId), permissions: [] });
}

function updateServerPermissions(serverId, permissions) {
  servers.forEach(server => {
    if (server.server.getId() === serverId) {
      server.permissions = permissions;
    }
  });
}

function addPermission(message, permissions) {
  let permissionCommand = message.content.trim().split(" ");
  let roles = permissionCommand.slice(1);

  updateServerPermissions(message.guild.id, permissions.concat(roles));

  return roles.join(", ");
}

function removePermission(message, permissions) {
  let permissionCommand = message.content.trim().split(" ");
  let roles = permissionCommand.slice(1);
  let filtred = permissions.filter(role => !roles.includes(role));

  updateServerPermissions(message.guild.id, filtred);

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
    message.channel.send(messages.goToVoiceChannelMessage);
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
      message.channel.send(messages.busyMessage);
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
    message.channel.send(messages.goToVoiceChannelMessage);
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
      message.channel.send(messages.busyMessage);
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
  let commands = getAudiosCommands(audioList);
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

function handleCommand(message, server, permissions) {
  const { content, member, channel, guild, author } = message;

  // check if is a correct command
  if (hasCommand(content)) {
    // check if the user is in a voice channel
    if (!member.voiceChannel) {
      channel.send(messages.goToVoiceChannelMessage);
    } else {
      // try to connect in the voice channel
      if (server.getConnection()) {
        // check if the voice channel is the same of the bot
        if (member.voiceChannel.id === server.getVChannelId()) {
          // get the audio object
          const audio = getAudioByCommand(content);
          sendAudio(message, audio, server);
        } else {
          // if the bot is in other voice channel
          channel.send(messages.busyMessage);
        }
      } else if (!guild.voiceConnection) {
        const audio = getAudioByCommand(content);
        sendAudio(message, audio, server);
      } else {
        channel.send(messages.busyMessage);
      }
    }
  } else if (content === defaultCommands.stay.command) {
    // if the command is to stay in a voice channel
    stayInVoiceChannel(message, server);
  } else if (content === defaultCommands.leave.command) {
    // command to leave a voice channel
    leaveVoiceChannel(message, server);
  } else if (content === defaultCommands.help.command) {
    // send the list of commands
    author.send(getHelpMessage());
  } else if (content.indexOf(defaultCommands.permission.command) === 0) {
    channel.send(messages.permissionAdd + addPermission(message, permissions));
  } else if (content.indexOf(defaultCommands.removePermission.command) === 0) {
    channel.send(
      messages.permissionRemove + removePermission(message, permissions)
    );
  } else if (content === defaultCommands.listPermission) {
    channel.send(messages.listPermissions + permissions.join(", "));
  }
}

bot.on("message", message => {
  const { content, guild, member, channel } = message;
  const { permissionDenied } = messages;
  let server = null;
  let permissions = [];

  if (guild) {
    // check if the server is not in the list
    if (getServer(guild.id) === null) {
      // add a new server
      setServer(guild.id);
    }
    // get the server object
    let obj = getServer(guild.id);

    server = obj.server;
    permissions = obj.permissions;
  }

  // check if has any permission
  if (permissions.length === 0) {
    handleCommand(message, server, permissions);
  } else if (hasCommand(content)) {
    // check if the memeber has permission
    if (hasPermission(member, permissions)) {
      handleCommand(message, server, permissions);
    } else if (member.user.id !== process.env.CLIENT_ID) {
      // send the if not the bot message
      channel.send(permissionDenied);
    }
  }
});

bot.login(process.env.TOKEN);
