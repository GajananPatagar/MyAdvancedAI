import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal, ScrollView,
  Alert, Animated, Switch
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventSource from 'react-native-sse';

// --- ENTERPRISE THEMING ENGINE ---
const THEMES = {
  OLED_Pure: { name: 'OLED Pure', mode: 'dark', bg: '#000000', card: '#0a0a0a', border: '#171717', text: '#ffffff', textMuted: '#737373', primary: '#3b82f6', userBg: '#1d4ed8', aiBg: '#0a0a0a', thinkBg: '#020617', thinkBorder: '#1e293b' },
  Midnight_Indigo: { name: 'Midnight', mode: 'dark', bg: '#0B0F19', card: '#111827', border: '#1f2937', text: '#f3f4f6', textMuted: '#9ca3af', primary: '#6366f1', userBg: '#4f46e5', aiBg: '#111827', thinkBg: '#1e1b4b', thinkBorder: '#3730a3' },
  Graphite_Pro: { name: 'Graphite', mode: 'dark', bg: '#121212', card: '#1e1e1e', border: '#2d2d2d', text: '#e4e4e7', textMuted: '#a1a1aa', primary: '#0ea5e9', userBg: '#0284c7', aiBg: '#1e1e1e', thinkBg: '#171717', thinkBorder: '#2d2d2d' },
  Obsidian_Amethyst: { name: 'Obsidian', mode: 'dark', bg: '#0d0221', card: '#140431', border: '#2a0a5e', text: '#fae8ff', textMuted: '#e879f9', primary: '#d946ef', userBg: '#c026d3', aiBg: '#140431', thinkBg: '#2e1065', thinkBorder: '#4c1d95' },
  Forest_Night: { name: 'Evergreen', mode: 'dark', bg: '#0f1712', card: '#152018', border: '#1f2f24', text: '#ecfdf5', textMuted: '#6ee7b7', primary: '#10b981', userBg: '#059669', aiBg: '#152018', thinkBg: '#064e3b', thinkBorder: '#065f46' },
  Clean_Snow: { name: 'Clean Snow', mode: 'light', bg: '#ffffff', card: '#f8fafc', border: '#e2e8f0', text: '#0f172a', textMuted: '#64748b', primary: '#2563eb', userBg: '#3b82f6', aiBg: '#f8fafc', thinkBg: '#eff6ff', thinkBorder: '#bfdbfe' },
  Corporate_Slate: { name: 'Corporate', mode: 'light', bg: '#f1f5f9', card: '#ffffff', border: '#cbd5e1', text: '#020617', textMuted: '#475569', primary: '#0f172a', userBg: '#334155', aiBg: '#ffffff', thinkBg: '#e2e8f0', thinkBorder: '#94a3b8' },
  Ivory_Minimal: { name: 'Ivory Sepia', mode: 'light', bg: '#fdfbf7', card: '#ffffff', border: '#eaddcf', text: '#431407', textMuted: '#78350f', primary: '#d97706', userBg: '#b45309', aiBg: '#ffffff', thinkBg: '#fef3c7', thinkBorder: '#fde68a' },
  Nordic_Frost: { name: 'Nordic Frost', mode: 'light', bg: '#f0fdfa', card: '#ffffff', border: '#ccfbf1', text: '#134e4a', textMuted: '#115e59', primary: '#0d9488', userBg: '#0f766e', aiBg: '#ffffff', thinkBg: '#ccfbf1', thinkBorder: '#99f6e4' },
  Soft_Lavender: { name: 'Lavender', mode: 'light', bg: '#faf5ff', card: '#ffffff', border: '#f3e8ff', text: '#3b0764', textMuted: '#6b21a8', primary: '#9333ea', userBg: '#7e22ce', aiBg: '#ffffff', thinkBg: '#f3e8ff', thinkBorder: '#d8b4fe' },
};

