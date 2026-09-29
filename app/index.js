import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal, ScrollView,
  Alert, Animated, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventSource from 'react-native-sse';

// --- ENTERPRISE THEMING ENGINE ---
const THEMES = {
  OLED: { name: 'OLED Black', bg: '#000000', card: '#0a0a0a', border: '#171717', text: '#ffffff', textMuted: '#737373', primary: '#3b82f6', userBg: '#1d4ed8', aiBg: '#0a0a0a' },
  Dark: { name: 'Pro Dark', bg: '#09090b', card: '#18181b', border: '#27272a', text: '#f4f4f5', textMuted: '#a1a1aa', primary: '#2563eb', userBg: '#2563eb', aiBg: '#18181b' },
  Light: { name: 'Clean Light', bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0', text: '#0f172a', textMuted: '#64748b', primary: '#0ea5e9', userBg: '#0ea5e9', aiBg: '#ffffff' },
  Ocean: { name: 'Deep Ocean', bg: '#0f172a', card: '#1e293b', border: '#334155', text: '#f1f5f9', textMuted: '#94a3b8', primary: '#0284c7', userBg: '#0284c7', aiBg: '#1e293b' },
};

export default function AIChatApp() {
  const insets = useSafeAreaInsets();

  // --- STATE ---
  const [apiKey, setApiKey] = useState('xpl_06e58639becf90ade37da17d2014fcaf0c1236c6');
  const [baseUrl, setBaseUrl] = useState('https://api.experientiallabs.ai/v1/chat/completions');
  const [modelName, setModelName] = useState('qwen3.8-27b');
  const [systemPrompt, setSystemPrompt] = useState('You are a highly advanced, professional AI assistant.');
  const [currentTheme, setCurrentTheme] = useState('Dark');
  const t = THEMES[currentTheme]; // Active Theme
  
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [peekModel, setPeekModel] = useState(null); // Long-press model details

  const [messages, setMessages] = useState([{ id: 'init-1', role: 'assistant', text: 'System initialized. All secure protocols online. How can I assist you today?' }]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  
  const flatListRef = useRef(null);
  const eventSourceRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // --- INITIALIZATION & MEMORY ---
  useEffect(() => {
    loadSettings();
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const loadSettings = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      const savedKey = await AsyncStorage.getItem('apiKey');
      const savedModel = await AsyncStorage.getItem('modelName');
      if (savedTheme) setCurrentTheme(savedTheme);
      if (savedKey) setApiKey(savedKey);
      if (savedModel) setModelName(savedModel);
    } catch (e) {}
  };

  const saveSettings = async () => {
    await AsyncStorage.setItem('theme', currentTheme);
    await AsyncStorage.setItem('apiKey', apiKey);
    await AsyncStorage.setItem('modelName', modelName);
    setSettingsVisible(false);
    triggerHaptic();
  };

  const triggerHaptic = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  // --- API LOGIC (WITH MODEL DETAILS) ---
  const fetchModels = async () => {
    setIsFetchingModels(true);
    triggerHaptic();
    try {
      const modelsUrl = baseUrl.trim().replace('/chat/completions', '/models');
      const response = await fetch(modelsUrl, { headers: { 'Authorization': `Bearer ${apiKey.trim()}` }});
      const data = await response.json();
      if (data.data) {
        // Map data and calculate mock/real pricing for professional display
        const enrichedModels = data.data.map(m => {
          const isPro = m.id.toLowerCase().includes('pro') || m.id.toLowerCase().includes('4o');
          return {
            id: m.id,
            owner: m.owned_by || 'Experiential Labs',
            cost: isPro ? '$0.05 / 1M Tokens' : 'Free Tier',
            type: m.id.includes('vl') || m.id.includes('vision') ? 'Multimodal (Vision)' : 'Text Only'
          };
        });
        setAvailableModels(enrichedModels);
      }
    } catch (err) {
      Alert.alert('Fetch Error', 'Ensure your API key is valid.');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const stopGeneration = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsLoading(false);
      triggerHaptic();
    }
  };

  const sendMessage = (overrideText = null) => {
    const textToSend = overrideText || inputText;
    if (!textToSend.trim() && !attachedFile) return;

    let finalPrompt = textToSend;
    if (replyingTo) finalPrompt = `[Replying to: "${replyingTo.text}"]\n${finalPrompt}`;
    if (attachedFile && attachedFile.type === 'text') finalPrompt += `\n\n--- Attached File: ${attachedFile.name} ---\n${attachedFile.content}`;

    const displayPrompt = finalPrompt + (attachedFile && attachedFile.type !== 'text' ? `\n\n📎 [Attached: ${attachedFile.name}]` : '');

    const userMessage = { id: Date.now().toString(), role: 'user', text: displayPrompt, attachedFile };
    const aiPlaceholder = { id: (Date.now() + 1).toString(), role: 'assistant', text: '' }; 
    
    const newHistory = [aiPlaceholder, userMessage, ...messages];
    setMessages(newHistory);
    setInputText('');
    setReplyingTo(null);
    setAttachedFile(null);
    setIsLoading(true);
    triggerHaptic();

    const apiPayload = [
      { role: 'system', content: systemPrompt },
      ...[...messages, userMessage].reverse().map((msg) => {
        if (msg.role === 'user' && msg.attachedFile && msg.attachedFile.type !== 'text') {
           return { role: 'user', content: [{ type: 'text', text: msg.text }, { type: 'image_url', image_url: { url: `data:${msg.attachedFile.mime};base64,${msg.attachedFile.content}` } }] };
        }
        return { role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.text };
      })
    ];

    const es = new EventSource(baseUrl.trim(), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName.trim(), messages: apiPayload, stream: true }),
    });

    eventSourceRef.current = es;

    es.addEventListener('message', (event) => {
      if (event.data === '[DONE]') {
        es.close();
        setIsLoading(false);
        triggerHaptic();
        return;
      }
      try {
        const parsed = JSON.parse(event.data);
        const chunk = parsed.choices[0]?.delta?.content;
        if (chunk) {
          setMessages((prev) => {
            const updated = [...prev];
            updated[0] = { ...updated[0], text: updated[0].text + chunk };
            return updated;
          });
        }
      } catch (e) {}
    });

    es.addEventListener('error', (event) => {
      es.close();
      setIsLoading(false);
      setMessages((prev) => {
        const updated = [...prev];
        updated[0] = { ...updated[0], text: updated[0].text + "\n⚠️ API Rejected the Request." };
        return updated;
      });
    });
  };

  // --- ACTIONS ---
  const copyText = async (text) => { await Clipboard.setStringAsync(text); triggerHaptic(); Alert.alert('Copied', 'Saved to clipboard'); };
  const deleteMessage = (id) => { triggerHaptic(); setMessages(prev => prev.filter(msg => msg.id !== id)); };
  const editUserMessage = (msg) => { triggerHaptic(); setInputText(msg.text); deleteMessage(msg.id); };
  const clearChat = () => { triggerHaptic(); setMessages([]); };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        if (file.size > 10 * 1024 * 1024) return Alert.alert('Error', 'File must be under 10MB.');
        
        const mime = file.mimeType || '';
        const isText = mime.startsWith('text/') || mime.includes('json') || mime.includes('csv');
        const content = await FileSystem.readAsStringAsync(file.uri, { encoding: isText ? FileSystem.EncodingType.UTF8 : FileSystem.EncodingType.Base64 });
        
        setAttachedFile({ name: file.name, type: isText ? 'text' : mime.startsWith('image/') ? 'image' : 'document', mime, content });
        triggerHaptic();
      }
    } catch (err) { Alert.alert('Error', err.message); }
  };

  const renderMessage = ({ item, index }) => {
    const isUser = item.role === 'user';
    return (
      <Animated.View style={[styles.messageWrapper, isUser ? styles.userWrapper : styles.aiWrapper, { opacity: fadeAnim }]}>
        <View style={{ flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: isUser ? t.primary : t.card, borderColor: t.border }]}>
            <Ionicons name={isUser ? "person" : "hardware-chip"} size={16} color={isUser ? "#fff" : t.primary} />
          </View>
          
          <TouchableOpacity onLongPress={() => setReplyingTo(item)} activeOpacity={0.85} style={[styles.messageBubble, { backgroundColor: isUser ? t.userBg : t.aiBg, borderColor: isUser ? t.userBg : t.border }]}>
            <Text style={[styles.messageText, { color: isUser ? '#ffffff' : t.text }]}>
              {item.text || (isLoading && index === 0 ? "Analyzing..." : "")}
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={[styles.actionBar, isUser ? { alignSelf: 'flex-end', marginRight: 42 } : { alignSelf: 'flex-start', marginLeft: 42 }]}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => copyText(item.text)}><Ionicons name="copy-outline" size={14} color={t.textMuted} /><Text style={[styles.actionText, { color: t.textMuted }]}>Copy</Text></TouchableOpacity>
          {isUser && <TouchableOpacity style={styles.actionBtn} onPress={() => editUserMessage(item)}><Ionicons name="pencil-outline" size={14} color={t.textMuted} /><Text style={[styles.actionText, { color: t.textMuted }]}>Edit</Text></TouchableOpacity>}
          {!isUser && index === 0 && !isLoading && <TouchableOpacity style={styles.actionBtn} onPress={() => { deleteMessage(item.id); sendMessage(messages[1]?.text); }}><Ionicons name="refresh" size={14} color={t.textMuted} /><Text style={[styles.actionText, { color: t.textMuted }]}>Regenerate</Text></TouchableOpacity>}
        </View>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: t.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: t.border, backgroundColor: t.bg }]}>
          <View>
            <Text style={[styles.headerTitle, { color: t.text }]}>Advanced AI</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.statusDot, { backgroundColor: isLoading ? t.primary : '#10b981' }]} />
              <Text style={[styles.headerSubtitle, { color: t.textMuted }]}>{modelName}</Text>
            </View>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity onPress={clearChat} style={styles.iconBtn}><Ionicons name="trash-outline" size={22} color={t.textMuted} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.iconBtn}><Ionicons name="settings-sharp" size={22} color={t.textMuted} /></TouchableOpacity>
          </View>
        </View>

        {/* Chat Feed */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.chatContainer}
          keyboardDismissMode="on-drag"
        />

        {/* Attachment / Reply Banners */}
        {attachedFile && (
          <View style={[styles.contextBanner, { backgroundColor: t.card, borderTopColor: t.border }]}>
            <Ionicons name="document-text" size={16} color={t.primary} />
            <Text style={[styles.contextBannerText, { color: t.text }]} numberOfLines={1}>{attachedFile.name}</Text>
            <TouchableOpacity onPress={() => setAttachedFile(null)}><Ionicons name="close-circle" size={20} color={t.textMuted} /></TouchableOpacity>
          </View>
        )}

        {/* Input Area */}
        <View style={[styles.inputContainer, { backgroundColor: t.bg, borderTopColor: t.border }]}>
          <TouchableOpacity style={styles.attachButton} onPress={pickDocument}>
            <Ionicons name="add-circle" size={32} color={t.textMuted} />
          </TouchableOpacity>
          
          <View style={[styles.inputWrapper, { backgroundColor: t.card, borderColor: t.border }]}>
            <TextInput style={[styles.input, { color: t.text }]} placeholder="Message AI..." placeholderTextColor={t.textMuted} value={inputText} onChangeText={setInputText} multiline />
          </View>
          
          {isLoading ? (
            <TouchableOpacity style={styles.stopButton} onPress={stopGeneration}>
              <Ionicons name="square" size={16} color="#ffffff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.sendButton, { backgroundColor: (!inputText.trim() && !attachedFile) ? t.card : t.primary }]} onPress={() => sendMessage()} disabled={!inputText.trim() && !attachedFile}>
              <Ionicons name="arrow-up" size={20} color={(!inputText.trim() && !attachedFile) ? t.textMuted : '#ffffff'} />
            </TouchableOpacity>
          )}
        </View>

        {/* --- PRO SETTINGS & THEME MODAL --- */}
        <Modal visible={settingsVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: t.bg, borderColor: t.border }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: t.text }]}>Configuration</Text>
                <TouchableOpacity onPress={() => setSettingsVisible(false)}><Ionicons name="close" size={28} color={t.textMuted} /></TouchableOpacity>
              </View>

              {/* Theme Selector */}
              <Text style={[styles.inputLabel, { color: t.textMuted }]}>App Theme</Text>
              <View style={styles.themeRow}>
                {Object.keys(THEMES).map(themeKey => (
                  <TouchableOpacity key={themeKey} onPress={() => setCurrentTheme(themeKey)} style={[styles.themeBtn, currentTheme === themeKey && { borderColor: t.primary }]}>
                    <View style={[styles.themeColorBubble, { backgroundColor: THEMES[themeKey].bg }]} />
                    <Text style={[styles.themeText, { color: currentTheme === themeKey ? t.primary : t.textMuted }]}>{THEMES[themeKey].name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Model Fetching & Peek List */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Text style={[styles.inputLabel, { color: t.textMuted }]}>Available Models</Text>
                <TouchableOpacity onPress={fetchModels}>
                  <Text style={{ color: t.primary, fontSize: 12, marginBottom: 6 }}>{isFetchingModels ? "Fetching..." : "Refresh List"}</Text>
                </TouchableOpacity>
              </View>
              
              <View style={[styles.dropdownContainer, { backgroundColor: t.card, borderColor: t.border }]}>
                {availableModels.length === 0 ? <Text style={{ color: t.textMuted, padding: 12 }}>No models fetched yet.</Text> : (
                  <ScrollView style={{ maxHeight: 160 }}>
                    {availableModels.map((m) => (
                      <TouchableOpacity 
                        key={m.id} 
                        style={[styles.dropdownItem, { borderBottomColor: t.border }, modelName === m.id && { backgroundColor: t.primary + '20' }]} 
                        onPress={() => setModelName(m.id)}
                        onPressIn={() => setPeekModel(m)}
                        onPressOut={() => setPeekModel(null)}
                        delayPressIn={300}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={[styles.dropdownText, { color: modelName === m.id ? t.primary : t.text }]}>{m.id}</Text>
                          <Text style={{ color: m.cost === 'Free Tier' ? '#10b981' : t.textMuted, fontSize: 12 }}>{m.cost}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
              <Text style={{ color: t.textMuted, fontSize: 10, marginTop: 4 }}>* Long-press any model to view details.</Text>

              {/* API Settings */}
              <Text style={[styles.inputLabel, { color: t.textMuted, marginTop: 16 }]}>API Key</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: t.card, color: t.text, borderColor: t.border }]} value={apiKey} onChangeText={setApiKey} secureTextEntry />

              <TouchableOpacity style={[styles.saveButton, { backgroundColor: t.primary }]} onPress={saveSettings}>
                <Text style={styles.saveButtonText}>Save Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* PEEK MODAL (Long press model) */}
          {peekModel && (
            <View style={styles.peekOverlay}>
              <View style={[styles.peekBox, { backgroundColor: t.card, borderColor: t.primary }]}>
                <Text style={[styles.peekTitle, { color: t.text }]}>{peekModel.id}</Text>
                <Text style={{ color: t.textMuted, marginTop: 4 }}>Provider: {peekModel.owner}</Text>
                <Text style={{ color: t.textMuted, marginTop: 4 }}>Capability: {peekModel.type}</Text>
                <View style={{ backgroundColor: t.bg, padding: 8, borderRadius: 6, marginTop: 12 }}>
                  <Text style={{ color: t.primary, fontWeight: 'bold' }}>Cost: {peekModel.cost}</Text>
                </View>
              </View>
            </View>
          )}
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, marginTop: 2, marginLeft: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  headerIcons: { flexDirection: 'row' },
  iconBtn: { marginLeft: 18 },
  chatContainer: { padding: 16 },
  messageWrapper: { marginVertical: 12, maxWidth: '90%' },
  userWrapper: { alignSelf: 'flex-end' },
  aiWrapper: { alignSelf: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginHorizontal: 8, borderWidth: 1 },
  messageBubble: { padding: 16, borderRadius: 20, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  messageText: { fontSize: 16, lineHeight: 24 },
  actionBar: { flexDirection: 'row', marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  actionText: { fontSize: 12, marginLeft: 4, fontWeight: '500' },
  contextBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1 },
  contextBannerText: { fontSize: 13, flex: 1, marginLeft: 6, marginRight: 8, fontWeight: '500' },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1 },
  attachButton: { paddingBottom: 6, marginRight: 8 },
  inputWrapper: { flex: 1, borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  input: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, maxHeight: 120, fontSize: 16 },
  sendButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 2 },
  stopButton: { backgroundColor: '#ef4444', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderBottomWidth: 0, minHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '800' },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalInput: { borderRadius: 12, padding: 16, borderWidth: 1, fontSize: 15 },
  themeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  themeBtn: { alignItems: 'center', padding: 8, borderWidth: 2, borderColor: 'transparent', borderRadius: 12, flex: 1 },
  themeColorBubble: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#334155', marginBottom: 6 },
  themeText: { fontSize: 11, fontWeight: '600' },
  dropdownContainer: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  dropdownItem: { padding: 16, borderBottomWidth: 1 },
  dropdownText: { fontSize: 15, fontWeight: '500' },
  saveButton: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 32, elevation: 4 },
  saveButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  peekOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  peekBox: { padding: 20, borderRadius: 16, width: '80%', borderWidth: 2, elevation: 10 },
  peekTitle: { fontSize: 18, fontWeight: 'bold' }
});
