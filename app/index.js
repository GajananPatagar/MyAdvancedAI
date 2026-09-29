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
  Modal,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function AIChatApp() {
  // Configuration State
  const [apiKey, setApiKey] = useState('xpl_06e58639becf90ade37da17d2014fcaf0c1236c6');
  const [baseUrl, setBaseUrl] = useState('https://api.experientiallabs.ai/v1/chat/completions');
  const [modelName, setModelName] = useState('qwen3.8-27b');
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Chat State
  const [messages, setMessages] = useState([
    {
      id: 'init-1',
      role: 'assistant',
      text: 'Connected. Ask me anything or long-press any response to quote-reply directly to it.',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const flatListRef = useRef(null);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const formattedText = replyingTo
      ? `[Replying to: "${replyingTo.text}"]\n${inputText}`
      : inputText;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: formattedText,
    };

    const newHistory = [userMessage, ...messages];
    setMessages(newHistory);
    setInputText('');
    setReplyingTo(null);
    setIsLoading(true);

    // Format full history for contextual follow-ups
    const apiPayload = [...newHistory].reverse().map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.text,
    }));

    try {
      const response = await fetch(baseUrl.trim(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName.trim(),
          messages: apiPayload,
        }),
      });

      const data = await response.json();

      if (data.choices && data.choices.length > 0) {
        const aiMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: data.choices[0].message.content,
        };
        setMessages((prev) => [aiMessage, ...prev]);
      } else if (data.error) {
        throw new Error(data.error.message || 'API returned an error');
      }
    } catch (err) {
      setMessages((prev) => [
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: `⚠️ Error: ${err.message || 'Check your Base URL or API key in settings.'}`,
        },
        ...prev,
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <TouchableOpacity
        onLongPress={() => setReplyingTo(item)}
        activeOpacity={0.85}
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.aiBubble,
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
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Advanced AI Chat</Text>
            <Text style={styles.headerSubtitle}>{modelName}</Text>
          </View>
          <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.headerButton}>
            <Ionicons name="settings-sharp" size={22} color="#a1a1aa" />
          </TouchableOpacity>
        </View>

        {/* Message Feed */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.chatContainer}
        />

        {/* Active Reply Context Banner */}
        {replyingTo && (
          <View style={styles.replyBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.replyBannerHeader}>
                Replying to {replyingTo.role === 'user' ? 'yourself' : 'AI'}:
              </Text>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {replyingTo.text}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Ionicons name="close-circle" size={20} color="#71717a" />
            </TouchableOpacity>
          </View>
        )}

        {/* Text Input Row */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.disabledSend]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Ionicons name="arrow-up" size={22} color="#ffffff" />
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>

        {/* Custom API / Model Settings Modal */}
        <Modal visible={settingsVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Custom AI Configuration</Text>

              <Text style={styles.inputLabel}>Model Name</Text>
              <TextInput
                style={styles.modalInput}
                value={modelName}
                onChangeText={setModelName}
                placeholder="e.g. qwen3.8-27b"
                placeholderTextColor="#71717a"
              />

              <Text style={styles.inputLabel}>Base URL</Text>
              <TextInput
                style={styles.modalInput}
                value={baseUrl}
                onChangeText={setBaseUrl}
                placeholder="https://api.../chat/completions"
                placeholderTextColor="#71717a"
              />

              <Text style={styles.inputLabel}>API Key</Text>
              <TextInput
                style={styles.modalInput}
                value={apiKey}
                onChangeText={setApiKey}
                secureTextEntry
                placeholder="Bearer key..."
                placeholderTextColor="#71717a"
              />

              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => setSettingsVisible(false)}
              >
                <Text style={styles.saveButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  headerTitle: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#71717a',
    fontSize: 12,
  },
  headerButton: {
    padding: 6,
  },
  chatContainer: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 18,
    marginVertical: 4,
  },
  userBubble: {
    backgroundColor: '#2563eb',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  aiBubble: {
    backgroundColor: '#18181b',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#ffffff',
  },
  aiText: {
    color: '#e4e4e7',
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  replyBannerHeader: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  replyBannerText: {
    color: '#a1a1aa',
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    backgroundColor: '#09090b',
  },
  input: {
    flex: 1,
    backgroundColor: '#18181b',
    color: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  sendButton: {
    backgroundColor: '#2563eb',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  disabledSend: {
    backgroundColor: '#27272a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputLabel: {
    color: '#a1a1aa',
    fontSize: 12,
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: '#09090b',
    color: '#ffffff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
