# websocket-connector

This library is meant to make it easier to connect and send/recieve WebSocket subscriptions.
An example for using Spring Boot as a backend is provided in the bottom of this document 

## Usage:

### Plain Javascript
This connects to the same localhost, and subscribes to 2 topics: /topic/general/info and /topic/general/error

````
import {closeWebSocket, connectWebSocket, statusWebSocket} from 'websockeet-connector';

// 1) Create a callback to be able to handle each message received
const messageHandler = (message: string, topic: string ) => {
    // Handle received message
}

// 2) Create a connection to the backend WebSocket (/yourApplication) and register topics
connectToWebSocket = () => {
    connectWebSocket('/yourApplication', ['/topic/general/info', '/topic/general/error'], this.messageHandler)
      .then(() => { /* Inform connection is OK */)})
      .catch(()=> { /* Inform connection FAILED*/  })
      
// 3) If you want to send a message to the backend WebSocket; using /app/ping as backend example entrypoint
sendMessage('Message to be sent', '/app/ping');
// or as an object
sendMessage({message: 'someData}, '/app/ping');
      

// 4) To subscripbe to more topics or unsubscribe, use the following:
subscribeTopic(['/topic/general/status'],this.getMessage);
subscribeTopics(['/topic/general/status', '/topic/other/info'],this.getMessage);
unsubscribeTopic('/topic/other/info');

// 5) To disconnect use the closeWebSocket
closeWebSocket();

````

## Example Spring Boot backend

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
        message.put("topic", "/topic/general/status");
        return message;
    }
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
