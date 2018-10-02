class Guild {
  constructor(id) {
    this.id = id;
    this.connection = null;
    this.vChannelId = null;
  }

  setId(id) {
    this.id = id;
  }

  setVChannelId(vChannelId) {
    this.vChannelId = vChannelId;
  }

  setConnection(connection) {
    this.connection = connection;
  }

  getId() {
    return this.id;
  }

  getVChannelId() {
    return this.vChannelId;
  }

  getConnection() {
    return this.connection;
  }
}

module.exports = Guild;
