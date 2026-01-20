/*
 * Buffer for chatMessages for the server
 * it just buffers the most recent 200 messages for each channel
 *
 */
import { storeMessage, getMessagesForChannel } from '../data/sql/Message.js';
// import { getMessagesByChannel } from '../db/utils/messages.ts';

const MAX_BUFFER_TIME = 600_000;

class ChatMessageBuffer {
  constructor(socketEvents) {
    this.buffer = new Map();
    this.timestamps = new Map();

    this.cleanBuffer = this.cleanBuffer.bind(this);
    this.cleanLoop = setInterval(this.cleanBuffer, 3 * 60 * 1000);
    this.addMessage = this.addMessage.bind(this);
    this.socketEvents = socketEvents;
    socketEvents.on('chatMessage', this.addMessage);
  }

  async hasMessageFromUser({
    userId,
    checkOnlyCached,
  }) {
    if(checkOnlyCached) {
      for(const [_, messages] of this.buffer) {
        for(const msg of messages) {
          if(userId === msg[3]) {
            return true;
          }
        }
      }
      return false;
    } else {
      throw new Error('not implemented');
    }
  }

  async getMessages(cid, limit = 30) {
    if (limit > 200) {
      return getMessagesForChannel(cid, limit);
    }

    let messages = this.buffer.get(cid);
    if (!messages) {
      messages = await getMessagesForChannel(cid, limit);
      this.buffer.set(cid, messages);
    }
    this.timestamps.set(cid, Date.now());
    return messages.slice(-limit);
  }

  cleanBuffer() {
    const curTime = Date.now();
    const toDelete = [];
    this.timestamps.forEach((timestamp, cid) => {
      if (curTime > timestamp + MAX_BUFFER_TIME) {
        toDelete.push(cid);
      }
    });
    toDelete.forEach((cid) => {
      this.timestamps.delete(cid);
      this.buffer.delete(cid);
    });
  }

  async broadcastChatMessage(
    name,
    message,
    cid,
    uid,
    flag = 'xx',
    sendapi = true,
  ) {
    if (message.length > 200) {
      return;
    }
    storeMessage(flag, message, cid, uid);
    /*
     * goes through socket events and then comes
     * back at addMessage
     */
    this.socketEvents.broadcastChatMessage(
      name,
      message,
      cid,
      uid,
      flag,
      sendapi,
    );
  }

  async addMessage(
    name,
    message,
    cid,
    uid,
    flag,
  ) {
    const messages = this.buffer.get(cid);
    if (messages) {
      messages.push([
        name,
        message,
        flag,
        uid,
        Math.round(Date.now() / 1000),
      ]);
    }
  }
}

export default ChatMessageBuffer;