export default function AIChatApp() {
  const insets = useSafeAreaInsets();

  // --- SETTINGS & BILLING STATE ---
  const [apiKey, setApiKey] = useState('xpl_06e58639becf90ade37da17d2014fcaf0c1236c6');
  const [baseUrl, setBaseUrl] = useState('https://api.experientiallabs.ai/v1/chat/completions');
  const [modelName, setModelName] = useState('glm-5.3-flash-abliterated'); 
  const [systemPrompt, setSystemPrompt] = useState('You are a highly advanced AI assistant.');
  const [currentTheme, setCurrentTheme] = useState('Clean_Snow');
  const [isAdvancedThinking, setIsAdvancedThinking] = useState(false);
  const t = THEMES[currentTheme] || THEMES.Clean_Snow;
  
  const [totalTokensUsed, setTotalTokensUsed] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [creditHistory, setCreditHistory] = useState([]);
  
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('models'); 
  const [availableModels, setAvailableModels] = useState([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [peekModel, setPeekModel] = useState(null);

  const [messages, setMessages] = useState([{ id: 'init-1', role: 'assistant', text: 'System initialized. 120Hz Engine Active. I will now safely adapt your images for any model you choose.' }]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  
  const flatListRef = useRef(null);
  const eventSourceRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSettings();
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const loadSettings = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      const savedKey = await AsyncStorage.getItem('apiKey');
      const savedModel = await AsyncStorage.getItem('modelName');
      const savedTokens = await AsyncStorage.getItem('totalTokens');
      const savedCost = await AsyncStorage.getItem('totalCost');
      const savedHistory = await AsyncStorage.getItem('creditHistory');
      
      if (savedTheme && THEMES[savedTheme]) setCurrentTheme(savedTheme);
      if (savedKey) setApiKey(savedKey);
      if (savedModel) setModelName(savedModel);
      if (savedTokens) setTotalTokensUsed(parseInt(savedTokens, 10));
      if (savedCost) setEstimatedCost(parseFloat(savedCost));
      if (savedHistory) setCreditHistory(JSON.parse(savedHistory));
    } catch (e) {}
  };

  const saveSettings = async () => {
    await AsyncStorage.setItem('theme', currentTheme);
    await AsyncStorage.setItem('apiKey', apiKey);
    await AsyncStorage.setItem('modelName', modelName);
    setSettingsVisible(false);
    triggerHaptic();
  };

  const logTransaction = async (tokens, cost) => {
    const newTokens = totalTokensUsed + tokens;
    const newCost = estimatedCost + cost;
    const newRecord = { id: Date.now().toString(), date: new Date().toLocaleString(), model: modelName, tokens, cost };
    const newHistory = [newRecord, ...creditHistory].slice(0, 50); 
    
    setTotalTokensUsed(newTokens);
    setEstimatedCost(newCost);
    setCreditHistory(newHistory);
    
    await AsyncStorage.setItem('totalTokens', newTokens.toString());
    await AsyncStorage.setItem('totalCost', newCost.toString());
    await AsyncStorage.setItem('creditHistory', JSON.stringify(newHistory));
  };

  const triggerHaptic = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  const getModelPricePer1M = (id) => {
    const lowerId = id.toLowerCase();
    if (lowerId.includes('free') || lowerId.includes('local') || lowerId.includes('glm-5.3-flash-abliterated') || lowerId.includes('jev')) return 0;
    if (lowerId.includes('gpt-6') || lowerId.includes('gpt-4') || lowerId.includes('claude-3-opus') || lowerId.includes('o1')) return 15.00;
    if (lowerId.includes('gpt-4o') || lowerId.includes('claude-3-sonnet') || lowerId.includes('gemini-1.5-pro')) return 3.00;
    if (lowerId.includes('deepseek') || lowerId.includes('qwen') || lowerId.includes('llama') || lowerId.includes('gemini-1.5-flash') || lowerId.includes('haiku')) return 0.15;
    return 0.50; 
  };

  const fetchModels = async () => {
    setIsFetchingModels(true);
    triggerHaptic();
    try {
      const modelsUrl = baseUrl.trim().replace('/chat/completions', '/models');
      const response = await fetch(modelsUrl, { headers: { 'Authorization': `Bearer ${apiKey.trim()}` }});
      const data = await response.json();
      if (data.data) {
        const enrichedModels = data.data.map(m => {
          const rawCost = getModelPricePer1M(m.id);
          return {
            id: m.id,
            owner: m.owned_by || 'Unknown API',
            costPer1M: rawCost,
            costDisplay: rawCost === 0 ? 'FREE' : `$${rawCost.toFixed(2)}/1M`,
            type: m.id.includes('vl') || m.id.includes('vision') || m.id.includes('gpt-4o') || m.id.includes('claude-3') || m.id.includes('gemini') ? 'Multimodal (Vision)' : 'Text/Reasoning'
          };
        });
        
        setAvailableModels(enrichedModels);
        const freeModel = enrichedModels.find(m => m.costPer1M === 0);
        if (freeModel && !enrichedModels.find(m => m.id === modelName)) {
           setModelName(freeModel.id);
        }
      }
    } catch (err) {
      Alert.alert('Fetch Error', 'Ensure your API key and Base URL are valid.');
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

    const displayPrompt = finalPrompt + (attachedFile && attachedFile.type !== 'text' ? `\n\n📎 [Attached Image/Doc: ${attachedFile.name}]` : '');

    const userMessage = { id: Date.now().toString(), role: 'user', text: displayPrompt, attachedFile };
    const aiPlaceholder = { id: (Date.now() + 1).toString(), role: 'assistant', text: '' }; 
    
    const newHistory = [aiPlaceholder, userMessage, ...messages];
    setMessages(newHistory);
    setInputText('');
    setReplyingTo(null);
    setAttachedFile(null);
    setIsLoading(true);
    triggerHaptic();

    let currentSystemPrompt = systemPrompt;
    if (isAdvancedThinking) {
      currentSystemPrompt += "\n\nCRITICAL INSTRUCTION: You must think step-by-step before answering. Wrap your detailed reasoning process entirely inside <think> and </think> tags at the very beginning of your response, followed by your final answer.";
    }

    // --- SMART VISION FILTER ---
    // Checks if the current selected model has eyes. If not, it strips image data to prevent crashes!
    const isVisionCapable = !!modelName.toLowerCase().match(/vl|vision|gpt-4o|claude-3|gemini|pixtral|llava|omni/);

    const apiPayload = [
      { role: 'system', content: currentSystemPrompt },
      ...[...messages, userMessage].reverse().map((msg) => {
        if (msg.role === 'user' && msg.attachedFile && msg.attachedFile.type !== 'text') {
           if (isVisionCapable) {
             // Send full image array payload
             return { 
               role: 'user', 
               content: [
                 { type: 'text', text: msg.text || "Analyze this image." }, 
                 { type: 'image_url', image_url: { url: `data:${msg.attachedFile.mime};base64,${msg.attachedFile.content}` } }
               ] 
             };
           } else {
             // Fallback for Text-Only models (prevents API rejection crash)
             return { role: 'user', content: msg.text };
           }
        }
        return { role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.text };
      })
    ];

    let charCount = 0; 

    const es = new EventSource(baseUrl.trim(), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName.trim(), messages: apiPayload, stream: true }),
    });

    eventSourceRef.current = es;

    const processSuccessfulCompletion = () => {
      es.close();
      setIsLoading(false);
      triggerHaptic();
      const estTokens = Math.floor(charCount / 4) + 50; 
      const pricePer1M = getModelPricePer1M(modelName);
      const calcCost = pricePer1M === 0 ? 0 : (estTokens / 1000000) * pricePer1M;
      logTransaction(estTokens, calcCost);
    };

    es.addEventListener('message', (event) => {
      if (event.data === '[DONE]') {
        processSuccessfulCompletion();
        return;
      }
      try {
        const parsed = JSON.parse(event.data);
        const chunk = parsed.choices[0]?.delta?.content;
        if (chunk) {
          charCount += chunk.length;
          setMessages((prev) => {
            const updated = [...prev];
            updated[0] = { ...updated[0], text: updated[0].text + chunk };
            return updated;
          });
        }
      } catch (e) {}
    });

    es.addEventListener('error', (event) => {
      if (charCount > 0) {
        processSuccessfulCompletion();
      } else {
        es.close();
        setIsLoading(false);
        setMessages((prev) => {
          const updated = [...prev];
          updated[0] = { ...updated[0], text: updated[0].text + "\n⚠️ Request Rejected. Ensure API key has permissions for this model." };
          return updated;
        });
      }
    });
  };

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

  const renderMessageText = (text, isUser) => {
    if (isUser) return <Text style={[styles.messageText, { color: '#ffffff' }]} selectable={true}>{text}</Text>;

    const thinkMatch = text.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
    if (thinkMatch) {
      const thinkingText = thinkMatch[1].trim();
      const actualResponse = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim();
      
      return (
        <View>
          <View style={[styles.thinkingContainer, { backgroundColor: t.thinkBg, borderColor: t.thinkBorder }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              {isLoading && !text.includes('</think>') ? <ActivityIndicator size="small" color={t.primary} style={{ marginRight: 6 }} /> : <Ionicons name="brain" size={14} color={t.primary} style={{ marginRight: 6 }} />}
              <Text style={{ color: t.primary, fontWeight: 'bold', fontSize: 12 }}>{isLoading && !text.includes('</think>') ? 'Thinking...' : 'Reasoning Process'}</Text>
            </View>
            <Text style={{ color: t.textMuted, fontSize: 13, fontStyle: 'italic' }} selectable={true}>{thinkingText}</Text>
          </View>
          {actualResponse ? <Text style={[styles.messageText, { color: t.text, marginTop: 8 }]} selectable={true}>{actualResponse}</Text> : null}
        </View>
      );
    }
    return <Text style={[styles.messageText, { color: t.text }]} selectable={true}>{text}</Text>;
  };

  const renderMessage = ({ item, index }) => {
    const isUser = item.role === 'user';
    return (
      <Animated.View style={[styles.messageWrapper, isUser ? styles.userWrapper : styles.aiWrapper, { opacity: fadeAnim }]}>
        <View style={{ flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
          <View style={[styles.avatar, { backgroundColor: isUser ? t.primary : t.card, borderColor: t.border }]}>
            <Ionicons name={isUser ? "person" : "logo-electron"} size={16} color={isUser ? "#fff" : t.primary} />
          </View>
          <TouchableOpacity onLongPress={() => setReplyingTo(item)} activeOpacity={0.9} style={[styles.messageBubble, { backgroundColor: isUser ? t.userBg : t.aiBg, borderColor: isUser ? t.userBg : t.border }]}>
             {renderMessageText(item.text, isUser)}
             {isLoading && index === 0 && !isUser && !item.text && <ActivityIndicator size="small" color={t.primary} />}
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
        
        <View style={[styles.header, { borderBottomColor: t.border, backgroundColor: t.bg }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: t.text }]}>Advanced AI</Text>
            <TouchableOpacity onPress={() => setSettingsVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <View style={[styles.statusDot, { backgroundColor: isLoading ? t.primary : '#10b981' }]} />
              <Text style={[styles.headerSubtitle, { color: t.textMuted }]} numberOfLines={1}>{modelName}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ alignItems: 'center', flexDirection: 'row' }}>
            <View style={{ alignItems: 'center', marginRight: 12 }}>
              <Text style={{ color: isAdvancedThinking ? t.primary : t.textMuted, fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>
                {isAdvancedThinking ? 'THINKING 🧠' : 'FLASH ⚡️'}
              </Text>
              <Switch value={isAdvancedThinking} onValueChange={(val) => { setIsAdvancedThinking(val); triggerHaptic(); }} trackColor={{ false: t.border, true: t.primary }} thumbColor={"#fff"} style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
            </View>
            <TouchableOpacity onPress={clearChat} style={styles.iconBtn}><Ionicons name="trash-outline" size={22} color={t.textMuted} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.iconBtn}><Ionicons name="options" size={24} color={t.textMuted} /></TouchableOpacity>
          </View>
        </View>

        {/* --- 120HZ OPTIMIZED ENGINE --- */}
        <FlatList 
          ref={flatListRef} 
          data={messages} 
          keyExtractor={(item) => item.id} 
          renderItem={renderMessage} 
          inverted 
          contentContainerStyle={styles.chatContainer} 
          keyboardDismissMode="on-drag"
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
        />

        {attachedFile && (
          <View style={[styles.contextBanner, { backgroundColor: t.card, borderTopColor: t.border }]}>
            <Ionicons name="document-text" size={16} color={t.primary} />
            <Text style={[styles.contextBannerText, { color: t.text }]} numberOfLines={1}>Attached: {attachedFile.name}</Text>
            <TouchableOpacity onPress={() => setAttachedFile(null)}><Ionicons name="close-circle" size={20} color={t.textMuted} /></TouchableOpacity>
          </View>
        )}
        {replyingTo && (
          <View style={[styles.contextBanner, { backgroundColor: t.card, borderTopColor: t.border }]}>
            <Ionicons name="arrow-undo" size={16} color="#3b82f6" />
            <Text style={[styles.contextBannerText, { color: t.text }]} numberOfLines={1}>Replying: {replyingTo.text}</Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)}><Ionicons name="close-circle" size={20} color={t.textMuted} /></TouchableOpacity>
          </View>
        )}

        <View style={[styles.inputContainer, { backgroundColor: t.bg, borderTopColor: t.border }]}>
          <TouchableOpacity style={styles.attachButton} onPress={pickDocument}><Ionicons name="add-circle" size={32} color={t.textMuted} /></TouchableOpacity>
          <View style={[styles.inputWrapper, { backgroundColor: t.card, borderColor: t.border }]}>
            <TextInput style={[styles.input, { color: t.text }]} placeholder="Message AI..." placeholderTextColor={t.textMuted} value={inputText} onChangeText={setInputText} multiline />
          </View>
          {isLoading ? (
            <TouchableOpacity style={styles.stopButton} onPress={stopGeneration}><Ionicons name="square" size={16} color="#ffffff" /></TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.sendButton, { backgroundColor: (!inputText.trim() && !attachedFile) ? t.card : t.primary }]} onPress={() => sendMessage()} disabled={!inputText.trim() && !attachedFile}>
              <Ionicons name="arrow-up" size={20} color={(!inputText.trim() && !attachedFile) ? t.textMuted : '#ffffff'} />
            </TouchableOpacity>
          )}
        </View>

        <Modal visible={settingsVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: t.bg, borderColor: t.border }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: t.text }]}>Settings</Text>
                <TouchableOpacity onPress={() => setSettingsVisible(false)}><Ionicons name="close" size={28} color={t.textMuted} /></TouchableOpacity>
              </View>
              <View style={[styles.tabBar, { borderBottomColor: t.border }]}>
                <TouchableOpacity onPress={() => setActiveTab('models')} style={[styles.tab, activeTab === 'models' && { borderBottomColor: t.primary, borderBottomWidth: 2 }]}><Text style={{ color: activeTab === 'models' ? t.primary : t.textMuted, fontWeight: 'bold' }}>Models & Config</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('billing')} style={[styles.tab, activeTab === 'billing' && { borderBottomColor: t.primary, borderBottomWidth: 2 }]}><Text style={{ color: activeTab === 'billing' ? t.primary : t.textMuted, fontWeight: 'bold' }}>Ledger & Billing</Text></TouchableOpacity>
              </View>

              {activeTab === 'models' ? (
                <ScrollView style={{ marginTop: 10 }} showsVerticalScrollIndicator={false}>
                  <Text style={[styles.inputLabel, { color: t.textMuted }]}>App Theme (10 Pro Variants)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeCarousel}>
                    {Object.keys(THEMES).map(themeKey => (
                      <TouchableOpacity key={themeKey} onPress={() => setCurrentTheme(themeKey)} style={[styles.themeBtn, currentTheme === themeKey && { borderColor: t.primary }]}>
                        <View style={[styles.themeColorBubble, { backgroundColor: THEMES[themeKey].bg }]} />
                        <Text style={[styles.themeText, { color: currentTheme === themeKey ? t.primary : t.textMuted }]} numberOfLines={1}>{THEMES[themeKey].name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16 }}>
                    <Text style={[styles.inputLabel, { color: t.textMuted }]}>Available Models</Text>
                    <TouchableOpacity onPress={fetchModels}><Text style={{ color: t.primary, fontSize: 12, marginBottom: 6 }}>{isFetchingModels ? "Fetching..." : "Fetch Library"}</Text></TouchableOpacity>
                  </View>
                  <View style={[styles.dropdownContainer, { backgroundColor: t.card, borderColor: t.border }]}>
                    {availableModels.length === 0 ? <Text style={{ color: t.textMuted, padding: 12 }}>No models fetched yet.</Text> : (
                      <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                        {availableModels.map((m) => (
                          <TouchableOpacity key={m.id} style={[styles.dropdownItem, { borderBottomColor: t.border }, modelName === m.id && { backgroundColor: t.primary + '20' }]} onPress={() => setModelName(m.id)} onPressIn={() => setPeekModel(m)} onPressOut={() => setPeekModel(null)} delayPressIn={300}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={[styles.dropdownText, { color: modelName === m.id ? t.primary : t.text }]} numberOfLines={1}>{m.id.substring(0,25)}</Text>
                              <Text style={{ color: m.costDisplay === 'FREE' ? '#10b981' : t.textMuted, fontSize: 12, fontWeight: 'bold' }}>{m.costDisplay}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                  <Text style={{ color: t.textMuted, fontSize: 10, marginTop: 4 }}>* Long-press any model to view exact capabilities.</Text>
                  
                  <Text style={[styles.inputLabel, { color: t.textMuted, marginTop: 16 }]}>System Persona</Text>
                  <TextInput style={[styles.modalInput, { backgroundColor: t.card, color: t.text, borderColor: t.border }]} value={systemPrompt} onChangeText={setSystemPrompt} multiline />
                  <Text style={[styles.inputLabel, { color: t.textMuted, marginTop: 16 }]}>API Key</Text>
                  <TextInput style={[styles.modalInput, { backgroundColor: t.card, color: t.text, borderColor: t.border }]} value={apiKey} onChangeText={setApiKey} secureTextEntry />
                  <TouchableOpacity style={[styles.saveButton, { backgroundColor: t.primary }]} onPress={saveSettings}><Text style={styles.saveButtonText}>Save Options</Text></TouchableOpacity>
                </ScrollView>
              ) : (
                <ScrollView style={{ marginTop: 10 }}>
                  <View style={[styles.ledgerCard, { backgroundColor: t.card, borderColor: t.border }]}>
                    <Text style={{ color: t.textMuted, fontSize: 13, textTransform: 'uppercase', fontWeight: 'bold' }}>Total Estimated Tokens</Text>
                    <Text style={{ color: t.text, fontSize: 32, fontWeight: '900', marginVertical: 8 }}>{totalTokensUsed.toLocaleString()}</Text>
                    <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>Approx Cost: ${estimatedCost.toFixed(4)}</Text>
                  </View>
                  <Text style={[styles.inputLabel, { color: t.textMuted, marginTop: 20 }]}>Recent Transactions</Text>
                  {creditHistory.length === 0 ? <Text style={{ color: t.textMuted }}>No history yet.</Text> : creditHistory.map((item) => (
                    <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border }}>
                      <View>
                        <Text style={{ color: t.text, fontWeight: '600', fontSize: 13 }}>{item.model.substring(0,20)}</Text>
                        <Text style={{ color: t.textMuted, fontSize: 11 }}>{item.date}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: t.primary, fontWeight: 'bold', fontSize: 13 }}>{item.tokens} tkns</Text>
                        <Text style={{ color: item.cost === 0 ? '#10b981' : '#ef4444', fontSize: 11 }}>{item.cost === 0 ? 'FREE' : `-$${item.cost.toFixed(5)}`}</Text>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity style={[styles.saveButton, { backgroundColor: t.card, borderWidth: 1, borderColor: t.border }]} onPress={() => { setCreditHistory([]); setTotalTokensUsed(0); setEstimatedCost(0); }}><Text style={[styles.saveButtonText, { color: '#ef4444' }]}>Clear Ledger</Text></TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
          
          {peekModel && (
            <View style={styles.peekOverlay}>
              <View style={[styles.peekBox, { backgroundColor: t.card, borderColor: t.primary }]}>
                <Text style={[styles.peekTitle, { color: t.text }]}>{peekModel.id}</Text>
                <Text style={{ color: t.textMuted, marginTop: 4 }}>Capability: {peekModel.type}</Text>
                <View style={{ backgroundColor: t.bg, padding: 8, borderRadius: 6, marginTop: 12 }}>
                  <Text style={{ color: '#10b981', fontWeight: 'bold' }}>Cost: {peekModel.costDisplay}</Text>
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
  thinkingContainer: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8, borderLeftWidth: 4 },
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
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalInput: { borderRadius: 12, padding: 16, borderWidth: 1, fontSize: 15 },
  themeCarousel: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  themeBtn: { alignItems: 'center', padding: 10, borderWidth: 2, borderColor: 'transparent', borderRadius: 12, width: 85 },
  themeColorBubble: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#334155', marginBottom: 6 },
  themeText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  dropdownContainer: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  dropdownItem: { padding: 16, borderBottomWidth: 1 },
  dropdownText: { fontSize: 15, fontWeight: '500' },
  saveButton: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 32, elevation: 4 },
  saveButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  ledgerCard: { padding: 20, borderRadius: 16, borderWidth: 1, alignItems: 'center', marginTop: 10 },
  peekOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  peekBox: { padding: 20, borderRadius: 16, width: '80%', borderWidth: 2, elevation: 10 },
  peekTitle: { fontSize: 18, fontWeight: 'bold' }
});
