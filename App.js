import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Configuration based on Experiential Labs Base URL Swap
const API_KEY = 'xpl_06e58639becf90ade37da17d2014fcaf0c1236c6'; 
const BASE_URL = 'https://api.experientiallabs.ai/v1/chat/completions';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const flatListRef = useRef(null);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    // Format text if it is a specific reply to a previous message
    const formattedText = replyingTo 
      ? `[Replying to: "${replyingTo.text}"]\n${inputText}` 
      : inputText;

    const newUserMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: formattedText,
      originalInput: inputText,
    };

    const updatedMessages = [newUserMessage, ...messages];
    setMessages(updatedMessages);
    setInputText('');
    setReplyingTo(null);
    setIsLoading(true);

    // Format history for the API (OpenAI wire protocol)
    const apiMessages = updatedMessages.reverse().map((msg) => ({
      role: msg.role,
      content: msg.text,
    }));

    try {
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen3.8-27b', // Specified in the API documentation
          messages: apiMessages,
        }),
      });

      const data = await response.json();
      
      if (data.choices && data.choices.length > 0) {
        const aiMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: data.choices[0].message.content,
        };
        setMessages((prevMessages) => [aiMessage, ...prevMessages]);
      }
    } catch (error) {
      console.error('API Error:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: "Connection error. Please check your network or API key status.",
      };
      setMessages((prevMessages) => [errorMessage, ...prevMessages]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <TouchableOpacity 
        onLongPress={() => !isUser && setReplyingTo(item)}
        activeOpacity={0.8}
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.aiBubble
        ]}
      >
        <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
          {item.text}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Advanced AI</Text>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted={true}
          contentContainerStyle={styles.chatContainer}
          showsVerticalScrollIndicator={false}
        />

        {replyingTo && (
          <View style={styles.replyContextBar}>
            <Text style={styles.replyContextText} numberOfLines={1}>
              Replying to: {replyingTo.text}
            </Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Ionicons name="close-circle" size={20} color="#a1a1aa" />
            </TouchableOpacity>
          </View>
        )}

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inputContainer}
        >
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            placeholderTextColor="#71717a"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity 
            style={styles.sendButton} 
            onPress={sendMessage}
            disabled={isLoading || !inputText.trim()}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Ionicons name="send" size={20} color="#ffffff" />
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chatContainer: {
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: '#2563eb',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#27272a',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  userText: {
    color: '#ffffff',
  },
  aiText: {
    color: '#e4e4e7',
  },
  replyContextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181b',
    padding: 12,
    marginHorizontal: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    borderBottomWidth: 0,
  },
  replyContextText: {
    color: '#a1a1aa',
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: 24,
    backgroundColor: '#09090b',
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#18181b',
    color: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    maxHeight: 100,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  sendButton: {
    backgroundColor: '#2563eb',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginBottom: 2,
  },
});
