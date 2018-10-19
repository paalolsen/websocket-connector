# websocket-connector

This library is meant to make it easier to connect and send/recieve WebSocket subscriptions.
An example for using Spring Boot as a backend is provided in the bottom of this document 

## Usage:

### Plain Javascript
This connects to the same localhost, and subscribes to 2 topics: /topic/general/info and /topic/general/error

````
import {webSocketClose, webSocketConnect, webSocketStatus} from 'websockeet-connector';

// 1) Create a callback to be able to handle each message received
const messageHandler = (message: string, topic: string ) => {
    // Handle received message
}

// 2) Create a connection to the backend WebSocket (/yourApplication) and register topics
webSocketConnect = () => {
    webSocketConnect('/yourApplication', ['/topic/general/info', '/topic/general/error'], this.messageHandler)
      .then(() => { /* Inform connection is OK */)})
      .catch(()=> { /* Inform connection FAILED*/  })
      
// 3) If you want to send a message to the backend WebSocket; using /app/ping as backend example entrypoint
webSocketSendMessage('Message to be sent', '/app/ping');
// or as an object
webSocketSendObject({message: 'someData}, '/app/ping');
      

// 4) To subscripbe to more topics or unsubscribe, use the following:
webSocketSubscribeTopic(['/topic/general/status'],this.getMessage);
webSocketSubscribeTopics(['/topic/general/status', '/topic/other/info'],this.getMessage);
webSocketUnsubscribeTopic('/topic/other/info');

// 5) To disconnect use the webSocketClose
webSocketClose();

````

### React Wrapper Example
This can be seated at Root.jsx as a common service, and then use the regular javascript functions to subscribe, unsubscribe, send messages +++ where needed

````
import * as React from 'react';
import {webSocketClose, webSocketConnect, webSocketStatus} from 'websockets'

// Consider adding a Prop funtion to pass inn, and handle message outside component
interface Props {
  reconnect: boolean;
  // getMessage: (message: string, topic: string) => void; 
}

class WebSocket extends React.Component<Props> {
  constructor(props:Props) {
    super();
  }

  componentDidMount() {

    this.createWebSocketConnection()

    setTimeout(() => {
      this.checkIsConnected();
    }, 5000)

  }
  componentWillUnmount() {
    webSocketClose();
  }

  checkIsConnected = () => {
    const {reconnect} = this.props;
    if(reconnect) {
      setInterval(() => {
       if(!webSocketStatus()) {
         this.createWebSocketConnection();
       }
      }, 5000);
    }
  }

  getMessage = (message: string, topic: string) => {
    // Hanlde message here, or expand Props to take a similiar function and handle outside component
  }

  createWebSocketConnection = () => {
    console.log('Lytter på topics: /topic/general/info, /topic/general/error');
    webSocketConnect('/gpf-handelslager/handler', ['/topic/general/info', '/topic/general/error'], this.getMessage)
      .then(() => { /* Inform Connection OK */ })
      .catch(()=> { /* Inform Connection Failed*/ })
  }

  render() {
    return ( <div />)
  }

}

export default WebSocket;

````

## Example Spring Boot backend

First add dependency to maven:
````
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-websocket</artifactId>
            <version>RELEASE</version>
            <scope>compile</scope>
        </dependency>
````

### Create a config for broker
````
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.AbstractWebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig extends AbstractWebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/handler");
        registry.addEndpoint("/handler").withSockJS();
        // .setAllowedOrigins("*");
    }
}
````

### Create a controller for receiving messages from frontend:
````
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.web.bind.annotation.Controller;

import java.util.Map;

@Controller
public class WebSocketController {

    @MessageMapping("/ping")
    @SendTo("/topic/general/info")
    public Map<String, String> ping(@Payload Map<String, String> message) {
        message.put("timestamp", Long.toString(System.currentTimeMillis()));
        message.put("topic", "/topic/general/info");
        return message;
    }
    
    /* Or:
   
       @MessageMapping(WebSocketTopics.PING)
        @SendTo(WebSocketTopics.TOPIC_GENERAL_INFO)
        public WebSocketMessage ping(@Payload WebSocketMessage message) {
            message.setTopic(WebSocketTopics.TOPIC_GENERAL_INFO);
            message.setMessage(message.getMessage() + " <- Received in backend");
            return message;
        }
    */
}

````

### If yuo prefer sending a data object back, rather than plain text, create a Message Object
````
import java.util.ArrayList;

public class WebSocketMessage<T> {

    private String topic;
    private String message;
    private ArrayList<T> data = new ArrayList<>();

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public T getData() { return (T) data; }
    public void addToDataList(T data) { this.data.add(data); }
    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }
}
````

### Create a service for pushing topics to subscribers
````
import yourapp.domain.WebSocketMessage;
import yourapp.domain.WebSocketTopics;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class WebSocketClient {

    @Autowired
    private SimpMessagingTemplate template;

    public void messageTopic(String topic, String message, Object... data) {
        WebSocketMessage wsm = new WebSocketMessage();
        wsm.setTopic(topic);
        postMessage(wsm, message, data);
    }

    protected void postMessage(WebSocketMessage wsm, String message, Object... data) {
        wsm.setMessage(message);
        for (Object d : data) {
            wsm.addToDataList(d);
        }
        postMessage(wsm);
    }

    public void postMessage(WebSocketMessage message) {
        if (message.getTopic() == null) {
            this.template.convertAndSend(WebSocketTopics.TOPIC_GENERAL_INFO, message);
        } else {
            this.template.convertAndSend(message.getTopic(), message);
        }
    }
}

````

### Push messages to subscribers
````
// A) by plain text:
 webSocketClient.messageTopic('/topic/general/error', "ERROR -> Something went wrong");
 
// B) return data 
 webSocketClient.messageTopic('/topic/general/info', new SomeObject("value", "value", "value"));
 
````
