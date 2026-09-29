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
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export default function AIChatApp() {
  // Configuration State
  const [apiKey, setApiKey] = useState('xpl_06e58639becf90ade37da17d2014fcaf0c1236c6');
  const [baseUrl, setBaseUrl] = useState('https://api.experientiallabs.ai/v1/chat/completions');
  const [modelName, setModelName] = useState('qwen3.8-27b');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  // Chat State
  const [messages, setMessages] = useState([
    {
      id: 'init-1',
      role: 'assistant',
      text: 'Connected. Attach a file, or tap the settings gear to fetch your allowed models.',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const flatListRef = useRef(null);

  // --- API LOGIC ---
  const fetchModels = async () => {
    setIsFetchingModels(true);
    try {
      // Convert /chat/completions to /models for the GET request
      const modelsUrl = baseUrl.trim().replace('/chat/completions', '/models');
      const response = await fetch(modelsUrl, {
        headers: { 'Authorization': `Bearer ${apiKey.trim()}` },
      });
      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        setAvailableModels(data.data.map(m => m.id));
      } else {
        Alert.alert('Error', 'Could not parse models from API.');
      }
    } catch (err) {
      Alert.alert('Network Error', 'Failed to fetch models. Check URL and Key.');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() && !attachedFile) return;

    let finalPrompt = inputText;
    if (replyingTo) {
      finalPrompt = `[Replying to: "${replyingTo.text}"]\n${finalPrompt}`;
    }
    if (attachedFile) {
      finalPrompt += `\n\n--- Attached File: ${attachedFile.name} ---\n${attachedFile.content}`;
    }

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: finalPrompt,
    };

    const newHistory = [userMessage, ...messages];
    setMessages(newHistory);
    setInputText('');
    setReplyingTo(null);
    setAttachedFile(null);
    setIsLoading(true);

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
        setMessages((prev) => [{
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: data.choices[0].message.content,
        }, ...prev]);
      } else if (data.error) {
        throw new Error(data.error.message || 'API returned an error');
      }
    } catch (err) {
      setMessages((prev) => [{
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: `⚠️ Error: ${err.message}`,
      }, ...prev]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- ACTIONS ---
  const handleCopy = async (text) => {
    await Clipboard.setStringAsync(text);
  };

  const handleShare = async (text) => {
    try {
      await Share.share({ message: text });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/*', 'application/json', 'text/javascript', 'text/markdown', 'text/csv'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        try {
          const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
          setAttachedFile({ name: file.name, content });
        } catch (err) {
          Alert.alert('File Error', 'Could not read file. Please ensure it is a valid text/code document.');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageWrapper, isUser ? styles.userWrapper : styles.aiWrapper]}>
        <TouchableOpacity
          onLongPress={() => setReplyingTo(item)}
          activeOpacity={0.85}
          style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}
        >
          <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
            {item.text}
          </Text>
        </TouchableOpacity>
        
        {/* Message Action Bar (Copy / Share) */}
        <View style={[styles.actionBar, isUser ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleCopy(item.text)}>
            <Ionicons name="copy-outline" size={16} color="#71717a" />
            <Text style={styles.actionText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(item.text)}>
            <Ionicons name="share-social-outline" size={16} color="#71717a" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
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

        {/* Context & Attachment Banners */}
        {attachedFile && (
          <View style={styles.contextBanner}>
            <Ionicons name="document-text" size={16} color="#10b981" style={{ marginRight: 6 }} />
            <Text style={styles.contextBannerText} numberOfLines={1}>Attached: {attachedFile.name}</Text>
            <TouchableOpacity onPress={() => setAttachedFile(null)}>
              <Ionicons name="close-circle" size={20} color="#71717a" />
            </TouchableOpacity>
          </View>
        )}
        
        {replyingTo && (
          <View style={styles.contextBanner}>
            <Ionicons name="arrow-undo" size={16} color="#3b82f6" style={{ marginRight: 6 }} />
            <Text style={styles.contextBannerText} numberOfLines={1}>Replying: {replyingTo.text}</Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Ionicons name="close-circle" size={20} color="#71717a" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Area */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton} onPress={pickDocument}>
            <Ionicons name="attach" size={26} color="#a1a1aa" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            placeholder="Message AI..."
            placeholderTextColor="#71717a"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() && !attachedFile || isLoading) && styles.disabledSend]}
            onPress={sendMessage}
            disabled={(!inputText.trim() && !attachedFile) || isLoading}
          >
            {isLoading ? <ActivityIndicator color="#ffffff" size="small" /> : <Ionicons name="arrow-up" size={22} color="#ffffff" />}
          </TouchableOpacity>
        </KeyboardAvoidingView>

        {/* Settings Modal with Drop-down Model Selection */}
        <Modal visible={settingsVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>AI Configuration</Text>

              <Text style={styles.inputLabel}>Select Granted Model</Text>
              {availableModels.length > 0 ? (
                <View style={styles.dropdownContainer}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
                    {availableModels.map((m) => (
                      <TouchableOpacity 
                        key={m} 
                        style={[styles.dropdownItem, modelName === m && styles.dropdownItemSelected]}
                        onPress={() => setModelName(m)}
                      >
                        <Text style={[styles.dropdownText, modelName === m && styles.dropdownTextSelected]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : (
                <TouchableOpacity style={styles.fetchButton} onPress={fetchModels} disabled={isFetchingModels}>
                  {isFetchingModels ? <ActivityIndicator color="#fff" /> : <Text style={styles.fetchButtonText}>Fetch API Models</Text>}
                </TouchableOpacity>
              )}

              <Text style={styles.inputLabel}>Base URL</Text>
              <TextInput style={styles.modalInput} value={baseUrl} onChangeText={setBaseUrl} />

              <Text style={styles.inputLabel}>API Key</Text>
              <TextInput style={styles.modalInput} value={apiKey} onChangeText={setApiKey} secureTextEntry />

              <TouchableOpacity style={styles.saveButton} onPress={() => setSettingsVisible(false)}>
                <Text style={styles.saveButtonText}>Save & Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  headerTitle: { color: '#f4f4f5', fontSize: 18, fontWeight: 'bold' },
  headerSubtitle: { color: '#10b981', fontSize: 12, marginTop: 2 },
  chatContainer: { padding: 16 },
  messageWrapper: { marginVertical: 8, maxWidth: '88%' },
  userWrapper: { alignSelf: 'flex-end' },
  aiWrapper: { alignSelf: 'flex-start' },
  messageBubble: { padding: 14, borderRadius: 18 },
  userBubble: { backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: '#18181b', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#27272a' },
  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#ffffff' },
  aiText: { color: '#e4e4e7' },
  actionBar: { flexDirection: 'row', marginTop: 6, paddingHorizontal: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  actionText: { color: '#71717a', fontSize: 11, marginLeft: 4 },
  contextBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181b', padding: 10, borderTopWidth: 1, borderTopColor: '#27272a' },
  contextBannerText: { color: '#a1a1aa', fontSize: 13, flex: 1 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1, borderTopColor: '#27272a', backgroundColor: '#09090b' },
  attachButton: { padding: 8, marginRight: 4 },
  input: { flex: 1, backgroundColor: '#18181b', color: '#ffffff', borderRadius: 24, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, maxHeight: 120, fontSize: 15, borderWidth: 1, borderColor: '#27272a' },
  sendButton: { backgroundColor: '#2563eb', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  disabledSend: { backgroundColor: '#27272a' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#18181b', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#27272a' },
  modalTitle: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  inputLabel: { color: '#a1a1aa', fontSize: 13, marginBottom: 6, marginTop: 16 },
  modalInput: { backgroundColor: '#09090b', color: '#ffffff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#27272a', fontSize: 14 },
  fetchButton: { backgroundColor: '#27272a', borderRadius: 8, padding: 12, alignItems: 'center' },
  fetchButtonText: { color: '#f4f4f5', fontWeight: 'bold' },
  dropdownContainer: { backgroundColor: '#09090b', borderRadius: 8, borderWidth: 1, borderColor: '#27272a', overflow: 'hidden' },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  dropdownItemSelected: { backgroundColor: '#2563eb' },
  dropdownText: { color: '#a1a1aa', fontSize: 14 },
  dropdownTextSelected: { color: '#ffffff', fontWeight: 'bold' },
  saveButton: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  saveButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
});
