import * as Stomp from 'stompjs';
const SockJS = require('sockjs-client');
import { Client, Frame } from 'stompjs';

/**
 * WebSocket: send and receive messages using sockjs-client and stompjs
 *
 * Requires: A backend that can handle WebSocket. Spring boot: spring-boot-starter-websocket
 *
 * Usage:
 *    (1) IMPORT
 *
 *      import { sendMessage, subscribeTopics, connectToWebSocket} from 'websocketmodule'
 *
 *    (2) CREATE CONNECTION -> runs callback for each message received from backend on respective topic
 *
 *      const yourCallback = (message: string, topic: string) => { ... show/use message +/- topic ... };
 *      connectToWebSocket('/yourApplication/handler', ['/topic/general/status'], yourCallback)
 *        .then(() =>  { console.log('WEBSOCKET CONNECTED')})
 *        .catch(() => { console.log('WEBSOCKET FAILED TO CONNECT')});
 *
 *    (3) CLOSE CONNECITON
 *
 *      closeWebSocket();
 *
 *    (4) Optional: SEND MESSAGE -> MessageMapping /app/ping as an example here, and should be handled in backend and distribute to correct topic ('/topic/status' ?)
 *
 *       sendMessage('This is a textsamle', '/app/ping');
 *
 *    (5) Optional: SUBSCRIBE to new/more TOPIC(-s) -> runs callback for each message received on topic
 *
 *      const yourCallback = (message: string, topic: string) => { ... show/use message +/- topic ... };
 *      subscribeTopics(["/topic/testing"], () => yourCallback);
 *
 *    (6) Optional: UNSUBSCRIBE to a TOPIC
 *
 *      unsubscribeTopic(["/topic/testing"]);
 */

let socket: any | undefined = undefined;
let stompClient: Client | undefined = undefined;

let subscriptions: Map<string, string> = new Map<string, string>();

let debugFlag: boolean = false;

/**
 * WebSocket: Open connection
 *
 * @param {string} url                Example: '/yourApplication/handler'
 * @param {Array<string} topics       Example: ['/topic/status'] or ['/topic/status', '/topic/error']
 * @param {callback} callbackMessage  Example:  (message: string, topic: string) => {...handle}
 * @param (boolean=} debug            Example: Optional true/false
 *
 * @return {Promise}
 * @
 */
export const connectWebSocket = (url: string, topics: Array<string>, callbackMessage: any, debug: boolean = false) => {
  debugFlag = debug;

  return new Promise((resolve, reject) => {
    try {
      statusWebSocket();
      socket = new SockJS(url);
      stompClient = Stomp.over(socket);

      if (!debugFlag) {
        stompClient.debug = () => {};
      }
      stompClient.connect(
        {},
        () => {
          topics.forEach(topic => {
            subscribeTopic(topic, callbackMessage);
          });
          log(`WebSocket: Connected to ${url}`, true);
          resolve(true);
        }
      );
    } catch (e) {
      log(`WebSocket: Can\'t connect ${e}`, false);
      reject(false);
    }
  });
};

/**
 * WebSocket: Check if connected
 *
 * @return {boolean}
 */
export const statusWebSocket = (): boolean => {
  if (stompClient) {
    if (socket.readyState == 3 && !stompClient.connected) {
      log('WebSocket: Connection closed', false);
      return false;
    } else if (socket.readyState == 1 && stompClient.connected) {
      log('WebSocket: Connected', true);
      return true;
    }
  }
  log('WebSocket: Not connected', false);
  return false;
};

/**
 * WebSocket: Subscribe to more topics
 *
 * @param {Array<string} topics       Example: ['/topic/status'] or ['/topic/status', '/topic/error']
 * @param {callback} callbackMessage  Example:  (message: string, topic: string) => {...handle}
 */
export const subscribeTopics = (topics: Array<string>, callbackMessage: any) => {
  topics.forEach(topic => {
    subscribeTopic(topic, callbackMessage);
  });
};

/**
 * WebSocket: Subscribe to a single topic
 *
 * @param string topic                Example: ['/topic/status'] or ['/topic/status', '/topic/error']
 * @param {callback} callbackMessage  Example:  (message: string, topic: string) => {...handle}
 */
export const subscribeTopic = (topic: string, callbackMessage: any) => {
  if (stompClient) {
    let subscriptionID: string = stompClient.subscribe(topic, (frame: Frame) => {
      const body = JSON.parse(frame.body);
      const message = body.message;
      const topic = body.topic;

      callbackMessage(message, topic);
    }).id;
    subscriptions.set(topic, subscriptionID);
    log(`WebSocket: Subscribed to topic ${topic}`, true);
  }
};

/**
 * WebSocket: Unsubscribe a single topic
 *
 * @param {string} topic            Example: '/topic/status'
 * @return {boolean}                Returns true/false if topic is deleted
 */
export const unsubscribeTopic = (topic: string): boolean => {
  if (stompClient) {
    if (subscriptions.get(topic)) {
      const subscriptionID = subscriptions.get(topic);
      if (subscriptionID) {
        stompClient.unsubscribe(subscriptionID);
        log(`WebSocket: Unsubscribed topic with id ${subscriptionID}`, true);
        return true;
      }
    }
  }
  log('WebSocket: Message not sent!. Not able to connect', false);
  return false;
};

/**
 * WebSocket: Send Message to a single topic
 *
 * @param {string} message            Example: 'this is a textmessage'
 * @param {string} topic              Example:  '/topic/status'
 *
 * @return {boolean}                  Returns true/false if message is sent
 */
export const sendMessage = (message: string, topic: string): boolean => {
  return sendMessageObject({ message: message }, topic);
};

/**
 * WebSocket: Send Message Object to a single topic
 *
 * @param {Object} message            Example: Use a format for the backend -> { one: 'sometext, two: 'some other text}
 * @param {string} topic              Example:  '/topic/status'
 *
 * @return {boolean}                  Returns true/false if message is sent
 */
export const sendMessageObject = (message: Object, topic: string) => {
  if (stompClient) {
    stompClient.send(topic, {}, JSON.stringify(message));
    log(`WebSocket: Message ${message}, sent to topic ${topic}`, true);
    return true;
  }
  log('WebSocket: Message not sent!. Can not reach/Not connected', false);
  return false;
}

/**
 * WebSocket: Close connection
 *
 * @return {boolean}                    Returns true/false if connection is closed
 */
export const closeWebSocket = (): boolean => {
  if (stompClient) {
    stompClient.disconnect(() => {
      log('WebSocket: Disconnected', true);
      return true;
    });
    log('WebSocket: Not able to disconnect', false);
    return false;
  } else {
    log('WebSocket: Not able to disconnect', false);
    return false;
  }
};

/**
 * Internal handling of logging, if debugFlag is set to true
 * */
const log = (logMessage: string, info: boolean) => {
  if (debugFlag) {
    if (info) {
      console.log(logMessage);
    } else {
      console.error(logMessage);
    }
  }
};
